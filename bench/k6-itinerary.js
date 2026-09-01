import http from "k6/http";
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
    headers: { "Content-Type": "application/json", "x-bench-bypass": "true" },
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