import {
  BENCH_TOKEN_HEADER,
  benchBypassEnabled,
  computeBenchToken,
  configuredBenchUserId,
  currentWindowIndex,
  resolveBenchUserId,
  verifyBenchToken,
} from "../benchToken";

const TEST_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef";

// Fixed clock: 2026-09-14T00:00:00Z.
const FIXED_NOW = 1788998400000;

describe("benchToken", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, NODE_ENV: "test" } as NodeJS.ProcessEnv;
    delete process.env.BENCH_BYPASS_AUTH;
    delete process.env.BENCH_HMAC_SECRET;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  const enableWith = (secret: string) => {
    process.env.BENCH_BYPASS_AUTH = "true";
    process.env.BENCH_HMAC_SECRET = secret;
  };

  const tokenFor = (windowIndex: number, secret: string = TEST_SECRET) =>
    `${windowIndex}:${computeBenchToken(secret, windowIndex)}`;

  it("accepts a token for the current window", () => {
    enableWith(TEST_SECRET);
    const w = currentWindowIndex(FIXED_NOW);
    expect(verifyBenchToken(tokenFor(w), FIXED_NOW)).toBe(true);
  });

  it("accepts a token for the immediately previous window (clock tolerance)", () => {
    enableWith(TEST_SECRET);
    const w = currentWindowIndex(FIXED_NOW);
    expect(verifyBenchToken(tokenFor(w - 1), FIXED_NOW)).toBe(true);
  });

  it("rejects a token signed with the wrong secret", () => {
    enableWith(TEST_SECRET);
    const w = currentWindowIndex(FIXED_NOW);
    expect(verifyBenchToken(tokenFor(w, "ffffffffffffffffffffffffffffffffffffffff"), FIXED_NOW)).toBe(false);
  });

  it("rejects an expired window", () => {
    enableWith(TEST_SECRET);
    const w = currentWindowIndex(FIXED_NOW);
    expect(verifyBenchToken(tokenFor(w - 2), FIXED_NOW)).toBe(false);
  });

  it("rejects malformed tokens without throwing", () => {
    enableWith(TEST_SECRET);
    expect(verifyBenchToken(null, FIXED_NOW)).toBe(false);
    expect(verifyBenchToken("", FIXED_NOW)).toBe(false);
    expect(verifyBenchToken("not-a-token", FIXED_NOW)).toBe(false);
    expect(verifyBenchToken("12:xyz", FIXED_NOW)).toBe(false);
    expect(verifyBenchToken("12:zz", FIXED_NOW)).toBe(false);
  });

  it("is disabled when the env switch is off, even with a valid token", () => {
    process.env.BENCH_HMAC_SECRET = TEST_SECRET;
    const w = currentWindowIndex(FIXED_NOW);
    expect(verifyBenchToken(tokenFor(w), FIXED_NOW)).toBe(false);
  });

  it("is fail-closed on a short secret", () => {
    process.env.BENCH_BYPASS_AUTH = "true";
    process.env.BENCH_HMAC_SECRET = "too-short";
    const w = currentWindowIndex(FIXED_NOW);
    // Signed with the short secret an operator mistakenly configured...
    const forged = `${w}:${computeBenchToken("too-short", w)}`;
    expect(verifyBenchToken(forged, FIXED_NOW)).toBe(false);
    expect(benchBypassEnabled()).toBe(false);
  });

  it("is disabled in production regardless of configuration", () => {
    (process.env as any).NODE_ENV = "production";
    enableWith(TEST_SECRET);
    const w = currentWindowIndex(Date.now());
    expect(verifyBenchToken(tokenFor(w, TEST_SECRET), Date.now())).toBe(false);
  });

  it("exposes a stable header name", () => {
    expect(BENCH_TOKEN_HEADER).toBe("x-bench-token");
  });

  it("resolves the configured BENCH_USER_ID over the default", () => {
    const CUSTOM_ID = "11111111-2222-3333-4444-555555555555";
    process.env.BENCH_USER_ID = CUSTOM_ID;
    enableWith(TEST_SECRET);
    const w = currentWindowIndex(FIXED_NOW);
    const token = tokenFor(w);

    expect(configuredBenchUserId()).toBe(CUSTOM_ID);
    expect(verifyBenchToken(token, FIXED_NOW)).toBe(true);
    // resolveBenchUserId defaults to the real clock, so use the current window
    // (the fixed-clock token from 2026-09-14 is outside the ±1 window today).
    const wNow = currentWindowIndex();
    expect(resolveBenchUserId(tokenFor(wNow))).toBe(CUSTOM_ID);
    // A valid token with no configured id still resolves to the default.
    delete process.env.BENCH_USER_ID;
    expect(resolveBenchUserId(tokenFor(wNow))).toBe("00000000-0000-0000-0000-000000000001");
  });
});
