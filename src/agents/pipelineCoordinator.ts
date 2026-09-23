import type { NextRequest } from "next/server";
import { ConciergeAgent } from "./conciergeAgent";
import { ContextScoutAgent } from "./contextScoutAgent";
import { RetrievalStrategistAgent } from "./retrievalStrategistAgent";
import { ItineraryComposerAgent } from "./itineraryComposerAgent";
import { CreditService } from "@/lib/referral-system";
import { benchBypassEnabled, configuredBenchUserId } from "@/lib/auth/benchToken";
import type { RequestSession } from "@/lib/agentic/sessionStore";
import { logger } from "@/lib/observability/logger";

export interface PipelineCoordinatorDeps {
  concierge: ConciergeAgent;
  contextScout: ContextScoutAgent;
  retrievalStrategist: RetrievalStrategistAgent;
  itineraryComposer: ItineraryComposerAgent;
  creditService?: {
    consumeCredits: (args: { userId: string; amount: number; service: string; description?: string }) => Promise<unknown>;
    refundCredits?: (args: {
      userId: string;
      amount: number;
      service: string;
      description?: string;
      idempotencyKey: string;
    }) => Promise<unknown>;
  };
}

export class PipelineCoordinator {
  constructor(private readonly deps: PipelineCoordinatorDeps) {}

  async handleRequest(request: NextRequest): Promise<RequestSession> {
    const init = await this.deps.concierge.initialize(request);
    let session = init.requestSession;

    // H2: charge-before - consume before any generation work (AGENTS.md) - skip for bench k6 user.
    // The exemption is gated on the bypass being active, not just id
    // equality: a bare UUID match with the bypass disabled must still pay.
    const isBenchUser = benchBypassEnabled() && session.userId === configuredBenchUserId();
    const creditService = this.deps.creditService ?? CreditService;
    let charged = false;
    if (!isBenchUser) {
      await creditService.consumeCredits({
      userId: session.userId,
      amount: 1,
      service: "tarana_gala",
      description: `Generated itinerary: ${session.prompt.substring(0, 50)}`,
      });
      charged = true;
    }

    try {
      session = this.deps.concierge.markInProgress(session.id);

      session = await this.deps.contextScout.execute(session, init.requestBody);
      session = await this.deps.retrievalStrategist.execute(session);
      session = await this.deps.itineraryComposer.execute(session);

      return session;
    } catch (error) {
      // Bookkeeping must never mask the refund below: isolate it so a
      // store failure still attempts the refund and preserves the error.
      try {
        this.deps.concierge.failSession(session.id, (error as Error).message, error);
      } catch (bookkeepingError) {
        logger.error(`Bookkeeping failed for session ${session.id} (refund still attempted)`, { error: bookkeepingError, sessionId: session.id }, "pipelineCoordinator");
      }
      if (charged && !isBenchUser) {
        try {
          // Prefer the injected seam (tests observe it); fall back to the
          // concrete service so older dep objects keep working.
          const refund =
            creditService.refundCredits?.bind(creditService) ?? CreditService.refundCredits;
          await refund({
            userId: session.userId,
            amount: 1,
            service: "tarana_gala",
            description: `Refund: multi-agent failed ${session.id}`,
            idempotencyKey: `refund:${session.id}`,
          });
          logger.info(`Multi-agent refund: 1 credit refunded to ${session.userId} (session ${session.id})`, { userId: session.userId, sessionId: session.id }, "pipelineCoordinator");
        } catch {
          // best-effort; swallow refund errors
        }
        (error as Error & { __galaRefunded?: boolean }).__galaRefunded = true;
      }
      throw error;
    }
  }
}
