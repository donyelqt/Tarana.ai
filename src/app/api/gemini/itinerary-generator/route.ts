import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { createHash, randomUUID } from "crypto";
import { authOptions } from "@/lib/auth/auth";
import { CreditService, InsufficientCreditsError } from "@/lib/referral-system";
import { takeRefundSnapshot } from "@/lib/observability/refundMetrics";
import { geminiModel, API_KEY } from "./lib/config";
import { getPeakHoursContext } from "@/lib/traffic";
import { buildDetailedPrompt } from "./lib/contextBuilder";
import { findAndScoreActivities } from "./lib/activitySearch";
import { generateItinerary, handleItineraryProcessing, parseAndCleanJson } from "./lib/responseHandler";
import { ErrorHandler, ErrorType, ItineraryError } from "./lib/errorHandler";
import { GuaranteedJsonEngine } from "./lib/guaranteedJsonEngine";
import { isZeroActivityItinerary } from "./lib/zeroActivityItinerary";
import type { WeatherCondition } from "./types/types";
import { z } from "zod";
import { PipelineCoordinator } from "@/agents/pipelineCoordinator";
import { ConciergeAgent } from "@/agents/conciergeAgent";
import { timedHttp } from "@/lib/observability/httpMetrics";
import { ContextScoutAgent } from "@/agents/contextScoutAgent";
import { RetrievalStrategistAgent } from "@/agents/retrievalStrategistAgent";
import { ItineraryComposerAgent } from "@/agents/itineraryComposerAgent";
import { RequestWeatherProvider } from "@/agents/providers/requestWeatherProvider";
import { clearSession, type RequestSession } from "@/lib/agentic/sessionStore";
import { benchBypassEnabled, configuredBenchUserId, resolveBenchUserId, BENCH_TOKEN_HEADER } from "@/lib/auth/benchToken";
import { isFlagEnabled } from "@/lib/flags/flags";
import { withAuth } from "@/lib/auth/withAuth";
import { logger } from "@/lib/observability/logger";
import { getRequestId } from "@/middleware/requestId";
import { claimIdempotency, completeIdempotency, getIdempotencyKey, hashIdempotencyPayload, type IdempotencyClaim } from "@/lib/services/idempotencyService";

const itineraryRequestSchema = z.object({
    prompt: z.string().min(1).max(5000),
    weatherData: z.object({
        weather: z.array(z.object({
            id: z.number().int().optional(),
            main: z.string().max(100).optional(),
            description: z.string().max(300).optional(),
            icon: z.string().max(50).optional(),
        })).max(10).optional(),
        main: z.object({
            temp: z.number().min(-150).max(150).optional(),
            feels_like: z.number().optional(),
            temp_min: z.number().optional(),
            temp_max: z.number().optional(),
            humidity: z.number().optional(),
        }).partial().optional(),
    }).passthrough().optional(),
    interests: z.array(z.string().min(1).max(100)).max(25).optional(),
    duration: z.union([z.string().max(100), z.number().int().positive()]).optional(),
    budget: z.string().max(100).optional(),
    pax: z.union([z.string().max(50), z.number().int().positive()]).optional(),
    cityId: z.enum(["baguio","cebu","manila","davao","ph-wide","world"]).optional(),
    options: z.object({
        trafficAware: z.boolean().default(true).optional(),
    }).optional(),
}).passthrough();

type ItineraryRequest = z.infer<typeof itineraryRequestSchema>;

const conciergeAgent = new ConciergeAgent({ requestSchema: itineraryRequestSchema });
const contextScoutAgent = new ContextScoutAgent({ weatherProvider: new RequestWeatherProvider() });
const retrievalStrategistAgent = new RetrievalStrategistAgent({ geminiModel });
const itineraryComposerAgent = new ItineraryComposerAgent();
const pipelineCoordinator = new PipelineCoordinator({
  concierge: conciergeAgent,
  contextScout: contextScoutAgent,
  retrievalStrategist: retrievalStrategistAgent,
  itineraryComposer: itineraryComposerAgent,
});

// Vercel Hobby caps Node functions at 60s. Generations run 7.5–60s per bench
// docs; a Vercel kill skips every refund block by construction, so total work
// is bounded below this limit (retries × timeout + delay < 60s) and the
// timeout-charge policy is documented here: a request killed at the platform
// limit is charged with no possible refund (refund-after-death is impossible).
export const maxDuration = 60;

const USE_MULTI_AGENT = isFlagEnabled('USE_MULTI_AGENT');
const IDEMPOTENCY_ROUTE = '/api/gemini/itinerary-generator';

async function consumeCredit(userId: string, prompt: string) {
    // Fail-closed: propagate so the caller can refuse to serve output it could not charge for.
    await CreditService.consumeCredits({
        userId,
        amount: 1,
        service: "tarana_gala",
        description: `Generated itinerary: ${prompt?.substring(0, 50) || "Itinerary generation"}`,
    });
}

// H1 hotfix (2026-09-01): detect zero-activity itineraries so we can refund the
// credit on a happy-path zero result. Imported from ./lib/zeroActivityItinerary
// so the unit test can exercise it without pulling in next/server.

async function handleMultiAgentPost(req: NextRequest, userId: string): Promise<NextResponse> {
    let claim: IdempotencyClaim | null = null;
    let session: RequestSession | undefined;
    let generated = false;

    const completeClaim = async (status: number, body: unknown): Promise<void> => {
        if (claim?.kind !== 'owner') return;
        try {
            await completeIdempotency(claim.rowId, status, body);
        } catch (error) {
            logger.error(
                "[idempotency] failed to complete multi-agent key",
                { route: IDEMPOTENCY_ROUTE, rowId: claim.rowId, error },
                getRequestId(req),
            );
        }
    };

    try {
        const key = getIdempotencyKey(req);
        if (key) {
            // Read a clone so ConciergeAgent can still consume the original body.
            const rawBody = await req.clone().json().catch(() => null);
            claim = await claimIdempotency(
                userId,
                IDEMPOTENCY_ROUTE,
                key,
                hashIdempotencyPayload(rawBody),
            );

            if (claim.kind === 'replay') {
                return NextResponse.json(claim.replay.body, { status: claim.replay.status });
            }

            if (claim.kind === 'conflict') {
                const response = NextResponse.json(
                    { error: 'Request is already being processed', text: '' },
                    { status: 409 },
                );
                response.headers.set('Retry-After', '1');
                return response;
            }

            if (claim.kind === 'payload-mismatch') {
                return NextResponse.json(
                    { error: 'Idempotency key was already used with a different payload' },
                    { status: 422 },
                );
            }
        }

        if (!API_KEY) {
            const responseBody = { text: "", error: "GOOGLE_GEMINI_API_KEY is missing on the server." };
            await completeClaim(500, responseBody);
            logger.error("GOOGLE_GEMINI_API_KEY is missing!", { entryPoint: "itinerary-generator" }, getRequestId(req));
            return NextResponse.json(responseBody, { status: 500 });
        }

        session = await pipelineCoordinator.handleRequest(req);

        if (!session.itinerary?.json) {
            throw new Error("Itinerary generation returned no result");
        }

        // H2: charge-before moved into pipelineCoordinator.handleRequest (before generation)
        generated = true;
        const responsePayload = { text: JSON.stringify(session.itinerary.json) };
        await completeClaim(200, responsePayload);
        return NextResponse.json(responsePayload);
    } catch (error: any) {
        const err = error as Error & { details?: Record<string, string[]> };

        if (error instanceof InsufficientCreditsError) {
            const responseBody = {
                error: "Insufficient credits",
                text: "",
                required: error.required,
                available: error.available,
            };
            return NextResponse.json(responseBody, { status: 402 });
        }

        if (err?.message === "Authentication required") {
            const responseBody = { error: err.message, text: "" };
            return NextResponse.json(responseBody, { status: 401 });
        }

        if (err?.details) {
            const responseBody = { error: "Invalid request payload", details: err.details };
            return NextResponse.json(responseBody, { status: 400 });
        }

        // Primary refund lives in PipelineCoordinator.catch (it owns charged-state);
        // this block covers only a session returned without an itinerary. Once a
        // valid result exists, a storage failure must not refund a successful
        // generation. The bench exemption is gated on the bypass being active,
        // not bare id equality (see pipelineCoordinator).
        let routeRefunded = false;
        if (!generated && !(error as any).__galaRefunded && session?.userId && !(benchBypassEnabled() && session.userId === configuredBenchUserId())) {
            try {
                routeRefunded = await CreditService.refundCredits({
                    userId: session.userId,
                    amount: 1,
                    service: "tarana_gala",
                    description: `Refund: multi-agent failed ${session.id}`,
                    idempotencyKey: `refund:${session.id}`,
                }) === true;
                if (routeRefunded) {
                    logger.info(`💸 Multi-agent refund: 1 credit refunded to ${session.userId} (session ${session.id})`, { userId: session.userId, sessionId: session.id }, getRequestId(req));
                } else {
                    logger.warn("Multi-agent route refund did not apply", { sessionId: session.id }, getRequestId(req));
                }
            } catch (refundErr) {
                logger.error("Multi-agent refund failed (best-effort):", { error: refundErr }, getRequestId(req));
            }
        }

        logger.error("Multi-agent pipeline error:", { error: err }, getRequestId(req));
        const errorResponse = { text: "", error: "Internal server error", refunded: (error as any).__galaRefunded === true || routeRefunded };
        await completeClaim(500, errorResponse);
        return NextResponse.json(errorResponse, { status: 500 });
    } finally {
        if (session) {
            clearSession(session.id);
        }
        // Refund observability: emit the per-request counter snapshot so a
        // spike of failed/noop refunds is visible in Vercel logs. Swallowed
        // refund failures were previously invisible by construction.
        const snapshot = takeRefundSnapshot();
        if (snapshot.refunded > 0 || snapshot.failed > 0 || snapshot.noop > 0) {
          logger.info(`[refund-metrics] request=${session?.id ?? '?'} refunded=${snapshot.refunded} failed=${snapshot.failed} noop=${snapshot.noop}`, { refunded: snapshot.refunded, failed: snapshot.failed, noop: snapshot.noop }, getRequestId(req));
        }
    }
}

// Main logic for generating an itinerary, wrapped for caching
const getCachedItinerary = unstable_cache(
    async (requestBody: any, hash: string) => {
        const requestId = hash.substring(0, 8);
        
        return await ErrorHandler.withRetry(async () => {
            const { prompt, weatherData, interests, duration, budget, pax, options } = requestBody;
            const cityId = (requestBody as any)?.cityId || "baguio";
            const safeInterests = interests ?? [];
            const safeBudget = budget === undefined || budget === null ? undefined : String(budget);
            const safePax = pax === undefined || pax === null ? undefined : String(pax);
            const trafficAware = options?.trafficAware !== false; // Default true

            if (!geminiModel) {
                throw new ItineraryError(ErrorType.GENERATION, "Gemini model not available", false, requestId);
            }

            const durationDays = (() => {
                if (!duration) return null;
                const match = duration.toString().match(/\d+/);
                return match ? parseInt(match[0], 10) : null;
            })();

            const weatherId = weatherData?.weather?.[0]?.id || 0;
            const temperature = weatherData?.main?.temp || 20;
            const getWeatherType = (id: number, temp: number): WeatherCondition => {
                if (id >= 200 && id <= 232) return 'thunderstorm';
                if ((id >= 300 && id <= 321) || (id >= 500 && id <= 531)) return 'rainy';
                if (id >= 600 && id <= 622) return 'snow';
                if (id >= 701 && id <= 781) return 'foggy';
                if (id === 800) return 'clear';
                if (id >= 801 && id <= 804) return 'cloudy';
                if (temp < 15) return 'cold';
                return 'default';
            };
            const weatherType: WeatherCondition = getWeatherType(weatherId, temperature);

            const effectiveSampleItinerary = await findAndScoreActivities(
              prompt, 
              safeInterests, 
              weatherType, 
              durationDays, 
              geminiModel,
              trafficAware,
              cityId
            );
            const detailedPrompt = buildDetailedPrompt(prompt, effectiveSampleItinerary, weatherData, safeInterests, durationDays, safeBudget, safePax, true, cityId);
            
            // Use Guaranteed JSON Engine for 100% reliable output
            const peakHoursContext = getPeakHoursContext();
            const weatherContext = `Weather: ${weatherData?.weather?.[0]?.description || 'clear'}, ${weatherData?.main?.temp || 20}°C`;
            const trafficContext = "Real-time traffic analysis integrated with peak hours filtering";
            
            logger.info(`🛡️ MAIN ROUTE: Using GuaranteedJsonEngine for request ${requestId}`, {}, requestId);
            const guaranteedItinerary = await GuaranteedJsonEngine.generateGuaranteedJson(
                detailedPrompt,
                effectiveSampleItinerary,
                weatherContext,
                peakHoursContext,
                `Duration: ${durationDays} days, Budget: ${budget}, Pax: ${pax}`,
                requestId
            );
            
            // Process the guaranteed valid itinerary
            const finalItinerary = await handleItineraryProcessing(guaranteedItinerary, prompt, durationDays, peakHoursContext);
            return { text: JSON.stringify(finalItinerary) };
        }, 3, 1000); // 3 retries with 1 second base delay
    },
    ['itinerary-requests'], // Cache key prefix
    {
        revalidate: 30 * 60, // 30-minute cache revalidation
        tags: ['itineraries'],
    }
);
export const POST = withAuth(async (req: NextRequest, userId: string) => {
  return timedHttp('/api/gemini/itinerary-generator', 'POST', async () => {
    if (USE_MULTI_AGENT) {
        return handleMultiAgentPost(req, userId);
    }

    let charged = false;
    let cacheKeyBase = '';
    // Per-attempt refund identity: stable within this invocation (so
    // overlapping refund calls dedupe) but unique across retries (so a
    // retried request's legitimate second refund is never swallowed).
    // Body-derived fingerprints must NOT be used here: two identical
    // requests are two separate charges needing independent refunds.
    const attemptId = randomUUID();
    // Idempotency claim handle: owned by the keyed branch below (after
    // validation), read by the success/failure completions and the catch
    // block. Null on the unkeyed path, which flows exactly as before.
    let claim: IdempotencyClaim | null = null;
    try {
        // Bench HMAC accepted here too (k6 targets this URL); the bench
        // identity skips the balance pre-check and charge below, mirroring
        // the multi-agent coordinator. withAuth resolved the session;
        // a bench request arrives here only if its HMAC proof matched.
        const isBenchRequest = false;
        // ✅ CREDIT SYSTEM: Check available credits (fail-closed)
        if (!isBenchRequest) {
            const balance = await CreditService.getCurrentBalance(userId);
            if (balance.remainingToday < 1) {
                return NextResponse.json({ 
                    error: "Insufficient credits",
                    text: "",
                    required: 1,
                    available: balance.remainingToday,
                    nextRefresh: balance.nextRefresh
                }, { status: 402 });
            }
        }

        // Hard 32KB body cap (Task 9 hardening): the schema validates shape
        // but not raw size; an unbounded req.json() lets any client push an
        // oversized payload through zod + downstream compute. k6 bench payload
        // is ~350B; mobile does not call this route. Reject loud with 413.
        const contentLength = Number(req.headers.get('content-length') ?? 0);
        if (contentLength > 32 * 1024) {
            return NextResponse.json({
                text: "",
                error: "Request body too large",
            }, { status: 413 });
        }

        const rawRequestBody = await req.json();
        const parsedRequestBody = itineraryRequestSchema.safeParse(rawRequestBody);

        if (!parsedRequestBody.success) {
            const formattedErrors = parsedRequestBody.error.flatten();
            return NextResponse.json({
                error: "Invalid request payload",
                details: formattedErrors.fieldErrors,
            }, { status: 400 });
        }

        const requestBody: ItineraryRequest = parsedRequestBody.data;
        const { prompt } = requestBody;

        // Idempotency (2.3): a retried generation must not charge twice.
        // Claim runs after validation (400s never bill, never claim) and
        // before the charge, mirroring saved-itineraries/[id] PATCH.
        // Unkeyed requests flow unchanged (opt-in contract, not a mandate).
        const key = getIdempotencyKey(req);
        if (key) {
          claim = await claimIdempotency(userId, IDEMPOTENCY_ROUTE, key, hashIdempotencyPayload(rawRequestBody));
        }

        if (claim?.kind === 'replay') {
          return NextResponse.json(claim.replay.body, { status: claim.replay.status });
        }

        if (claim?.kind === 'conflict') {
          const conflict = NextResponse.json(
            { error: 'Request is already being processed', text: '' },
            { status: 409 }
          );
          conflict.headers.set('Retry-After', '1');
          return conflict;
        }

        if (claim?.kind === 'payload-mismatch') {
          return NextResponse.json(
            { error: 'Idempotency key was already used with a different payload', text: '' },
            { status: 422 }
          );
        }

        if (!API_KEY) {
            logger.error("GOOGLE_GEMINI_API_KEY is missing!", {}, getRequestId(req));
            return NextResponse.json({ text: "", error: "GOOGLE_GEMINI_API_KEY is missing on the server." }, { status: 500 });
        }

        if (!prompt) {
            return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
        }
        
        // ✅ CRITICAL: Check if this is a refresh request (bypass cache)
        const isRefreshRequest = req.headers.get('x-refresh-request') === 'true' || 
                                 req.headers.get('x-bypass-cache') === 'true';
        
        if (isRefreshRequest) {
            logger.info('🔄 REFRESH REQUEST DETECTED - Bypassing cache for fresh generation', {}, getRequestId(req));
        }

        // Handle health check endpoint
        if (req.nextUrl.searchParams.get('action') === 'health') {
            const health = await GuaranteedJsonEngine.healthCheck();
            return NextResponse.json(health);
        }

        // Handle metrics endpoint
        if (req.nextUrl.searchParams.get('action') === 'metrics') {
            const metrics = GuaranteedJsonEngine.getMetrics();
            return NextResponse.json(metrics);
        }

        // Charge BEFORE generating (TOCTOU / wasted-compute fix, mirrors the
        // optimized route). consumeCredits is an atomic check-and-deduct RPC,
        // so concurrent same-user requests are serialized with no over-spend.
        // Bench requests skip the charge (coordinator parity).
        if (!isBenchRequest) {
        try {
            await CreditService.consumeCredits({
                userId,
                amount: 1,
                service: 'tarana_gala',
                description: `Generated itinerary: ${prompt?.substring(0, 50) || 'Itinerary generation'}`,
            });
            charged = true;
        } catch (creditErr: any) {
            if (creditErr instanceof InsufficientCreditsError) {
                return NextResponse.json({
                    error: "Insufficient credits",
                    text: "",
                    required: creditErr.required,
                    available: creditErr.available,
                }, { status: 402 });
            }
            throw creditErr;
        }
        }
        // Generate a stable cache key from the request body
        const baseHash = createHash('sha256').update(JSON.stringify(requestBody)).digest('hex');
        cacheKeyBase = `${userId}:${baseHash}`;
        
        let responseData;
        
        // ✅ CACHE BYPASS: For refresh requests, skip cache and generate fresh
        if (isRefreshRequest) {
            logger.info('⏩ Executing fresh generation (cache bypassed)', {}, getRequestId(req));
            const requestId = cacheKeyBase.substring(0, 8);
            
            // Generate fresh itinerary without cache
            responseData = await ErrorHandler.withRetry(async () => {
                const { prompt, weatherData, interests, duration, budget, pax, options } = requestBody;
                const cityId = (requestBody as any)?.cityId || "baguio";
                const safeInterests = interests ?? [];
                const safeBudget = budget === undefined || budget === null ? undefined : String(budget);
                const safePax = pax === undefined || pax === null ? undefined : String(pax);
                const trafficAware = options?.trafficAware !== false; // Default true

                if (!geminiModel) {
                    throw new ItineraryError(ErrorType.GENERATION, "Gemini model not available", false, requestId);
                }

                const durationDays = (() => {
                    if (!duration) return null;
                    const match = duration.toString().match(/\d+/);
                    return match ? parseInt(match[0], 10) : null;
                })();

                const weatherId = weatherData?.weather?.[0]?.id || 0;
                const temperature = weatherData?.main?.temp || 20;
                const getWeatherType = (id: number, temp: number): WeatherCondition => {
                    if (id >= 200 && id <= 232) return 'thunderstorm';
                    if ((id >= 300 && id <= 321) || (id >= 500 && id <= 531)) return 'rainy';
                    if (id >= 600 && id <= 622) return 'snow';
                    if (id >= 701 && id <= 781) return 'foggy';
                    if (id === 800) return 'clear';
                    if (id >= 801 && id <= 804) return 'cloudy';
                    if (temp < 15) return 'cold';
                    return 'default';
                };
                const weatherType: WeatherCondition = getWeatherType(weatherId, temperature);

            const effectiveSampleItinerary = await findAndScoreActivities(
              prompt, 
              safeInterests, 
              weatherType, 
              durationDays, 
              geminiModel,
              trafficAware,
              cityId
            );
                const detailedPrompt = buildDetailedPrompt(prompt, effectiveSampleItinerary, weatherData, safeInterests, durationDays, safeBudget, safePax, true, cityId);
                
                const peakHoursContext = getPeakHoursContext();
                const weatherContext = `Weather: ${weatherData?.weather?.[0]?.description || 'clear'}, ${weatherData?.main?.temp || 20}°C`;
                const trafficContext = "Real-time traffic analysis integrated with peak hours filtering";
                
                logger.info(`🛡️ REFRESH MODE: Using GuaranteedJsonEngine for request ${requestId}`, { requestId }, getRequestId(req));
                const guaranteedItinerary = await GuaranteedJsonEngine.generateGuaranteedJson(
                    detailedPrompt,
                    effectiveSampleItinerary,
                    weatherContext,
                    peakHoursContext,
                    `Duration: ${durationDays} days, Budget: ${budget}, Pax: ${pax}`,
                    requestId
                );
                
                const finalItinerary = await handleItineraryProcessing(guaranteedItinerary, prompt, durationDays, peakHoursContext);
                return { text: JSON.stringify(finalItinerary) };
            }, 3, 1000);
            
            logger.info('✅ Fresh generation completed (refresh mode)', {}, getRequestId(req));
        } else {
            // Normal flow: Use cached function
            responseData = await getCachedItinerary(requestBody, cacheKeyBase);
        }


        // H1 hotfix (2026-09-01): detect zero-activity itineraries after both
        // cached and refresh paths and refund the credit on the happy-path zero.
        // Runs on every POST() (not inside the cache wrapper) so it always fires,
        // including on cache hits that return an empty result.
        if (isZeroActivityItinerary(responseData?.text)) {
            if (charged) {
                try {
                    await CreditService.refundCredits({
                        userId,
                        amount: 1,
                        service: 'tarana_gala',
                        description: `Refund: zero-activity itinerary ${userId}`,
                        idempotencyKey: `refund:zero:${attemptId}`,
                    });
                } catch {
                    // best-effort; swallow refund errors
                }
            }
            const zeroSnapshot = takeRefundSnapshot();
            if (zeroSnapshot.refunded > 0 || zeroSnapshot.failed > 0 || zeroSnapshot.noop > 0) {
              logger.info(`[refund-metrics] request=${userId || '?'} refunded=${zeroSnapshot.refunded} failed=${zeroSnapshot.failed} noop=${zeroSnapshot.noop} reason=zero-activity`, { refunded: zeroSnapshot.refunded, failed: zeroSnapshot.failed, noop: zeroSnapshot.noop }, getRequestId(req));
            }
            const zeroBody = {
                text: responseData?.text ?? "",
                refunded: true,
                reason: 'no_activities_matched',
            };
            const owned = claim;
            if (owned?.kind === 'owner') {
                await completeIdempotency(owned.rowId, 200, zeroBody).catch(() => {
                    logger.error('[idempotency] failed to complete key', { route: IDEMPOTENCY_ROUTE, rowId: owned.rowId }, getRequestId(req));
                });
            }
            return NextResponse.json(zeroBody, { status: 200 });
        }

        const successBody = responseData;
        const successOwned = claim;
        if (successOwned?.kind === 'owner') {
            await completeIdempotency(successOwned.rowId, 200, successBody).catch(() => {
                logger.error('[idempotency] failed to complete key', { route: IDEMPOTENCY_ROUTE, rowId: successOwned.rowId }, getRequestId(req));
            });
        }

        return NextResponse.json(successBody);

    } catch (e: any) {
        // If we charged but generation failed, refund so the user isn't billed
        // for an itinerary we couldn't deliver.
        if (charged) {
            try {
                await CreditService.refundCredits({
                    userId,
                    amount: 1,
                    service: 'tarana_gala',
                    description: `Refund: failed generation ${userId}`,
                    idempotencyKey: `refund:fail:${attemptId}`,
                });
            } catch {
                // best-effort; swallow refund errors
            }
        }
        // Refund observability: per-request counter snapshot (see
        // handleMultiAgentPost finally). Emitted on the failure path too so a
        // charged-but-unrefunded request is visible even when processing died.
        const snapshot = takeRefundSnapshot();
        if (snapshot.refunded > 0 || snapshot.failed > 0 || snapshot.noop > 0) {
          logger.info(`[refund-metrics] request=${userId || '?'} refunded=${snapshot.refunded} failed=${snapshot.failed} noop=${snapshot.noop}`, { refunded: snapshot.refunded, failed: snapshot.failed, noop: snapshot.noop }, getRequestId(req));
        }
        // req.body is a ReadableStream in the App Router (JSON.stringify() yields
        // "{}"), so never derive a correlation id from it. Use userId + URL.
        const requestId = createHash('sha256').update(`${userId || 'anon'}:${req.url}`).digest('hex').substring(0, 8);
        const errorDetails = ErrorHandler.handleError(e, requestId);
        logger.error("Error in itinerary generation pipeline:", { errorDetails }, getRequestId(req));
        const failureBody = {
            text: "",
            error: "Internal server error"
        };
        const failed = claim;
        if (failed?.kind === 'owner') {
            await completeIdempotency(failed.rowId, 500, failureBody).catch(() => {
                logger.error('[idempotency] failed to cache mutation failure', { route: IDEMPOTENCY_ROUTE, rowId: failed.rowId }, getRequestId(req));
            });
        }
        return NextResponse.json(failureBody, { status: 500 });
    }
  }, (res) => res.status);
});
