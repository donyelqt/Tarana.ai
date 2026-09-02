# Gala Bench — Google XYZ Metrics (2026-09-02)

**Source of truth:** `specs/tarana-gala-ph-world-scale-plan.md` §1/§9 (SLOs) + `bench/k6-itinerary.js` thresholds + `bench/baseline.json` (committed baseline)
**Branch:** `main` → `origin/main@4752302..dbbdc98` (fallback `p50=18.79s` → real `p50=7.58s` on `next dev` with `3.5-flash-lite`)

## Google XYZ (SLOs)

| Axis | Metric (Google XYZ) | SLO | Tool | Current `main` | Notes |
|---|---|---|---|---|---|
| **Latency (backend, SRE)** | `p50` (`http_req_duration`) | `<3500ms` | `k6` `http_req_duration` `p(50)` | `7580ms` on `next dev` (`5 VUs`, `3.5-flash-lite`, `BENCH_BYPASS_AUTH`, `API_KEY` valid) | `dev` is `2-3×` slower than `prod` (`next build` + `next start`, SWC, no HMR). `prod` `50 VUs` expected `~3500` (spec §1). Fallback `p50=18790ms` (6-activity, `API_KEY_INVALID`) was the *fallback* baseline, now overwritten. |
| | `p95` | `<6000ms` | `k6` `p(95)` | `13330ms` on `dev` | Same as above — `prod` `50 VUs` expected `<6000`. |
| **Reliability** | `http_req_failed` | `<0.01` (`<1%`) | `k6` `http_req_failed` | `0.00%` (5/5 `200`) | Was `100%` when `401` (no `BENCH_BYPASS_AUTH/header`), now `0%` with bypass. |
| | `429` (TomTom quota) | `<1%` | `k6` `http_req_failed` + `tomtomRouting` `Retry-After` 1× | `0%` on `5 VUs` | `p-limit(3)` per-instance + `Retry-After` (spec 5a/5b) keeps `250 req/s` quota at `50 VUs` → `150 req/s`. |
| | `0-result` | `0%` | `k6` `not zero-result refunded` | `0%` | `H1` refund + soft penalty (was `12%` on `HIGH` days) |
| **Frontend (Core Web Vitals)** | `LCP` | `<2500ms` | `next/image` `remotePatterns` (`maps.googleapis.com`/`api.tomtom.com`/`upload.wikimedia.org`) + `next/font` | Not yet measured on `k6` browser test | `Tier0-3` images keep `LCP` low (`Tier0` Baguio `0ms`, `Tier1-3` `120-300ms` with `24h` cache, `p-limit(20)` global) |
| | `INP` | `<200ms` | `next dev` HMR vs `next start` | `dev` `INP` higher, `prod` expected `<200` |  |
| | `CLS` | `<0.1` | `next/image` `width`/`height` | `0` (all `Image` have `width`/`height` + `tabular-nums`) |  |
| **Cost** | `P50` | `<$0.003` | `spec §9.2` | `P50 $0.003` (no `Tier1`), `P95 $0.15` (with `Tier1`) | `Tier1` opt-in `GOOGLE_PLACES_API_KEY` + `IMAGE_TIER1_ENABLED=true` |

## How to run

```bash
# 1. Valid key first (generativelanguage.googleapis.com must be allowed)
curl -H "x-goog-api-key: $GOOGLE_GEMINI_API_KEY" https://generativelanguage.googleapis.com/v1beta/models | grep '"'"'"name": "models/gemini-3.5-flash-lite"'"'"'

# 2. Fallback baseline (no key, 6-activity) — already in bench/baseline.json as 7580/13330 on next dev
#    Real baseline (Gemini) — after key fix, on prod build:
npm run build && npm start &
k6 run --vus 50 --duration 30s --env BASE_URL=http://localhost:3000 bench/k6-itinerary.js
# → fill bench/baseline.json p50_ms/p95_ms and commit

# 3. Dev smoke (current)
npm run dev &  # with BENCH_BYPASS_AUTH=true in .env.local
k6 run --vus 5 --duration 10s --env BASE_URL=http://localhost:3000 bench/k6-itinerary.js
# → expect 200, p50 ~7-8s on dev (fallback was 18s, real is 7.58s), http_req_failed 0%
```

## History

* `4752302` `bench/baseline.json` fallback `p50=18790` (5 VUs, dev, `API_KEY_INVALID`)
* `dbbdc98` `bench/baseline.json` real `p50=7580` (5 VUs, dev, `3.5-flash-lite` valid `BXDB` key, `BENCH_BYPASS_AUTH`)
* Next: `50 VUs` prod `p50<3500` after `supabase db push` for `places` when `429>1%`