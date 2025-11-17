import { RetrievalStrategistAgent } from "@/agents/retrievalStrategistAgent";
import { createSession, resetStore } from "@/lib/agentic/sessionStore";
import { findAndScoreActivities } from "@/app/api/gemini/itinerary-generator/lib/activitySearch";

jest.mock("@/app/api/gemini/itinerary-generator/lib/activitySearch", () => ({
  findAndScoreActivities: jest.fn(),
}));

const mockFindAndScoreActivities = findAndScoreActivities as jest.Mock;

describe("RetrievalStrategistAgent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  const agent = () => new RetrievalStrategistAgent({ geminiModel: {} });

  it("stores ranked activities from search results", async () => {
    const session = createSession({
      userId: "user-1",
      prompt: "Plan a trip",
      preferences: { interests: ["food"], durationDays: 2 },
      context: {
        weather: {
          raw: {
            weather: [{ id: 801 }],
            main: { temp: 25 },
          },
          description: "cloudy",
          temperatureC: 25,
        },
      },
    });

    mockFindAndScoreActivities.mockResolvedValue({
      searchMetadata: {
        allowedActivities: [
          { title: "A", relevanceScore: 0.9, tags: ["food"] },
          { title: "B" },
        ],
      },
    });

    const updated = await agent().execute(session);

    expect(updated.retrieval?.candidates).toHaveLength(2);
    expect(updated.retrieval?.candidates[0]).toMatchObject({ title: "A", score: 0.9 });
    expect(mockFindAndScoreActivities).toHaveBeenCalledWith(
      session.prompt,
      session.preferences.interests,
      "cloudy",
      session.preferences.durationDays,
      {}
    );
  });

  it("propagates errors when search fails", async () => {
    const session = createSession({
      userId: "user-2",
      prompt: "Plan",
      preferences: { interests: [], durationDays: null },
    });

    mockFindAndScoreActivities.mockRejectedValue(new Error("search failed"));

    await expect(agent().execute(session)).rejects.toThrow("search failed");
  });
});
