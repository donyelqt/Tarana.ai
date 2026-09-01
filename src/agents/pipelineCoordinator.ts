import type { NextRequest } from "next/server";
import { ConciergeAgent } from "./conciergeAgent";
import { ContextScoutAgent } from "./contextScoutAgent";
import { RetrievalStrategistAgent } from "./retrievalStrategistAgent";
import { ItineraryComposerAgent } from "./itineraryComposerAgent";
import { CreditService } from "@/lib/referral-system";
import type { RequestSession } from "@/lib/agentic/sessionStore";

export interface PipelineCoordinatorDeps {
  concierge: ConciergeAgent;
  contextScout: ContextScoutAgent;
  retrievalStrategist: RetrievalStrategistAgent;
  itineraryComposer: ItineraryComposerAgent;
  creditService?: { consumeCredits: (args: { userId: string; amount: number; service: string; description?: string }) => Promise<unknown> };
}

export class PipelineCoordinator {
  constructor(private readonly deps: PipelineCoordinatorDeps) {}

  async handleRequest(request: NextRequest): Promise<RequestSession> {
    const init = await this.deps.concierge.initialize(request);
    let session = init.requestSession;

    // H2: charge-before - consume before any generation work (AGENTS.md)
    const creditService = this.deps.creditService ?? CreditService;
    await creditService.consumeCredits({
      userId: session.userId,
      amount: 1,
      service: "tarana_gala",
      description: `Generated itinerary: ${session.prompt.substring(0, 50)}`,
    });

    try {
      session = this.deps.concierge.markInProgress(session.id);

      session = await this.deps.contextScout.execute(session, init.requestBody);
      session = await this.deps.retrievalStrategist.execute(session);
      session = await this.deps.itineraryComposer.execute(session);

      return session;
    } catch (error) {
      this.deps.concierge.failSession(session.id, (error as Error).message, error);
      throw error;
    }
  }
}
