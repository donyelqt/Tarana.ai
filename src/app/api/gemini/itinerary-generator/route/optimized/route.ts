/**
 * Ultra-Fast Optimized Itinerary Generation Route
 * Enterprise-grade performance with 3-5x speed improvements
 *
 * @author Doniele Arys Antonio
 * @version 3.0.0
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { optimizedPipeline } from "@/lib/performance/optimizedPipeline";
import { smartCacheManager } from "@/lib/performance/smartCacheManager";
import { ErrorHandler, ErrorType, ItineraryError } from "../../lib/errorHandler";
import { API_KEY, geminiModel } from "../../lib/config";
import { CreditService, InsufficientCreditsError } from "@/lib/referral-system";
import { withAuth, getUserId, unauthorized } from "@/lib/auth/withAuth";

// Ultra-fast cache with aggressive optimization
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes for faster updates
const REQUEST_TIMEOUT = 15000; // 15 seconds max
const MAX_CONCURRENT_REQUESTS = 8; // Hard cap on in-flight generations per instance

// Request deduplication map
const activeRequests = new Map<string, Promise<any>>();
// True count of in-flight generations (excludes dedup reuses and the 5s cleanup
// window) so the concurrency cap reflects real load, not stale map entries.
let activeGenerations = 0;

/**
 * Ultra-fast cached itinerary generation
 */
async function generateOptimizedItinerary(requestBody: any, requestId: string) {
  return await ErrorHandler.withRetry(async () => {
    const { prompt, weatherData, interests, duration, budget, pax } = requestBody;

    if (!geminiModel) {
      throw new ItineraryError(ErrorType.GENERATION, "Gemini model not available", false, requestId);
    }

    // Parse duration efficiently
    const durationDays = duration ? parseInt(duration.toString().match(/\d+/)?.[0] || '1', 10) : null;

    // Execute optimized pipeline
    const { itinerary, metrics } = await optimizedPipeline.generateOptimized({
      prompt,
      interests: Array.isArray(interests) ? interests : [],
      weatherData,
      durationDays,
      budget: budget || 'mid-range',
      pax: pax || '2',
      model: geminiModel
    });

    console.log(`OPTIMIZED GENERATION: Completed in ${metrics.totalTime}ms with ${metrics.performance.efficiency}% efficiency`);

    return {
      text: JSON.stringify(itinerary),
      metrics,
      cached: false,
      requestId
    };
  }, 2, 500); // Reduced retries and delay for faster response
}

export const POST = withAuth(async (req: NextRequest, userId: string) => {
  const requestStartTime = Date.now();

  try {
    const requestBody = await req.json();
    const { prompt } = requestBody;

    // Fail-closed credit gate: never generate without a deductible balance.
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

    // Validate API key
    if (!API_KEY) {
      console.error("GOOGLE_GEMINI_API_KEY is missing!");
      return NextResponse.json({
        text: "",
        error: "GOOGLE_GEMINI_API_KEY is missing on the server."
      }, { status: 500 });
    }

    // Validate prompt
    if (!prompt) {
      return NextResponse.json({
        error: "Prompt is required"
      }, { status: 400 });
    }

    // Generate stable request ID for deduplication
    const serializedBody = JSON.stringify(requestBody);
    const requestHash = createHash('sha256').update(`${userId}:${serializedBody}`).digest('hex');
    const requestId = requestHash.substring(0, 8);
    const dedupeKey = `${userId}:${requestHash}`;

    // Check for duplicate concurrent requests
    if (activeRequests.has(dedupeKey)) {
      console.log(`DEDUPLICATION: Using existing request for "${prompt}"`);
      const result = await activeRequests.get(dedupeKey)!;
      return NextResponse.json({
        ...result,
        fromCache: true,
        deduplication: true
      });
    }

    // Check smart cache first
    const cacheKey = `optimized:${userId}:${requestHash}`;
    const cachedResult = smartCacheManager.get(cacheKey);

    if (cachedResult) {
      const cacheTime = Date.now() - requestStartTime;
      console.log(`CACHE HIT: Returned cached result in ${cacheTime}ms`);

      // Charge for serving a cached result too. The cache is per-user, so a
      // repeat within TTL is still a served request and must deduct a credit;
      // otherwise the 3-minute TTL is a free-generation loophole. If the user
      // has no credit, the consume throws and the outer catch returns 402.
      await CreditService.consumeCredits({
        userId,
        amount: 1,
        service: 'tarana_gala',
        description: `Cached itinerary: ${prompt?.substring(0, 50) || 'Itinerary generation'}`
      });

      return NextResponse.json({
        ...cachedResult,
        fromCache: true,
        responseTime: cacheTime
      });
    }

    // Enforce per-instance concurrency cap using the true in-flight count.
    // Duplicate requests (handled above) reuse an in-flight promise and don't count.
    if (activeGenerations >= MAX_CONCURRENT_REQUESTS) {
      console.warn(`CONCURRENCY CAP: Rejecting request, ${activeGenerations} in-flight (max ${MAX_CONCURRENT_REQUESTS})`);
      return NextResponse.json(
        { error: "Server is busy, please try again in a moment." },
        { status: 429, headers: { "Retry-After": "2" } }
      );
    }

    // Reserve the dedup slot up front so a concurrent identical request collapses
    // onto this single generation (and is charged exactly once).
    let charged = false;
    const generationPromise = (async () => {
      // Charge BEFORE generating. consumeCredits is an atomic check-and-deduct
      // RPC, so two concurrent same-user requests are serialized: the first
      // deducts and proceeds, the second sees remainingToday = 0 and throws
      // InsufficientCreditsError -> 402 with NO wasted Gemini compute (TOCTOU fix).
      await CreditService.consumeCredits({
        userId,
        amount: 1,
        service: 'tarana_gala',
        description: `Generated itinerary: ${prompt?.substring(0, 50) || 'Itinerary generation'}`
      });
      charged = true;

      return Promise.race([
        generateOptimizedItinerary(requestBody, requestId),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT)
        )
      ]) as Promise<any>;
    })();

    // Store in active requests for deduplication
    activeRequests.set(dedupeKey, generationPromise);
    activeGenerations++;

    try {
      // Execute optimized generation (charge already happened inside the promise)
      const result = await generationPromise;

      // Cache the result for future requests
      smartCacheManager.set(cacheKey, result, CACHE_TTL);

      const totalTime = Date.now() - requestStartTime;
      console.log(`OPTIMIZED ROUTE: Total request time ${totalTime}ms`);

      return NextResponse.json({
        ...result,
        responseTime: totalTime,
        optimized: true
      });

    } catch (genError: any) {
      // We charged but failed to deliver a result: refund so the user is not
      // billed for a generation that errored out (timeout, Gemini failure, etc).
      // If charged is false the consume itself failed, so nothing to refund.
      if (charged) {
        await CreditService.refundCredits({
          userId,
          amount: 1,
          service: 'tarana_gala',
          description: `Refund: failed generation ${requestId}`
        });
      }
      throw genError;
    } finally {
      // Clean up active request and decrement the true in-flight counter.
      activeGenerations = Math.max(0, activeGenerations - 1);
      setTimeout(() => activeRequests.delete(dedupeKey), 5000);
    }

  } catch (e: any) {
    if (e instanceof InsufficientCreditsError) {
      return NextResponse.json({
        error: "Insufficient credits",
        text: "",
        required: e.required,
        available: e.available
      }, { status: 402 });
    }

    // req.body is a ReadableStream in the App Router (JSON.stringify() yields "{}"),
    // so never derive a correlation id from it. Use the stable userId + URL instead.
    const requestId = createHash('sha256')
      .update(`${userId || 'anon'}:${req.url}`)
      .digest('hex')
      .substring(0, 8);
    const errorDetails = ErrorHandler.handleError(e, requestId);

    console.error("Error in optimized itinerary generation:", errorDetails);

    return NextResponse.json({
      text: "",
      error: errorDetails.message,
      errorType: errorDetails.type,
      requestId: errorDetails.requestId,
      retryable: errorDetails.retryable,
      optimized: false
    }, { status: 500 });
  }
});

/**
 * Health check endpoint for monitoring
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  if (action === 'clear-cache') {
    // Destructive operation: require an authenticated session.
    const userId = await getUserId(req);
    if (!userId) return unauthorized();

    smartCacheManager.clearAll();
    activeRequests.clear();
    activeGenerations = 0;

    return NextResponse.json({
      message: "Cache cleared successfully",
      timestamp: new Date().toISOString()
    });
  }

  if (action === 'health') {
    const health = optimizedPipeline.getHealthMetrics();
    const cacheStats = smartCacheManager.getStats();

    return NextResponse.json({
      status: health.status,
      pipeline: health,
      cache: {
        hitRate: Math.round(cacheStats.hitRate * 100),
        totalEntries: cacheStats.totalEntries,
        averageResponseTime: Math.round(cacheStats.averageResponseTime)
      },
      timestamp: new Date().toISOString()
    });
  }

  if (action === 'metrics') {
    const cacheStats = smartCacheManager.getStats();

    return NextResponse.json({
      cache: cacheStats,
      activeRequests: activeGenerations,
      performance: {
        averageResponseTime: Math.round(cacheStats.averageResponseTime),
        hitRate: Math.round(cacheStats.hitRate * 100),
        totalRequests: cacheStats.hits + cacheStats.misses
      },
      timestamp: new Date().toISOString()
    });
  }

  return NextResponse.json({
    message: "Optimized Itinerary Generation API",
    version: "3.0.0",
    endpoints: {
      generate: "POST /",
      health: "GET /?action=health",
      metrics: "GET /?action=metrics",
      clearCache: "GET /?action=clear-cache (auth required)"
    },
    optimizations: [
      "Ultra-fast activity search",
      "Parallel traffic processing",
      "Smart multi-tier caching",
      "Request deduplication",
      "Geographic clustering",
      "Predictive cache warming"
    ]
  });
}
