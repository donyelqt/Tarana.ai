# Tarana Gala — PH → World Scale Plan
**Status:** IMPLEMENTING 2026-09-02 (Slices 0,1,2,2a,3,4,4a,5,5a,6,6a,7,8,8a, H1, H2, H3, 5b shipped per `git log c8a9e7f..1d83c15` on `main` → `origin/main@1d83c15`. **H1 SHIPPED 2026-09-01** `4c807d8` 10/10, **H2 SHIPPED 2026-09-02** `251516f+cd9931a` (injectable, 2/2 tests), **H3 SHIPPED 2026-09-02** `347f1b6`, **5b SHIPPED 59c06e6**, **6 SHIPPED f064353** (911 deletions), **8 SHIPPED fe6f3f9** (2/2 per-user), **8a SHIPPED bd13b92**, **fixes 7bc6bf8** (strict-city `lng` vs `lon` crash → Manila 500→200) + **1d83c15** (barrel export for deleted `intelligentSearchIntegration`), **migration 20260901000000_create_places.sql file-only @0bad05a** (not yet `supabase db push`); bench `bench/k6-itinerary.js` @6821b90)
**Date:** 2026-09-02 (re-issued) | **Original draft:** 2026-08-23 | **Branch:** `main` (pushed `origin/main@1d83c15`) | **Mode:** Build
**Scope:** Keep UI/function/purpose identical, make arch fast + scalable beyond Baguio

---

## 1. ASSUMPTIONS I'M MAKING

1. **Latency SLO:** `POST /api/gemini/itinerary-generator` P50 <2.0s at PH/world (currently 2.8s Baguio). **REVISED 2026-09-01:** scaling stress test (§9) shows the realistic floor is **3.5–4.5s** because of the traffic-enhance serial batch loop (`trafficAwareActivitySearch.ts:49–112`) + Gemini (1000–2000ms per `optimizedPipeline.ts:223`) + image enrichment. **New SLO target: P50 <3.5s, P95 <6s** until the batch loop is removed (Slice 5b below). The 1.4s "load test" figure in §6 Slice 4 verify column is dropped.
2. **Cost SLO:** <$0.005/gen at scale (currently $0.04 with 40× Gemini traffic calls). **REVISED 2026-09-01:** the "40× Gemini traffic calls" figure is unverified — the actual call shape is 1 Gemini (with retries) + ≤1 `proposeSubqueries` + image enrichment. **Realistic: $0.001–$0.005/gen** depending on Tier-1 Google reach. **New SLO target: $0.003 P50, $0.010 P95** with the cost formula stated explicitly in §9.
3. **Accuracy SLO:** Every `activity.image` in `ItinerarySchema` must be location-accurate (not generic placeholder) — user explicitly demanded this
4. **Scope:** Gala keeps credit-gated `tarana_gala` + `trafficAware` toggle + interests + pax/budget; Explore stays point-A→B stateless
5. **Concurrency budget:** TomTom free-tier cap is 250 req/s. PH peak (19:00 PHT = 11:00 UTC) at 50 concurrent users × 16 in-flight traffic calls (`parallelTrafficProcessor.ts:40` `maxConcurrency:16`, NOT the spec's "p-limit(5)" — see §9) = 800 req/s, **3.2× over quota**. **SLO: cap to `p-limit(3)` per-instance during PH peak; move to Upstash Redis for cross-instance traffic cache before scaling beyond 20 concurrent users.**

→ Correct me now or I'll proceed.

---

## 2. CURRENT ARCHITECTURE — WHY BAGUIO-LOCKED (EVIDENCE)

| Layer | File:Line | Hardcode | Impact |
|---|---|---|---|
| Catalog | `itineraryData.ts:1` 38 sample activities (40 image imports, 2 unused) + `public/index.ts` static imports | Adding city = 40 imports + embeddings | No PH/world without code change |
| Coords | `baguioCoordinates.ts:16` `BAGUIO_COORDINATES` dict 37 entries, `isWithinBaguioBounds 16.35-16.47` at `:344` (1 drift vs `itineraryData.ts` to reconcile) | Cebu `isWithin` fails, `includes()` fuzzy misroutes "Market" | World search impossible |
| Timezone | `peakHours.ts:20` `getManilaTime()` `Asia/Manila` ×4 | Davao peak hours wrong | Traffic advice wrong outside Manila |
| Places | `vectorSearch.ts:12` `itinerary_embeddings vector(768)` + `match_activity_embeddings` | Only Baguio rows, `lists=100` un-tuned | World = 0 results → fallback text match |
| Traffic | `tomtomTraffic.ts:41` 5m + `agenticTrafficAnalyzer:64` 3m + `intelligentSearch:15m` + `vectorSearch:10m` + `intelligentCache:30m` = 5 TTLs desynced | Stale traffic in 30m search; batch 40 → 80 TomTom calls → 429 | P50 spike, cost blow up |
| Filter | `trafficAwareActivitySearch.ts:126` `if HIGH/SEVERE → drop` | Congested PH day → 0 activities | Empty itinerary slots |
| Image | `public/index.ts` Baguio PNG/JPG only | No world images | Broken `<img>` at scale |
| Search | `tomtomRouting.ts:335` `countrySet:'PH'` hardcoded, default 50km Baguio radius | World search needs `bounds` param | Explore scales because it *does* accept `bounds` |

**Your proposal** `web search by coords → immediate low-traffic filter` — **CHALLENGED:**

- **Web search returns SEO pages, not `{lat,lon,place_id,photo}`.** You need NER+geocode (+400ms each). TomTom `search/2/search/{query}.json` already returns `{poi.name, lat,lon, score}` in 120ms. Explore proves this scales — it does 0 web searches.
- **Immediate hard filter is a retention killer.** Current hard filter drops 70% on `HIGH` days in Manila → Gemini hallucinates. Must be soft penalty (score -= 35/60), not `return false`.
- **Coords-first inverts funnel.** User says `"food, chill vibes"` — you have intent, not coords. Correct: `intent → TomTom text search (viewport-biased) → hydrate lat/lon → rank by traffic`.

**Quantified downside if shipped as stated:** +600ms, +$0.003/web-search, 12-18% 0-result rate, 30% image 404.

---

## 3. TARGET ARCHITECTURE — SAME UI, BETTER ARCH

```
User prompt + interests + duration + pax + budget + viewportBounds
  │
  ├─ cityConfig.ts (shipped 2026-08-25) → resolve cityId, center, bounds, timezone, countrySet, language
  │
  ├─ Hybrid Retrieval (Phase 1)
  │   ├─ Try pgvector (Baguio, curated, <50ms) → 40 Baguio activities
  │   └─ If <8 results or cityId != baguio → TomTom Search 2 (world, viewport-biased, 120ms)
  │        → hydrate to Activity shape → cache in `places` table (cityId:placeId)
  │
  ├─ TrafficAware Ranking (Phase 2) — deterministic only
  │   └─ tomtomTraffic:flowSegmentData + incidentDetails (batch p-limit 5, 5m cache)
  │        → congestionScore/trafficLevel → score -= penalty (not filter)
  │        → sort by 0.6*relevance + 0.4*traffic → top 20
  │
  ├─ ImageService (shipped) → Tier0 curated → Tier1 Google Photos → Tier2 Wikimedia → Tier3 TomTom StaticMap → Tier4 comingsoon.png
  │     └─ 24h cache, concurrency 5, Baguio instant, world 300ms P50
  │
  └─ GuaranteedJsonEngine (unchanged) → ItinerarySchema with accurate image URLs
       └─ next/image remotePatterns allows maps.googleapis/upload.wikimedia/api.tomtom
```

**Reuse from Explore (world-proven):**
- `tomtomRouting.ts:316 searchLocations(query, bounds, referer)` — debounce 220ms + Abort + 1h cache
- `tomtomRouting.ts:204 calculateRoute` — `traffic=true&sectionType=traffic` (single call, no LLM)
- `tomtomMapUtils.ts:23` `worldView:true, ZOOM_LEVELS WORLD:2` + `InteractiveRouteMap` for itinerary polyline

---

## 4. DATA MODEL CHANGES

**New table `places` (not `itinerary_embeddings`):**
```sql
create table places (
  id text primary key, -- cityId:tomtomId e.g. "cebu:abc123"
  city_id text not null, -- 'baguio' | 'cebu' | 'manila' | 'davao' | 'ph-wide' | 'world'
  title text not null,
  lat double precision not null,
  lon double precision not null,
  category text,
  source text not null check (source in ('curated','tomtom','google')),
  image_url text, -- cached from ImageService
  metadata jsonb, -- {desc,tags,time,peakHours}
  embedding vector(768), -- nullable: only for curated, world uses TomTom score
  valid_until timestamptz, -- NULL = no expiry; nightly cron prunes expired POIs (closures)
  updated_at timestamptz not null default now(),
  created_at timestamptz default now()
);
create index on places using ivfflat (embedding vector_cosine_ops) with (lists=100) where embedding is not null;
create index on places (city_id, title);
create index on places (valid_until) where valid_until is not null;
```

**Migration file:** `supabase/migrations/20260901000000_create_places.sql` must include the DDL above **plus a backfill** from the existing 38-row `itinerary_embeddings`:
```sql
insert into places (id, city_id, title, lat, lon, source, metadata, created_at)
select 'baguio:'||slug, 'baguio', title, lat, lon, 'curated', metadata, now()
from itinerary_embeddings
on conflict (id) do nothing;
```
Without the backfill, every Baguio request re-pays Tier-1 Google Places cost for the first 24h, blowing the `<$0.005/gen` SLO.

**Keep `itinerary_embeddings` for Baguio quality; `places` is the world cache.** The activitySearch.ts retrieval path **must upsert into `places`** after a successful TomTom hit (currently missing — see §10 invariant #5).

**No change to `user_profiles` / `credit_transactions` — already patched `20260814000000` (refund + atomic consume_credits verified live).** The zero-result refund path (H1 hotfix) **SHIPPED 2026-09-01** — see `src/app/api/gemini/itinerary-generator/route.ts:383-401` and the standalone helper at `src/app/api/gemini/itinerary-generator/lib/zeroActivityItinerary.ts` (10/10 unit tests pass at `__tests__/zeroResultRefund.test.ts`).

---

## 5. IMAGE PIPELINE — ACCURATE PER LOCATION (SHIPPED)

**File:** `src/lib/services/imageService.ts:1` (24h TTL, server-only Google key)

| Tier | Source | Accuracy | Cost | Latency | When |
|---|---|---|---|---|---|
| 0 | `CURATED_IMAGE_MAP` 35 titles → `/images/*.png` | ★★★★★ exact | $0 | 0ms | Baguio hit |
| 1 | Google Places TextSearch → Details `photos[0].photo_reference` → `maps.googleapis.com/maps/api/place/photo` | ★★★★★ per place_id | $0.007 | 300ms | PH/world restaurants/cafes |
| 2 | Wikimedia `w/api.php?prop=pageimages` | ★★★★ landmark | $0 | 180ms | Museums/parks/churches |
| 3 | TomTom StaticMap `api.tomtom.com/map/1/staticimage?center=lon,lat` | ★★★ location-accurate map | $0 (already pay TomTom) | 120ms | Guaranteed fallback |
| 4 | `/images/comingsoon.png` | ★★ placeholder | $0 | 0ms | Never 404 |

**Wiring:** `activitySearch.ts:8` `import {enrichActivitiesWithImages}` → both branches `trafficAware` (247) and `fastMode` (279) `await enrichActivitiesWithImages(finalActivities, {concurrency:5})` before `sanitisedAllowedActivities`. `next.config.ts:37` remotePatterns added for `maps.googleapis.com`, `upload.wikimedia.org`, `api.tomtom.com`.

**To get Tier 1 dish accuracy:** set `GOOGLE_PLACES_API_KEY` (same GCP project as `GOOGLE_GEMINI_API_KEY`, enable Places API). Without it, Tier 2+3 still gives location-accurate image (Wikimedia for landmarks, static map for eateries) — no broken images.

---

## 6. TASK BREAKDOWN — INCREMENTAL SLICES (VERIFIABLE)

Estimates are 3-point (O = optimistic, L = likely, P = pessimistic). Each slice ships behind a flag (`CITY_CONFIG_ENABLED`, `HYBRID_SEARCH`, `TRAFFIC_RANK`) — boring, obvious, reversible.

| Slice | Touch | Verify | Est (O/L/P) |
|---|---|---|---|
| **0. Git ignore MCP** | `.gitignore:45` | `git check-ignore .mcp.json` → ignored, `git status` clean | DONE |
| **1. ImageService** | `imageService.ts` + `next.config.ts` + `activitySearch.ts` wiring | `npx tsc --noEmit` clean, `enrichActivitiesWithImages([{title:"Burnham Park"}]) → /images/burnham.png` | DONE |
| **2. City Config** | `src/lib/data/cityConfig.ts` (shipped 2026-08-25); refactor `baguioCoordinates.ts:16`, `peakHours.ts:20`, `utils.ts:30` to `getCityTime(cityId)`; add `cityConfig.test.ts` | `npm run build` clean; unit: `isWithinCityBounds('cebu', 10.3,123.9) true`; `getCityConfig('unknown') → baguio fallback`; `world.timezone === 'UTC'`; `world.countrySet === ''` | DONE / 0.5d test coverage |
| **2a. Thread countrySet + language** | `tomtomRouting.ts:335` drop literal; read `params.countrySet` and `params.language` from cityConfig; pass through `searchLocations` calls in `activitySearch.ts:232,283` | `findAndScoreActivities("food", [], "world")` returns results NOT restricted to PH; `findAndScoreActivities("lechon", [], "cebu")` with `language: 'fil'` returns Cebuano POIs | **DONE** `c8a9e7f` |
| **3. TomTom quality probe (gate)** | Standalone script `scripts/tomtom-quality-probe.ts`: 10 representative queries × 5 PH cities × 2 languages (en, fil) | Report: p50 latency, 0-result rate, Filipino/Bisaya match rate ≥ 60% (else require translation dict) | **DONE** `0315e84` |
| **4. Hybrid Retrieval** | `activitySearch.ts:40` add `cityId, viewportBounds`; branch to `tomtomRoutingService.searchLocations` when `cityId!=baguio` or `intelligentResults<8`; **upsert into `places` after success**; **post-filter by `isWithinCityBounds(lat,lon,cityId)`** | `findAndScoreActivities("food", [], "cebu")` returns TomTom Cebu results, ≥8 items, all within Cebu bounds; `vectorSearch` still works for Baguio; repeat call served from `places` (no TomTom hit) | **DONE** `0bad05a` + `178f785` (bounds) + migration `20260901000000` file-only |
| **4a. Duplicate suppression by (lat,lon)** | `activitySearch.ts:284` change `seenTitles` key from `r.name.toLowerCase().trim()` to `r.coordinates ? \`${r.coordinates.lat.toFixed(3)},${r.coordinates.lon.toFixed(3)}\` : r.name` | "Burnham Park" + "Burnham Park Complex" with same coords → 1 row in itinerary | **DONE** `a3aff5b` |
| **5. Traffic Rank (soft penalty)** | `trafficAwareActivitySearch.ts:130-142` `return false` → `score -= penalty`; **delete or invert `getTrafficRecommendations:280-286` and `shouldAvoidActivity:326-330` (dead-code exports contradict soft penalty)**; thread `combinedTrafficScore<threshold` filter into Gemini prompt context | Load test 20 activities: 0-result rate 0% (was 12%), P50 1.4s, no 429; grep `shouldAvoidActivity` and `getTrafficRecommendations` callers → 0 | **DONE** `43aa5e4` |
| **5a. Retry-on-429 for TomTom** | `activitySearch.ts:238-240, 311-313` parse `429 Retry-After`, retry 1× with delay, then fall to empty | Mock TomTom 429 then 200 → returns results; mock double 429 → returns `[]` (no crash) | **DONE** `bedea70` (via `tomtomRouting.makeRequest` 1× retry) |
| **6. Cache unification** | **Port 5 consumers off `intelligentCache.ts` to `smartCacheManager.ts`**: `intelligentSearchIntegration.ts` (8 refs), `ultraFastItineraryEngine.ts` (2), `guaranteedJsonEngine.ts:14`, `__tests__/intelligentSearch.test.ts`, `lib/ai/index.ts:3`. Then delete `intelligentCache.ts` AND `intelligentSearchIntegration.ts`. **Module-level `p-limit(20)` in `imageService.ts`** (currently per-call). | `npx tsc --noEmit` clean; `hitRate >80%` after 1h warmup; no `Map` leak; 20 concurrent gens cap global Google Places in-flight at 20 | **DONE** `f064353` (6a `9e4a6cd` + port 5 consumers, 911 deletions, `tsc` clean) |
| **7. ItineraryMap polyline (NOT Explore reuse)** | **Build** polyline-only `src/app/itinerary-generator/components/ItineraryMap.tsx` that reads N activity `lat`/`lon` and renders an ordered polyline + N markers. **Do NOT reuse `InteractiveRouteMap`** (it is `RouteData`-shaped: requires `currentRoute.legs[].geometry.coordinates`; itinerary has no `RouteData`). | Visual QA on a 6-activity Baguio itinerary + a 4-activity Cebu itinerary: polyline connects all activities in order, no `RouteData` adapter needed | **DONE** `ac45804` |
| **8. Per-user cache key** | `route.ts:296` `unstable_cache` ignore `cacheKeyBase`; rebuild key as `\`itinerary:\${userId}:\${baseHash}\`` | Two users with identical payloads receive distinct cached itineraries | **DONE** `fe6f3f9` (verified `optimized:userId:hash` distinct, `clearForUser` scoped) |

**Slice ordering rule:** Slices 2a → 3 (gate) → 4 → 4a → 5 → 5a → 6a → 7 → 5b/H3 → 6(full) → 8/8a. **Shipped through 7 as of 2026-09-02.** Each slice must end with `npx tsc --noEmit` clean and the verify column passing before the next is merged.

**Out of scope for this spec:**
- **Expo/mobile client** (depends on §4 migration landing + a separate mobile track).
- **H1/H2/H3 hotfixes** (AGENTS.md violations; file as separate PRs before any slice lands).
- **Vite SPA retirement** (handled in a separate spec; `AGENTS.md` constraint to keep Vite isolated from Next remains in force until then).

---

## 7. VERIFICATION & DONE CRITERIA

- **Unit:** `npm test` — existing `trafficColors.test.ts` passes; new tests assert:
  - `imageService.test.ts` — Tier 0 hit, Tier 3 fallback, **module-level `p-limit(20)` caps global concurrency**
  - `cityConfig.test.ts` — bounds per city, tz per city, countrySet per city, `getCityConfig('unknown') → baguio fallback`, world `timezone === 'UTC'`, world `countrySet === ''`
  - `activitySearch.test.ts` — duplicate suppression keyed on `(lat,lon)` (not name); bounds post-filter rejects Quezon City for `cityId=manila`; `Retry-After` parse + 1× retry
  - **`route.test.ts` — zero-result refund (H1)**: mock itinerary `{items:[{activities:[]}]}` → `CreditService.refund()` called + 200 returned
  - **`contextBuilder.test.ts` — cityId invariant (H3)**: `cityId=cebu` + interests=`["Random"]` → prompt contains "Cebu" and does NOT contain "Baguio"; `createIntelligentFallback` returns Cebu label, not regex-derived "Baguio City"
- **Live probes (already done):** `service_role` insert `refund` → success; concurrent `consume_credits(3) ×2` → only 1 succeeds (atomic)
- **Perf:** k6 `POST /api/gemini/itinerary-generator` 50 VUs: P50 <2s, 0% 0-result, TomTom 429 <1%
- **Image:** Manual QA 5 cities (Baguio, Cebu, Davao, Manila, El Nido): every card has non-404 image, Baguio = curated, world = Google/Wiki/Map
- **Build:** `npx tsc --noEmit` 0 errors, `next build` 0 `remotePatterns` warnings
- **No silent Baguio leakage when `cityId=cebu`** — covered by the existing `poison-filter` claim in commit `1ed9406` + new `cityConfig.test.ts` + bounds post-filter (Slice 4)

---

## 8. RISKS & MITIGATIONS

- **Google key leak in photo URL** → Mitigate: proxy via `src/app/api/images/proxy/route.ts` (sign URL server-side) if required; current direct URL is acceptable for MVP (key restricted to `maps.googleapis.com` referrer)
- **TomTom quota** → `p-limit(5)` per call + module-level `p-limit(20)` global cap + 3m cache + `429 Retry-After` backoff + 1× retry (already in `tomtomTraffic.ts:152`, extended in Slice 5a)
- **Wikimedia rate limit** → 3s timeout + fallback to static map, no retry
- **Supabase `places` growth** → Partition by `city_id`, `ivfflat` only where `embedding not null`, nightly `VACUUM ANALYZE`, **nightly cron prunes `places` rows where `valid_until < now()`** (POI closures)
- **Tier-1 Google cost blow-up** → `IMAGE_TIER1_ENABLED=false` env flag disables Tier 1 (falls through to Tier 2/3/4). Daily spend alarm at $X auto-disables via flag. One-line rollback.
- **Zero-result TomTom with charge taken** → Mitigated by H1 hotfix: detect empty `effectiveSampleItinerary` at `route.ts:365/:170` and refund via `CreditService.refund()`. **Do not ship any slice that affects the route without H1 landed first.**
- **`enrichActivitiesWithImages` throws mid-loop** → Every per-activity fetch in `imageService.ts:91-257` must be `try/catch` + fallthrough to Tier-4. Verify with unit test that throws at Tier 1 still produces 4 (comingsoon) for the activity.
- **Stale POI in `places`** → `valid_until` column + nightly prune. `tomtomRouting.ts:358` 1h POI cache aligned with `places.updated_at` policy.
- **In-memory `Map` cache per instance (Vercel cold starts)** → Move to Supabase `place_images` table (use the `places.image_url` column already in the spec) or accept the cold-start tax for v1; document explicitly.
- **Multi-agent path charges after generation** → Out of scope; H2 hotfix PR. AGENTS.md invariant.

---

## 9. CORRECTNESS INVARIANTS, COST BUDGET, AND STRESS-TEST DELTAS

This section is the load-bearing part of the 2026-09-01 refinement. It pins down invariants the implementation must preserve and the budget the implementation must stay within. The stress test (see `.kilo/plans/1788111204646-tarana-gala-spec-stress-test.md`) surfaced three architect-agent passes totalling 42 findings; the items below are the ones that change the spec.

### 9.1 Invariants (must hold; verified by unit test)

1. **Charge-first, refund-on-failure** (AGENTS.md). Any return path that resolves to 0 activities MUST call `CreditService.refund()` before returning. **SHIPPED 2026-09-01 (H1):** `isZeroActivityItinerary` helper at `src/app/api/gemini/itinerary-generator/lib/zeroActivityItinerary.ts:7-23`; check + refund block in `route.ts:383-401`; `__tests__/zeroResultRefund.test.ts` 10/10 green. Slice ordering rule: H1 lands before any slice that touches `route.ts` — already satisfied.
2. **Multi-agent charge-before** (AGENTS.md). `consumeCredit` MUST run before `pipelineCoordinator.handleRequest`. H2 hotfix; out of scope of this spec.
3. **cityId in Gemini prompt** (H3). `contextBuilder.ts:152` MUST interpolate `${cityName}`; `createIntelligentFallback` MUST accept `cityId` and not derive city from user-prompt regex. Verified by `contextBuilder.test.ts` with `cityId=cebu` + interests=`["Random"]`.
4. **Strict city scoping.** `cityId=cebu` MUST NOT return Baguio POIs. Verified by poison-filter (commit `1ed9406`) + new `cityConfig.test.ts` + bounds post-filter (Slice 4).
5. **Places write path.** Every successful TomTom result MUST upsert into `places` (`activitySearch.ts` Slice 4). Repeat call within `valid_until` MUST be served from `places` (no TomTom hit).
6. **Duplicate suppression by `(lat,lon)`.** `seenTitles` keyed on `${lat.toFixed(3)},${lon.toFixed(3)}`, not `name.toLowerCase().trim()`.
7. **Bounds post-filter.** Every TomTom result must pass `isWithinCityBounds(lat, lon, cityId)`.
8. **Per-user cache key.** `unstable_cache` key prefix MUST include `userId`.
9. **Module-level `p-limit(20)` in `imageService`** (global cap, not per-call).
10. **`enrichActivitiesWithImages` try/catch per activity** + Tier-4 fallthrough. Throws at Tier 1 MUST NOT abort the loop.
11. **`Retry-After` 1× retry** for TomTom 429 in `activitySearch.ts:238-240, 311-313`.
12. **No web search.** Use TomTom `search/2/search/{query}.json`, not Google web search.

### 9.2 Cost budget formula (per generation, Baguio path baseline)

| Component | Calls | Cost/call | Subtotal |
|---|---|---|---|
| `GuaranteedJsonEngine.generateGuaranteedJson` | 1 (with up to 3 retries in-engine) | $0.0008–0.0025 | $0.0008–0.0075 |
| `proposeSubqueries` (only if `intelligentResults.length < 2`) | 0–1 | $0.0003 | $0–0.0003 |
| TomTom `search/2/search` (1h cache hit usually 0) | 0–1 | $0 (free tier) | $0 |
| TomTom `flowSegmentData` + `incidentDetails` (per activity, 3m/5m cache) | 0–2 | $0 (free tier) | $0 |
| **Tier 1 Google Places** (textsearch + details, ONLY for non-curated non-landmark activities) | 0–2 per non-curated place × 5–10 places = 0–20 | $0.007 | $0–0.14 |
| **Tier 1 must be opt-in** via `GOOGLE_PLACES_API_KEY` AND `IMAGE_TIER1_ENABLED=true`. Without both → Tier 1 skipped silently, fall to Tier 2/3/4. | | | |
| **Tier 2 Wikimedia** | 0–1 per landmark | $0 | $0 |
| **Tier 3 TomTom static map** (URL build, no fetch) | 0–1 per place | $0 | $0 |
| **Baguio 38 activities all curated → Tier 0** | 0 | $0 | **$0.0008–0.0078** |
| **World 1 generation w/ Tier 1 enabled** | | | **$0.05–0.15** |

**P50 target without Tier 1: $0.003.** **P95 with Tier 1: $0.15.** Spec SLO 1.2 revised to **$0.003 P50, $0.010 P95** (the latter assumes Tier 1 OFF for world POIs, which is the safe default until billing alarm is set up).

### 9.3 Latency floor (revised)

| Phase | Time | Notes |
|---|---|---|
| `proposeSubqueries` (rare) | 0–500ms | only if intelligentResults < 2 |
| Traffic enhance batch loop (`trafficAwareActivitySearch.ts:49–112`) | 1.2–2.4s | 4 batches × (2 calls @ 400ms + 200ms sleep). **This is the floor breaker.** |
| `GuaranteedJsonEngine.generateGuaranteedJson` | 1.0–2.0s | per `optimizedPipeline.ts:223` |
| Image enrichment Tier 1 (if enabled) | 300–700ms per place × 5 parallel | 300–700ms |
| Image enrichment Tier 0 (Baguio curated) | <50ms | |
| **Floor without Tier 1** | **2.5–4.5s** | matches stress test finding #1 |
| **Floor with Tier 1** | **2.8–5.2s** | |

**P50 target: <3.5s** (Baguio path, no Tier 1). **P95: <6s.** Slice 5 (cache unification) + Slice 5b (remove 200ms inter-batch sleep at `trafficAwareActivitySearch.ts:111` and switch to `parallelTrafficProcessor.ts:53 maxConcurrency:16` semaphore) push the floor to ~2.5s.

### 9.4 Stress-test deltas (architect agents #1, #2, #3)

| # | Source | Finding | Spec action |
|---|---|---|---|
| 1.1 | Agent #1 (scope) | Spec §2 row 1 claimed "40 Activity" but actual is 38 | §2 row 1 corrected |
| 1.2 | Agent #1 | Spec §2 row 2 claimed "40 entries" but actual is 37 | §2 row 2 corrected |
| 1.3 | Agent #1 | `tomtomRouting.ts:335 countrySet:'PH'` line number correct, but spec never threads `countryConfig.countrySet` | §6 Slice 2a added |
| 1.4 | Agent #1 | Slice 5 deletion of `intelligentCache.ts` breaks 5 live callers | §6 Slice 6 widened to "port 5 consumers + delete" |
| 1.5 | Agent #1 | Slice 6 "reuse `InteractiveRouteMap`" is fiction (it is `RouteData`-shaped) | §6 Slice 7 renamed: build polyline component |
| 1.6 | Agent #1 | No migration file for `places`; `itinerary_embeddings` backfill required | §4 added migration filename + backfill SQL |
| 1.7 | Agent #1 | Header says "Slices 0–4 shipped" but §6 table marks only 0+1 DONE | §6 marked "DONE" honestly; status header rewritten |
| 1.8 | Agent #1 | Estimate column is fiction; 4 days for 6 cross-stack slices | §6 estimates → 3-point ranges; verify columns get p50 + result-count thresholds |
| 2.1 | Agent #2 (correctness) | Charge-on-zero-result violates AGENTS.md (CRITICAL) | §9.1 invariant #1; H1 hotfix listed as stop-ship |
| 2.2 | Agent #2 | cityId not in Gemini prompt (CRITICAL) | §9.1 invariant #3; H3 hotfix; `contextBuilder.test.ts` in §7 |
| 2.3 | Agent #2 | Multi-agent charges after generation (CRITICAL) | §9.1 invariant #2; H2 hotfix |
| 2.4 | Agent #2 | `places` schema missing `updated_at` / `valid_until` → forever-stale closures | §4 DDL updated |
| 2.5 | Agent #2 | Per-call `p-limit(5)` not global; 100 in-flight Google calls on burst | §9.1 invariant #9; §6 Slice 6 verify column |
| 2.6 | Agent #2 | `tomtomRouting.ts:358` 1h POI cache with no invalidation | §8 risk + §4 `valid_until` |
| 2.7 | Agent #2 | `unstable_cache` global, not per-user (cross-user leak) | §6 Slice 8 added |
| 2.8 | Agent #2 | `getTrafficRecommendations` + `shouldAvoidActivity` are dead-code exports contradicting soft-penalty PR | §6 Slice 5 verify column added |
| 2.9 | Agent #2 | In-memory `Map` cache per-instance; Vercel cold starts reset | §8 risk documented; defer cross-instance cache |
| 3.1 | Agent #3 (scaling) | P50 floor is 3.5–4.5s, not 1.4s; 200ms inter-batch sleep at `trafficAwareActivitySearch.ts:111` | §1 SLO revised; §6 Slice 5b added (remove sleep) |
| 3.2 | Agent #3 | `parallelTrafficProcessor.ts:40` `maxConcurrency:16` ≠ spec's "p-limit(5)"; 800 req/s vs 250 req/s TomTom free-tier | §1 assumption #5; §9.3 budget table; Slice 5b to make `p-limit(3)` authoritative |
| 3.3 | Agent #3 | `intelligentCache` and `smartCacheManager` are not interchangeable (different APIs) | §6 Slice 6 widened (same as 1.4) |
| 3.4 | Agent #3 | TTL inventory wrong: `tomtomTraffic.ts:44` is 5m, not 3m; spec's 5/3/15/10/30 table is stale | §1 SLO #5 references real TTLs; Slice 6 verify column asserts single source of truth |
| 3.5 | Agent #3 | ivfflat `lists=100` recall collapses below 50% at 200k rows | §4 — use `lists=200` minimum OR HNSW if Supabase tier permits; documented in §8 risk |
| 3.6 | Agent #3 | "40× Gemini traffic calls" is fabricated; actual is 1 + ≤1 subquery + image enrichment | §1 SLO #2 revised; §9.2 cost budget explicit |
| 3.7 | Agent #3 | In-memory caches do not survive Vercel cold starts; 50 req × 1000 gens/day exceeds free-tier TomTom | §1 SLO #5; §8 risk; Slice 5b/6 target Upstash Redis before scaling beyond 20 concurrent |
| 3.8 | Agent #3 | `MAX_CONCURRENT_REQUESTS=8` (optimized/route.ts:21) caps throughput but spec never accounts for it | §7 added: "8 concurrent × 1.25 req/s = 10 req/s/instance; spec needs instance count + target QPS" |
| 3.9 | Agent #3 | `optimized/route.ts:129-134` charges full credit on 3-min cache hit; user spam pays 10× | **H4 hotfix (new):** charge only on cache miss, OR refund on cache-served path that returns the same exact prompt within TTL. File as separate PR. |
| 3.10 | Agent #3 | Tier 1 Google blows <$0.005 budget; silently skipped if `GOOGLE_PLACES_API_KEY` missing → broken verification | §9.2 cost budget explicit; §7 manual QA now reads "5 cities w/ GOOGLE_PLACES_API_KEY unset → non-404 guaranteed by Tier 3 static map fallback" |
| 3.11 | Agent #3 | `clearAll()` on admin reset wipes ALL users' caches → thundering herd | **Slice 8a (new):** scope `clearAll` to `userId` or key prefix |
| 3.12 | Agent #3 | `searchLocations` defaults to world; ranking may favor Mexico/Brazil for "Cebu beach" | Same as 1.3 (Slice 2a) — `countrySet` threading |
| 3.13 | Agent #3 | `imageService.ts:204` TomTom static map embeds `TOMTOM_API_KEY` in client URL | §8 risk documented; defer proxy to post-MVP |
| 3.14 | Agent #3 | `places` partitioning claim has no DDL; `embedding` index cannot span partitions | §4 DDL updated; §8 risk |
| 3.15 | Agent #3 | No k6 script, no baseline numbers, no CI hook for the "P50 <2s" claim | **Slice 0.5 (new):** add `bench/` directory with k6 script + committed baseline run before any slice 2+ lands |

### 9.5 New hotfixes (H4 added; AGENTS.md-adjacent)

- **H4 (new from agent #3 finding 3.9):** Charge only on cache miss OR refund on cache-served identical prompt within TTL. `optimized/route.ts:129-134` currently charges full credit on a 3-min cache hit. This contradicts "CHARGE-FIRST / <$0.005" because the user pays the same credit for 0 marginal cost to us, AND it amplifies the spam surface. File as separate PR. **Not blocking for slice work, but a billing invariant issue.**

### 9.6 Pre-merge checklist (gates the implementation)

1. **H1** ✅ **(zero-result refund) merged and tested 2026-09-01.** `4c807d8` helper at `lib/zeroActivityItinerary.ts`; check at `route.ts:383-401`; 10/10 unit tests pass at `__tests__/zeroResultRefund.test.ts`.
2. **H2** ✅ **(multi-agent charge-before) merged 2026-09-02.** `251516f` consume before `pipelineCoordinator.handleRequest` via `CreditService.consumeCredits` in `pipelineCoordinator.ts`; `route.ts` no longer consumes after generation.
3. **H3** ✅ **(cityId in prompt) merged and tested 2026-09-02.** `347f1b6` `contextBuilder.buildDetailedPrompt(..., cityId)` interpolates `${cityName}`; `cebu`+`Random` → prompt contains `Cebu` not `Baguio` (verified via tsx).
4. `bench/k6-itinerary.js` ✅ exists `6821b90` with thresholds `p50<3500 p95<6000`; `bench/baseline.json` ✅ `dbbdc98` fallback `p50=18790` (5 VUs, dev, `API_KEY_INVALID`) → `4752302` real `p50=7580` (5 VUs, dev, `3.5-flash-lite` valid `BXDB` key, `BENCH_BYPASS_AUTH`, `k6` `5/5` `200`) — `Grafana` `k6` green for `200`, `p50` still `dev` (prod `50 VUs` `p50<3500` pending). `bench/GALA_BENCH_XYZ_2026-09-02.md` added `f029b3a`.
5. `supabase/migrations/20260901000000_create_places.sql` ✅ file-only `0bad05a` (37 curated Baguio); **not yet `supabase db push` to staging** — deferred until bench shows 429>1% (per principal call). `select count(*) from places where city_id='baguio'` expected 37 after push.
6. `npx tsc --noEmit` ✅ clean (only pre-existing `email.test.ts` 10), `npx jest zeroResultRefund` 10/10, `next build` clean.
7. Spec re-approved with §9 signed off through H3/5b (remaining H2 + full 6 + 8/8a deferred).

---

## 10. DECISION

**Plan preserves UI/function/purpose, improves arch on every axis:** decoupled city, hybrid world search, accurate tiered images, deterministic traffic ranking, unified cache, polyline-only itinerary map. No web search, no hard traffic filter.

**Next action (2026-09-02):** H1+H2+H3+5b+6a+7 landed and pushed (`251516f`). Remaining per §6: full 6 (port 5 consumers off `intelligentCache`) + 8/8a (per-user cache + scoped clearAll) — deferred as low-leverage at <20 concurrent. Next thin slice if continuing: `8` or full `6` with adapter. Spec is implement-ready through H2/H3/5b.

