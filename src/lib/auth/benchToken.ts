import { createHmac, timingSafeEqual } from "crypto";

export const BENCH_TOKEN_HEADER = "x-bench-token";
const WINDOW_SECONDS = 300;
const MIN_SECRET_LENGTH = 32;
const TOKEN_DOMAIN = "tarana-bench-v1";
const DEFAULT_BENCH_USER_ID = "00000000-0000-0000-0000-000000000001";

function readSecret(): string | null {
  const raw = process.env.BENCH_HMAC_SECRET?.trim() ?? "";
  if (raw.length < MIN_SECRET_LENGTH) return null;
  if (!/^[\x20-\x7E]+$/.test(raw)) return null;
  return raw;
}

export function benchBypassEnabled(): boolean {
  if (process.env.BENCH_BYPASS_AUTH?.trim() !== "true") return false;
  if (process.env.NODE_ENV === "production") return false;
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

export function resolveBenchUserId(headerValue: string | null | undefined): string | null {
  if (!verifyBenchToken(headerValue)) return null;
  return configuredBenchUserId();
}

export function configuredBenchUserId(): string {
  return process.env.BENCH_USER_ID?.trim() || DEFAULT_BENCH_USER_ID;
}
