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
      {},
      true,
      "baguio"
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

  describe("decideStrategy", () => {
    const prefs = (cityId: string | undefined, interests: string[]) =>
      createSession({
        userId: "user-s",
        prompt: "Plan",
        preferences: { interests, durationDays: 1, cityId },
      });

    it("picks curated for Baguio with no interests", () => {
      expect(agent().decideStrategy(prefs("baguio", []))).toMatchObject({ strategy: "curated" });
    });

    it("picks interest-first for Baguio with stated interests", () => {
      expect(agent().decideStrategy(prefs("baguio", ["food"]))).toMatchObject({
        strategy: "interest-first",
      });
    });

    it("picks tomtom-live for strict-city members with or without interests", () => {
      for (const cityId of ["cebu", "manila", "davao", "boracay", "el_nido"]) {
        expect(agent().decideStrategy(prefs(cityId, [])).strategy).toBe("tomtom-live");
        expect(agent().decideStrategy(prefs(cityId, ["food"])).strategy).toBe("tomtom-live");
      }
    });

    it("picks honest-empty for scopes with no pool instead of borrowing another city", () => {
      for (const cityId of ["ph-wide", "world", "paris"]) {
        expect(agent().decideStrategy(prefs(cityId, ["food"])).strategy).toBe("honest-empty");
      }
    });

    it("defaults a missing city to baguio rather than going empty", () => {
      expect(agent().decideStrategy(prefs(undefined, ["food"])).strategy).toBe("interest-first");
      expect(agent().decideStrategy(prefs(undefined, [])).strategy).toBe("curated");
    });

    it("treats blank interest rows as no interests", () => {
      expect(agent().decideStrategy(prefs("baguio", ["", "  "])).strategy).toBe("curated");
    });
  });

  it("records the decision and the observed search method in the session", async () => {
    const session = createSession({
      userId: "user-3",
      prompt: "Plan",
      preferences: { interests: ["food"], durationDays: 1, cityId: "cebu" },
    });
    mockFindAndScoreActivities.mockResolvedValue({
      searchMetadata: { searchMethod: "tomtom_strict", allowedActivities: [] },
    });

    const updated = await agent().execute(session);

    expect(updated.retrieval?.expandedQueries).toEqual(["tomtom-live"]);
    expect(updated.retrieval?.metadata).toMatchObject({
      strategy: "tomtom-live",
      strategyReason: expect.any(String),
      observedSearchMethod: "tomtom_strict",
    });
  });
});
