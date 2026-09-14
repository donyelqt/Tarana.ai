import { z } from "zod";
import type { NextRequest } from "next/server";
import { ConciergeAgent } from "@/agents/conciergeAgent";
import { resetStore } from "@/lib/agentic/sessionStore";
import type { CreditBalance } from "@/lib/referral-system";
import { getServerSession } from "next-auth";
import { CreditService, InsufficientCreditsError } from "@/lib/referral-system";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/referral-system", () => {
  const actual = jest.requireActual("@/lib/referral-system");
  return {
    ...actual,
    CreditService: {
      getCurrentBalance: jest.fn(),
    },
  };
});

type MockedRequest = NextRequest & { json: jest.Mock<Promise<unknown>, []> };

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockGetCurrentBalance = CreditService.getCurrentBalance as jest.Mock;

const requestSchema = z
  .object({
    prompt: z.string(),
    duration: z.union([z.string(), z.number()]).optional(),
    interests: z.array(z.string()).optional(),
    budget: z.union([z.string(), z.number()]).optional(),
    pax: z.union([z.string(), z.number()]).optional(),
    weatherData: z.any().optional(),
  })
  .passthrough();

const createRequest = (body: unknown): MockedRequest =>
  ({
    json: jest.fn().mockResolvedValue(body),
    headers: { get: jest.fn().mockReturnValue(null), has: jest.fn().mockReturnValue(false) } as unknown as Headers,
    clone: jest.fn().mockReturnValue({ json: jest.fn().mockResolvedValue(body) } as unknown as Request),
  } as unknown as MockedRequest);

describe("ConciergeAgent", () => {
  let agent: ConciergeAgent;
  const creditBalance: CreditBalance = {
    totalCredits: 5,
    usedToday: 0,
    remainingToday: 3,
    tier: "Default",
    nextRefresh: new Date(),
    dailyLimit: 5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    agent = new ConciergeAgent({ requestSchema });
  });

  it("initializes session when request payload is valid", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-123" } } as any);
    mockGetCurrentBalance.mockResolvedValue(creditBalance);

    const body = { prompt: "Plan a trip", interests: ["food"], duration: "2 days" };
    const request = createRequest(body);

    const result = await agent.initialize(request);

    expect(result.authSession.user?.id).toBe("user-123");
    expect(result.requestSession.userId).toBe("user-123");
    expect(result.requestSession.preferences.interests).toEqual(["food"]);
    expect(request.json).toHaveBeenCalledTimes(1);
  });

  it("marks session as in progress", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-789" } } as any);
    mockGetCurrentBalance.mockResolvedValue(creditBalance);

    const request = createRequest({ prompt: "Trip", interests: [] });
    const { requestSession } = await agent.initialize(request);

    const updated = agent.markInProgress(requestSession.id);
    expect(updated.status).toBe("in_progress");
  });

  it("throws InsufficientCreditsError when user has no credits", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-456" } } as any);
    mockGetCurrentBalance.mockResolvedValue({
      ...creditBalance,
      remainingToday: 0,
    });

    const request = createRequest({ prompt: "Trip" });

    await expect(agent.initialize(request)).rejects.toBeInstanceOf(InsufficientCreditsError);
  });

  it("propagates schema validation errors", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-000" } } as any);
    mockGetCurrentBalance.mockResolvedValue(creditBalance);

    const invalidRequest = createRequest({ prompt: 123 });

    await expect(agent.initialize(invalidRequest)).rejects.toThrow("Invalid request payload");
  });

  describe("HMAC bench bypass", () => {
    const TEST_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef";
    const OLD_ENV = { ...process.env };

    const benchRequest = (token: string | null) => {
      const body = { prompt: "Trip" };
      const get = jest.fn((name: string) => (name === "x-bench-token" ? token : null));
      return {
        json: jest.fn().mockResolvedValue(body),
        headers: { get, has: jest.fn().mockReturnValue(token !== null) } as unknown as Headers,
        clone: jest.fn().mockReturnValue({ json: jest.fn().mockResolvedValue(body) } as unknown as Request),
      } as unknown as MockedRequest;
    };

    beforeEach(() => {
      process.env = {
        ...OLD_ENV,
        NODE_ENV: "test",
        BENCH_BYPASS_AUTH: "true",
        BENCH_HMAC_SECRET: TEST_SECRET,
      } as NodeJS.ProcessEnv;
    });

    afterAll(() => {
      process.env = OLD_ENV;
    });

    it("accepts a fresh HMAC token without touching NextAuth", async () => {
      const { computeBenchToken, currentWindowIndex } = await import("@/lib/auth/benchToken");
      const token = `${currentWindowIndex(Date.now())}:${computeBenchToken(TEST_SECRET, currentWindowIndex(Date.now()))}`;

      const result = await agent.initialize(benchRequest(token));

      expect(mockGetServerSession).not.toHaveBeenCalled();
      expect(result.requestSession.userId).toBe("00000000-0000-0000-0000-000000000001");
      expect(result.requestBody.prompt).toBe("Trip");
    });

    it("ignores a wrong-secret token and falls through to real auth", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const { computeBenchToken, currentWindowIndex } = await import("@/lib/auth/benchToken");
      const token = `${currentWindowIndex(Date.now())}:${computeBenchToken("ffffffffffffffffffffffffffffffffffffffff", currentWindowIndex(Date.now()))}`;

      await expect(agent.initialize(benchRequest(token))).rejects.toThrow("Authentication required");
      expect(mockGetServerSession).toHaveBeenCalled();
    });

    it("ignores the retired static x-bench-bypass header", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const body = { prompt: "Trip" };
      const get = jest.fn((name: string) => (name === "x-bench-bypass" ? "true" : null));
      const request = {
        json: jest.fn().mockResolvedValue(body),
        headers: { get, has: jest.fn().mockReturnValue(true) } as unknown as Headers,
        clone: jest.fn().mockReturnValue({ json: jest.fn().mockResolvedValue(body) } as unknown as Request),
      } as unknown as MockedRequest;

      await expect(agent.initialize(request)).rejects.toThrow("Authentication required");
      expect(mockGetServerSession).toHaveBeenCalled();
    });
  });
});
