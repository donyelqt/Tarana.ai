import http from "k6/http";
import crypto from "k6/crypto";
import { check, sleep } from "k6";

export const options = {
  vus: 50,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(50)<3500", "p(95)<6000"],
    http_req_failed: ["rate<0.01"],
  },
};

// Baseline is committed so CI can compare drift. Update after intentional perf changes.
const BASELINE = {
  p50_ms: null, // fill after first run: e.g. 2800
  p95_ms: null,
  zeroResultRate: null,
  tomtom429Rate: null,
  date: "2026-09-02",
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

// Bench auth proof. MUST construct the identical string as
// src/lib/auth/benchToken.ts: domain "tarana-bench-v1", 300s windows,
// header "x-bench-token" = "<window>:<hex-hmac-sha256>".
// Secret comes from -e BENCH_HMAC_SECRET and must equal the server's
// BENCH_HMAC_SECRET (with BENCH_BYPASS_AUTH=true, non-prod only).
const BENCH_WINDOW_SECONDS = 300;
const BENCH_DOMAIN = "tarana-bench-v1";

function benchToken() {
  const secret = (__ENV.BENCH_HMAC_SECRET || "").trim();
  const w = Math.floor(Date.now() / 1000 / BENCH_WINDOW_SECONDS);
  const sig = crypto.hmac("sha256", secret, `${BENCH_DOMAIN}:${w}`, "hex");
  return `${w}:${sig}`;
}

export function setup() {
  // Fail fast on misconfiguration: without a proper secret every request
  // 401s and the 30s run reports a threshold failure instead of the cause.
  const secret = (__ENV.BENCH_HMAC_SECRET || "").trim();
  if (secret.length < 32) {
    throw new Error("BENCH_HMAC_SECRET must be set (>=32 chars) and match the server's secret");
  }
}
const PAYLOADS = [
  { prompt: "food, chill vibes", interests: ["Food & Culinary"], cityId: "baguio", trafficAware: true },
  { prompt: "restaurants near Burnham", interests: ["Food & Culinary"], cityId: "baguio", trafficAware: true },
  { prompt: "tourist attractions Cebu", interests: ["Nature & Scenery"], cityId: "cebu", trafficAware: true },
  { prompt: "museums Manila", interests: ["Culture & Arts"], cityId: "manila", trafficAware: true },
  { prompt: "beach Davao", interests: ["Nature & Scenery"], cityId: "davao", trafficAware: true },
];

export default function () {
  const payload = PAYLOADS[Math.floor(Math.random() * PAYLOADS.length)];
  const body = JSON.stringify({
    prompt: payload.prompt,
    interests: payload.interests,
    cityId: payload.cityId,
    trafficAware: payload.trafficAware,
    weatherType: "sunny",
    durationDays: 1,
    pax: 2,
    budget: "mid-range",
  });

  const res = http.post(`${BASE_URL}/api/gemini/itinerary-generator`, body, {
    headers: { "Content-Type": "application/json", "x-bench-token": benchToken() },
  });

  const ok = check(res, {
    "status 200": (r) => r.status === 200,
    "has text": (r) => {
      try {
        const j = r.json();
        return typeof j.text === "string" && j.text.length > 0;
      } catch { return false; }
    },
    "not zero-result refunded": (r) => {
      try {
        const j = r.json();
        return j.refunded !== true;
      } catch { return true; }
    },
  });

  // 429 is surfaced as 200 with empty? Actually TomTom 429 is retried server-side; check header if exposed
  // For now, treat any 429 at HTTP level as failure for threshold
  check(res, { "not 429": (r) => r.status !== 429 });

  sleep(0.2);
}