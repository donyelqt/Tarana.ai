import { buildDetailedPrompt } from "@/app/api/gemini/itinerary-generator/lib/contextBuilder";
import { GuaranteedJsonEngine } from "@/app/api/gemini/itinerary-generator/lib/guaranteedJsonEngine";
import { handleItineraryProcessing } from "@/app/api/gemini/itinerary-generator/lib/responseHandler";
import { getPeakHoursContext } from "@/lib/traffic";
import {
  updateSession,
  appendError,
  type RequestSession,
  type GeneratedItinerary,
} from "@/lib/agentic/sessionStore";

export class ItineraryComposerAgent {
  async execute(session: RequestSession): Promise<RequestSession> {
    try {
      const sampleItinerary = session.retrieval?.metadata?.sampleItinerary;
      if (!sampleItinerary) {
        throw new Error("Sample itinerary not available in session retrieval metadata");
      }

      const detailedPrompt = buildDetailedPrompt(
        session.prompt,
        sampleItinerary,
        session.context?.weather?.raw ?? null,
        session.preferences.interests,
        session.preferences.durationDays,
        session.preferences.budget,
        session.preferences.pax
      );

      const weatherContext = this.composeWeatherContext(session);
      const peakHoursContext = session.context?.peakHoursContext ?? getPeakHoursContext();
      const additionalContext = this.composeAdditionalContext(session);

      const guaranteed = await GuaranteedJsonEngine.generateGuaranteedJson(
        detailedPrompt,
        sampleItinerary,
        weatherContext,
        peakHoursContext,
        additionalContext,
        session.id
      );

      const finalItinerary = await handleItineraryProcessing(
        guaranteed,
        session.prompt,
        session.preferences.durationDays,
        peakHoursContext
      );

      const itinerary: GeneratedItinerary = {
        json: finalItinerary,
        prompt: detailedPrompt,
        rawModelResponse: JSON.stringify(guaranteed),
      };

      return updateSession(session.id, {
        itinerary,
        status: "completed",
      });
    } catch (error) {
      appendError(session.id, {
        agent: "itinerary-composer",
        stage: "fatal",
        message: "Failed to compose itinerary",
        detail: error,
        timestamp: Date.now(),
      });
      throw error;
    }
  }

  private composeWeatherContext(session: RequestSession): string {
    const description = session.context?.weather?.description ?? "clear";
    const temp = session.context?.weather?.temperatureC ?? 20;
    return `Weather: ${description}, ${temp}°C`;
  }

  private composeAdditionalContext(session: RequestSession): string {
    const duration = session.preferences.durationDays;
    const budget = session.preferences.budget ?? "unspecified";
    const pax = session.preferences.pax ?? "unspecified";
    return `Duration: ${duration ?? "unknown"} days, Budget: ${budget}, Pax: ${pax}`;
  }
}
