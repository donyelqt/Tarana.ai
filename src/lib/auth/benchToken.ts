/**
 * HMAC bench token — per-request proof for the k6 bench bypass.
 *
 * Why this exists: the old bypass honored a static `x-bench-bypass: true`
 * header any client could guess, and a `BENCH_BYPASS_AUTH=true` env switch
 * alone opened every request. This module replaces both with a short-lived
 * HMAC: the k6 client proves possession of BENCH_HMAC_SECRET on every
 * request, and the secret alone (without a fresh timestamp window) is
 * useless when replayed later.
 *
 * Wire format (header `x-bench-token`): `<windowIndex>:<hex-hmac-sha256>`,
 * where windowIndex = floor(nowMs / 1000 / 300) and the HMAC input is
 * `tarana-bench-v1:<windowIndex>`. The k6 side (bench/k6-itinerary.js)
 * constructs the identical string — keep the two in sync; the unit tests
 * below pin the construction.
 *
 * Fail-closed rules: bypass is inert unless BENCH_BYPASS_AUTH=true AND a
 * >=32-char BENCH_HMAC_SECRET is configured AND NODE_ENV != production.
 * A misconfigured secret disables the bypass loudly (console.error),
 * never silently.
 */
import { createHmac, timingSafeEqual } from "crypto";

export const BENCH_TOKEN_HEADER = "x-bench-token";
const WINDOW_SECONDS = 300;
const MIN_SECRET_LENGTH = 32;
const TOKEN_DOMAIN = "tarana-bench-v1";
// Fallback bench identity when BENCH_USER_ID is unset. This UUID must stay
// unregistrable: no signup/seed flow may ever mint it, otherwise the
// charging exemption below would apply to a real user. Grep for this
// literal before adding any user-seeding code.
const DEFAULT_BENCH_USER_ID = "00000000-0000-0000-0000-000000000001";

function readSecret(): string | null {
  const raw = process.env.BENCH_HMAC_SECRET?.trim() ?? "";
  if (raw.length < MIN_SECRET_LENGTH) return null;
  // Non-ASCII secrets risk byte divergence between runtimes (Node vs k6);
  // operators should generate with `openssl rand -hex 32`.
  if (!/^[\x20-\x7E]+$/.test(raw)) return null;
  return raw;
}

export function benchBypassEnabled(): boolean {
  if (process.env.BENCH_BYPASS_AUTH?.trim() !== "true") return false;
  if (process.env.NODE_ENV === "production") return false;
  // Belt-and-braces: a prod Vercel deployment misconfigured with a dev
  // NODE_ENV must not re-enable the bypass against real data/credits.
  if (process.env.VERCEL_ENV === "production") return false;
  if (readSecret() === null) {
    console.error("[benchToken] BENCH_BYPASS_AUTH=true but BENCH_HMAC_SECRET is missing, short (<32 ASCII chars), or non-ASCII — bench bypass DISABLED");
    return false;
  }
  return true;
}

export function currentWindowIndex(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 1000 / WINDOW_SECONDS);
}

export function computeBenchToken(secret: string, windowIndex: number): string {
  return createHmac("sha256", secret).update(`${TOKEN_DOMAIN}:${windowIndex}`).digest("hex");
}

/**
 * Returns true only for a well-formed token whose HMAC verifies under the
 * configured secret for the current or immediately previous window.
 * Constant-time comparison; malformed input returns false (never throws).
 * Assumes client and server clocks agree within minutes (true for the
 * local/CI bench flow; not suitable for cross-datacenter callers).
 */
export function verifyBenchToken(headerValue: string | null | undefined, nowMs: number = Date.now()): boolean {
  if (!benchBypassEnabled()) return false;
  if (typeof headerValue !== "string" || headerValue.length === 0) return false;
  const sep = headerValue.indexOf(":");
  if (sep <= 0) return false;
  const windowRaw = headerValue.slice(0, sep);
  const sig = headerValue.slice(sep + 1);
  if (!/^\d+$/.test(windowRaw) || !/^[0-9a-f]{64}$/.test(sig)) return false;
  const windowIndex = Number.parseInt(windowRaw, 10);
  const current = currentWindowIndex(nowMs);
  if (windowIndex !== current && windowIndex !== current - 1) return false;
  const secret = readSecret();
  if (secret === null) return false;
  const expected = computeBenchToken(secret, windowIndex);
  const a = Buffer.from(sig.trim(), "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Single source of truth for the bench identity. Returns the configured
 * bench user id when `headerValue` carries a valid HMAC proof, else null.
 * All exemption checks (charging, refunds) must derive from this function
 * — never compare against a hardcoded UUID literal elsewhere.
 */
export function resolveBenchUserId(headerValue: string | null | undefined): string | null {
  if (!verifyBenchToken(headerValue)) return null;
  return configuredBenchUserId();
}

/** The bench identity under test. Comparison-only helper — proving the
 *  caller holds it still requires verifyBenchToken/resolveBenchUserId. */
export function configuredBenchUserId(): string {
  return process.env.BENCH_USER_ID?.trim() || DEFAULT_BENCH_USER_ID;
}
