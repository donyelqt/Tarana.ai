import { ContextScoutAgent } from "@/agents/contextScoutAgent";
import { createSession, resetStore, updateSession } from "@/lib/agentic/sessionStore";
import type { ConciergePayload } from "@/agents/conciergeAgent";

jest.mock("@/lib/traffic", () => ({
  getPeakHoursContext: jest.fn(() => "Peak hours info"),
  tomtomTrafficService: {
    getLocationTrafficData: jest.fn(),
  },
}));

jest.mock("@/lib/data", () => ({
  getActivityCoordinates: jest.fn((name: string) => {
    if (name === "Unknown") return null;
    return { lat: 16.4, lon: 120.6 };
  }),
}));

const { tomtomTrafficService, getPeakHoursContext } = jest.requireMock("@/lib/traffic");
const { getActivityCoordinates } = jest.requireMock("@/lib/data");

describe("ContextScoutAgent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  const weatherProvider = {
    getWeather: jest.fn(async () => ({
      weather: [{ description: "sunny" }],
      main: { temp: 24 },
    })),
  };

  const agent = new ContextScoutAgent({ weatherProvider, maxTrafficLocations: 2 });

  const baseSession = () =>
    createSession({
      userId: "user-1",
      prompt: "Plan",
      preferences: { interests: [], durationDays: null },
    });

  it("stores weather and traffic context", async () => {
    const session = baseSession();

    tomtomTrafficService.getLocationTrafficData.mockResolvedValue({
      trafficLevel: "LOW",
      recommendationScore: 0.9,
    });

    const requestBody: ConciergePayload = { prompt: "Trip" };

    const updated = await agent.execute(session, requestBody);

    expect(updated.context?.weather?.description).toBe("sunny");
    expect(updated.context?.traffic?.length).toBe(2);
    expect(updated.context?.traffic?.[0]?.trafficLevel).toBe("LOW");
    expect(getPeakHoursContext).toHaveBeenCalledTimes(1);
  });

  it("falls back to UNKNOWN traffic when API fails", async () => {
    const session = baseSession();
    tomtomTrafficService.getLocationTrafficData.mockRejectedValueOnce(new Error("fail"));
    tomtomTrafficService.getLocationTrafficData.mockResolvedValueOnce({
      trafficLevel: "MODERATE",
      recommendationScore: 0.5,
    });

    const updated = await agent.execute(session, { prompt: "Trip" });

    expect(updated.context?.traffic?.[0]?.trafficLevel).toBe("UNKNOWN");
    expect(updated.context?.traffic?.[1]?.trafficLevel).toBe("MODERATE");
  });
});
