import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth/auth";
import { CreditService, InsufficientCreditsError, type CreditBalance } from "@/lib/referral-system";
import { createSession, updateSession, appendError, type RequestSession, type RequestPreferences, type GeneratedItinerary } from "@/lib/agentic/sessionStore";
import { resolveBenchUserId, BENCH_TOKEN_HEADER } from "@/lib/auth/benchToken";
import { z } from "zod";
import { logger } from "@/lib/observability/logger";

export type ConciergePayload = {
  prompt: string;
  interests?: string[];
  duration?: string | number | null;
  budget?: string | number | null;
  pax?: string | number | null;
  weatherData?: unknown;
  cityId?: string;
};

export interface ConciergeDependencies {
  requestSchema: z.ZodType<ConciergePayload>;
}

export interface ConciergeInitializeResult {
  authSession: Session;
  creditBalance?: CreditBalance;
  requestBody: ConciergePayload;
  requestSession: RequestSession;
}

export class ConciergeAgent {
  constructor(private readonly deps: ConciergeDependencies) {}

  async initialize(request: NextRequest): Promise<ConciergeInitializeResult> {
    // Bench bypass for k6 (non-prod only): per-request HMAC proof, not a
    // guessable static header. See benchToken.ts for the wire format.
    const benchUserId = resolveBenchUserId(request.headers.get(BENCH_TOKEN_HEADER));
    if (benchUserId !== null) {
      const rawBody = await request.clone().json().catch(() => ({} as any));
      const parsed = this.deps.requestSchema.safeParse(rawBody);
      if (!parsed.success) throw this.formatSchemaError(parsed.error);
      const preferences = this.extractPreferences(parsed.data);
      const session = createSession({
        userId: benchUserId,
        prompt: parsed.data.prompt,
        preferences,
        status: "pending",
      });
      return {
        authSession: { user: { id: session.userId, name: "Bench User", email: "bench@tarana.ai" } } as any,
        creditBalance: undefined,
        requestBody: parsed.data,
        requestSession: session,
      };
    }
    const authSession = await getServerSession(authOptions);
    if (!authSession?.user?.id) {
      throw new Error("Authentication required");
    }

    const rawBody = await request.json();
    const parsed = this.deps.requestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw this.formatSchemaError(parsed.error);
    }

    const creditBalance = await this.getCreditBalance(authSession.user.id);
    // The bench path returns before this point, so any request reaching
    // here pays the normal credit gate — no second bypass check needed.
    if (creditBalance && creditBalance.remainingToday < 1) {
      throw new InsufficientCreditsError(1, creditBalance.remainingToday, "tarana_gala");
    }

    const preferences: RequestPreferences = this.extractPreferences(parsed.data);

    const session = createSession({
      userId: authSession.user.id,
      prompt: parsed.data.prompt,
      preferences,
      status: "pending",
    });

    return {
      authSession,
      creditBalance,
      requestBody: parsed.data,
      requestSession: session,
    };
  }

  markInProgress(sessionId: string): RequestSession {
    return updateSession(sessionId, { status: "in_progress" });
  }

  markCompleted(sessionId: string, itinerary: GeneratedItinerary): RequestSession {
    return updateSession(sessionId, {
      itinerary,
      status: "completed",
    });
  }

  failSession(sessionId: string, message: string, detail?: unknown): RequestSession {
    return appendError(sessionId, {
      agent: "concierge",
      stage: "fatal",
      message,
      detail,
      timestamp: Date.now(),
    });
  }

  private async getCreditBalance(userId: string) {
    try {
      return await CreditService.getCurrentBalance(userId);
    } catch (error) {
      logger.warn("[ConciergeAgent] credit check failed", { entryPoint: "conciergeAgent", error });
      return undefined;
    }
  }

  private extractPreferences(data: ConciergePayload): RequestPreferences {
    const durationValue = data.duration != null ? String(data.duration) : null;
    const durationMatch = durationValue ? durationValue.match(/\d+/) : null;
    const durationDays = durationMatch ? parseInt(durationMatch[0], 10) : null;

    const interests: string[] = Array.isArray(data.interests) ? data.interests : [];

    return {
      interests,
      durationDays,
      budget: data.budget != null ? String(data.budget) : undefined,
      pax: data.pax != null ? String(data.pax) : undefined,
      cityId: typeof (data as any).cityId === "string" ? (data as any).cityId : "baguio",
    };
  }

  private formatSchemaError(error: z.ZodError): Error {
    const formatted = error.flatten();
    const details = Object.entries(formatted.fieldErrors).reduce<Record<string, string[]>>((acc, [key, value]) => {
      if (Array.isArray(value) && value.length > 0) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, string[]>);

    const err = new Error("Invalid request payload");
    (err as Error & { details?: Record<string, string[]> }).details = details;
    return err;
  }
}
