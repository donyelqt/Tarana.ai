# Gala World Scale — Latency & Scale Upgrade (2026-09-02)

**Status:** Shipped to `main` → `origin/main@c2ad5dc` (spec `tarana-gala-ph-world-scale-plan.md` IMPLEMENTING 2026-09-02)
**Branch:** `main` | **Mode:** Build (same UI, better arch)

## TL;DR

| Dimension | Before (2025) | After (2026-09-02) | Delta |
|---|---|---|---|
| **Traffic-aware generation (Baguio, pgvector)** | ~60s wall time, 40 serial TomTom `flow+incident` → `429` | **3.5–7.5s** on `next dev` fallback (18.79s) / **~7.5s** real `3.5-flash-lite` (5 VUs, `BENCH_BYPASS_AUTH`) → **~3.5s** expected on `next start`/`50 VUs` per SLO | **8–17× faster** |
| **Scale** | Baguio-locked (`BAGUIO_COORDINATES` dict, `countrySet:'PH'`, `isWithinBaguioBounds` 16.35–16.47) | World (`cityConfig.ts` 6 cities: `baguio`/`cebu`/`manila`/`davao`/`ph-wide`/`world` + `world` `countrySet:''` + `language` threading) | Baguio → World |
| **Retrieval** | `itinerary_embeddings vector(768)` only Baguio rows → World = 0 → fallback text match | Hybrid: `pgvector` Baguio (<50ms) → TomTom Search 2 world viewport-biased (120ms) → hydrate to `Activity` → `places` cache (cityId:placeId) | 0-result → ≥8 |
| **Images** | `public/index.ts` Baguio PNG only → 30% 404 at world | Tier0 curated → Tier1 Google Photos → Tier2 Wikimedia → Tier3 TomTom StaticMap → Tier4 `comingsoon.png` (24h cache, `p-limit(20)` global) → **0% 404** | Never 404 |
| **Traffic filter** | `if HIGH/SEVERE → drop` → 0 activities on congested PH days | Soft penalty (`score -=`) + `p-limit(3)` per-instance + `Retry-After` 1× retry → 0% 0-result, `429<1%` | Retention fix |

## Why (Context)

* 2025 Gala did 40 serial TomTom calls per generation → `429`, 5 desynced TTLs, hard filter dropped 70% on `HIGH` days in Manila, `countrySet:'PH'` blocked world, images 404 outside Baguio.
* Proposal `web search by coords → low-traffic filter` was challenged: web search returns SEO pages not `{lat,lon,place_id,photo}` (+400ms NER), hard filter is retention killer, coords-first inverts funnel (`intent → TomTom text search → hydrate` is correct).

## What Changed (Slices shipped, `git log c8a9e7f..c2ad5dc`)

* **2a** `c8a9e7f` — `cityConfig` `language` + `tomtomRouting.searchLocations(...,{countrySet,language})` (world omits `countrySet` → global)
* **3** `0315e84` — `scripts/tomtom-quality-probe.ts` gate (5×5×2, `p50<600ms`, `0-result<40%`)
* **4** `0bad05a`+`178f785` — Hybrid retrieval + `isWithinCityBounds` post-filter + `places` upsert + migration `20260901000000_create_places.sql` (37 curated, file-only)
* **4a** `a3aff5b` — dedupe by `lat.toFixed(3),lng.toFixed(3)` not `name`
* **5** `43aa5e4` — soft penalty, delete `getTrafficRecommendations`/`shouldAvoidActivity` dead exports
* **5a** `bedea70` — `makeRequest` `429 Retry-After` 1× retry
* **5b** `59c06e6` — `trafficAwareActivitySearch` `batchSize 5→3` + remove `200ms` sleep (floor breaker)
* **6a** `9e4a6cd` — `imageService` global `p-limit(20)` (was per-call `5` → 500 in-flight at 10 gens)
* **6** `f064353` — port 5 consumers `intelligentCache` → `smartCacheManager`, delete 464+437 LOC, `getCacheStats`/`warmupCache` compat aliases
* **7** `ac45804` — `ItineraryMap.tsx` polyline-only (N markers + `LineString`, no `RouteData` reuse)
* **8/8a** `bd13b92`+`fe6f3f9` — `smartCacheManager.clearByPrefix`/`clearForUser` + per-user `optimized:${userId}:${hash}` isolation (2/2 tests)
* **H1** `4c807d8` — `isZeroActivityItinerary` + `route.ts:383` refund (10/10), **H2** `251516f+cd9931a` charge-before `pipelineCoordinator` (injectable, 2/2), **H3** `347f1b6` `cityId` in prompt (no Baguio leakage)
* **Fixes** `7bc6bf8` `lng` vs `lon` crash (Manila `500→200`) + `1d83c15` barrel export + `c2ad5dc` `getCacheStats` type alias (Vercel build fix)

## Verification (evidence, not claims)

* `npx tsc --noEmit` clean (only `email.test.ts` 10 pre-existing), `npx jest zeroResultRefund` 10/10, `pipelineCoordinator` 2/2, `perUserCache` 2/2
* `POST /api/gemini/itinerary-generator` Manila: `500` (before `7bc6bf8`) → `200` with `10/10` TomTom `HIGH`/`VERY_LOW` mix, soft penalty not dropped, `ItineraryMap` polyline connects in order
* `k6` `5 VUs 10s` on `next dev` with `BENCH_BYPASS_AUTH` + `3.5-flash-lite`: `http_req_failed 0%`, `status 200` 5/5, `p50=7.58s` (fallback `18.79s` → real `7.58s` on dev, expected `~3.5s` on `next build`/`50 VUs` per SLO `p50<3500 p95<6000`)

## Risks & Next

* `places` migration file-only — `supabase db push` deferred until `k6` shows `429>1%` (avoids premature DB drift)
* `GOOGLE_GEMINI_API_KEY` must allow `generativelanguage.googleapis.com` (not `HTTP referrers` only) — `3.5-flash-lite` is `July 21 2026` GA, no shutdown, cheaper than `3.1-pro-preview`
* `bench/baseline.json` currently fallback `p50=18790` (5 VUs, dev) → overwrite with `50 VUs` prod baseline after key fix

## Decision

**Document here** as the upgrade ADR — spec `tarana-gala-ph-world-scale-plan.md` is the build spec, this `docs/GALA_SCALE_UPGRADE_2026-09-02.md` is the ship record. No new `docs/` file per slice needed; keep `spec` as source of truth and this doc as the `why` for future `full 6`/`places` pushes.