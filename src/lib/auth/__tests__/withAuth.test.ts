import type { NextRequest } from "next/server";
import { withAuth } from "../withAuth";

// House convention (see register route tests): jsdom lacks Response.json,
// which NextResponse.json calls internally. Polyfill it when missing.
const MockedResponse = globalThis.Response as unknown as {
  new (body?: unknown, init?: any): any;
  json(body: unknown, init?: any): any;
};
if (typeof MockedResponse.json !== "function") {
  MockedResponse.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponse(JSON.stringify(body), { status: init?.status ?? 200 });
}

jest.mock("next-auth", () => ({
  getServerSession: jest.fn().mockResolvedValue(null),
}));

const TEST_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef";

const stakeRequest = (token: string | null) =>
  ({
    headers: { get: jest.fn((name: string) => (name === "x-bench-token" ? token : null)) },
  } as unknown as NextRequest);

describe("withAuth bench bypass", () => {
  const OLD_ENV = { ...process.env };

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

  it("passes the bench user id to the handler on a valid token", async () => {
    const { computeBenchToken, currentWindowIndex } = await import("../benchToken");
    const w = currentWindowIndex(Date.now());
    const token = `${w}:${computeBenchToken(TEST_SECRET, w)}`;
    const handler = jest.fn(async (_req: NextRequest, userId: string) => ({ userId }) as any);

    const res: any = await withAuth(handler)(stakeRequest(token));

    expect(res.userId).toBe("00000000-0000-0000-0000-000000000001");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("ignores the retired static header and rejects without a session", async () => {
    const handler = jest.fn();
    const req = {
      headers: { get: jest.fn((name: string) => (name === "x-bench-bypass" ? "true" : null)) },
    } as unknown as NextRequest;

    const res = await withAuth(handler)(req);

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
  });
});
