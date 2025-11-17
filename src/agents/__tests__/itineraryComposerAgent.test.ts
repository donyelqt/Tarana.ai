import { ItineraryComposerAgent } from "@/agents/itineraryComposerAgent";
import { createSession, resetStore, updateSession } from "@/lib/agentic/sessionStore";
import { GuaranteedJsonEngine } from "@/app/api/gemini/itinerary-generator/lib/guaranteedJsonEngine";
import { handleItineraryProcessing } from "@/app/api/gemini/itinerary-generator/lib/responseHandler";
import { buildDetailedPrompt } from "@/app/api/gemini/itinerary-generator/lib/contextBuilder";

jest.mock("@/app/api/gemini/itinerary-generator/lib/contextBuilder", () => ({
  buildDetailedPrompt: jest.fn(() => "COMPOSED_PROMPT"),
}));

jest.mock("@/app/api/gemini/itinerary-generator/lib/guaranteedJsonEngine", () => ({
  GuaranteedJsonEngine: {
    generateGuaranteedJson: jest.fn(),
  },
}));

jest.mock("@/app/api/gemini/itinerary-generator/lib/responseHandler", () => ({
  handleItineraryProcessing: jest.fn(),
}));

describe("ItineraryComposerAgent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  const agent = new ItineraryComposerAgent();

  const baseSession = () =>
    createSession({
      userId: "user-1",
      prompt: "Plan",
      preferences: {
        interests: ["nature"],
        durationDays: 2,
        budget: "3000",
        pax: "2",
      },
      retrieval: {
        candidates: [],
        expandedQueries: [],
        coverageScore: 1,
        metadata: {
          sampleItinerary: { id: "sample" },
        },
      },
      context: {
        weather: { description: "clear", temperatureC: 22, raw: {} },
        peakHoursContext: "peak",
      },
    });

  it("composes itinerary using guaranteed engine", async () => {
    const session = baseSession();

    (GuaranteedJsonEngine.generateGuaranteedJson as jest.Mock).mockResolvedValue({ structured: true });
    (handleItineraryProcessing as jest.Mock).mockResolvedValue({ title: "Final" });

    const updated = await agent.execute(session);

    expect(buildDetailedPrompt).toHaveBeenCalled();
    expect(GuaranteedJsonEngine.generateGuaranteedJson).toHaveBeenCalledWith(
      "COMPOSED_PROMPT",
      { id: "sample" },
      expect.any(String),
      "peak",
      expect.any(String),
      session.id
    );
    expect(handleItineraryProcessing).toHaveBeenCalledWith({ structured: true }, "Plan", 2, "peak");
    expect(updated.itinerary?.json).toEqual({ title: "Final" });
    expect(updated.status).toBe("completed");
  });

  it("throws when sample itinerary missing", async () => {
    const session = baseSession();
    const broken = updateSession(session.id, {
      retrieval: {
        candidates: [],
        expandedQueries: [],
        coverageScore: 0,
        metadata: {},
      },
    });

    await expect(agent.execute(broken)).rejects.toThrow("Sample itinerary not available");
  });
});
