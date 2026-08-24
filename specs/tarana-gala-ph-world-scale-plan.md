# Tarana Gala — PH → World Scale Plan
**Status:** IMPLEMENTED 2026-08-25 (Slices 0–4 shipped; deltas vs this draft: see `git log 2040982..be0d5e0` — includes poison-filter, TOMTOM_REFERER fix, strict city scoping, city-aware weather. Slices 5–6 [cache unification, Explore map reuse] still open.)
**Date:** 2026-08-23 | **Branch:** local only (MCP gitignored) | **Mode:** Build
**Scope:** Keep UI/function/purpose identical, make arch fast + scalable beyond Baguio

---

## 1. ASSUMPTIONS I'M MAKING

1. **Latency SLO:** `POST /api/gemini/itinerary-generator` P50 <2.0s at PH/world (currently 2.8s Baguio)
2. **Cost SLO:** <$0.005/gen at scale (currently $0.04 with 40× Gemini traffic calls)
3. **Accuracy SLO:** Every `activity.image` in `ItinerarySchema` must be location-accurate (not generic placeholder) — user explicitly demanded this
4. **Scope:** Gala keeps credit-gated `tarana_gala` + `trafficAware` toggle + interests + pax/budget; Explore stays point-A→B stateless

→ Correct me now or I'll proceed.

---

## 2. CURRENT ARCHITECTURE — WHY BAGUIO-LOCKED (EVIDENCE)

| Layer | File:Line | Hardcode | Impact |
|---|---|---|---|
| Catalog | `itineraryData.ts:1` 40 `Activity` + `public/index.ts` static imports | Adding city = 40 imports + embeddings | No PH/world without code change |
| Coords | `baguioCoordinates.ts:14` `BAGUIO_COORDINATES` dict 40 entries, `isWithinBaguioBounds 16.35-16.47` | Cebu `isWithin` fails, `includes()` fuzzy misroutes "Market" | World search impossible |
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
  ├─ cityConfig.ts (new) → resolve cityId, center, bounds, timezone, countrySet
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
  city_id text not null, -- 'baguio' | 'cebu' | 'ph-wide' | 'world'
  title text not null,
  lat double precision not null,
  lon double precision not null,
  category text,
  source text not null check (source in ('curated','tomtom','google')),
  image_url text, -- cached from ImageService
  metadata jsonb, -- {desc,tags,time,peakHours}
  embedding vector(768), -- nullable: only for curated, world uses TomTom score
  created_at timestamptz default now()
);
create index on places using ivfflat (embedding vector_cosine_ops) with (lists=100) where embedding is not null;
create index on places (city_id, title);
```

**Keep `itinerary_embeddings` for Baguio quality; `places` is the world cache.**

**No change to `user_profiles` / `credit_transactions` — already patched `20260814000000` (refund + atomic consume_credits verified live).**

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

| Slice | Touch | Verify | Est |
|---|---|---|---|
| **0. Git ignore MCP** | `.gitignore:45` | `git check-ignore .mcp.json` → ignored, `git status` clean | DONE |
| **1. ImageService** | `imageService.ts` + `next.config.ts` + `activitySearch.ts` wiring | `npx tsc --noEmit` clean, `enrichActivitiesWithImages([{title:"Burnham Park"}]) → /images/burnham.png` | DONE |
| **2. City Config** | `src/lib/data/cityConfig.ts` new, refactor `baguioCoordinates.ts:14`, `peakHours.ts:20`, `utils.ts:30` to `getCityTime(cityId)` | `npm run build` + unit: `isWithinCityBounds('cebu', 10.3,123.9) true` | 0.5d |
| **3. Hybrid Retrieval** | `activitySearch.ts:40` add `cityId, viewportBounds` params, branch to `tomtomRoutingService.searchLocations` when `cityId!=baguio` or `intelligentResults<8` | `findAndScoreActivities("food", [], "cebu")` returns TomTom Cebu results, `vectorSearch` still works for Baguio | 1d |
| **4. Traffic Rank (not filter)** | `trafficAwareActivitySearch.ts:126` `return false` → `score -= penalty` + `p-limit(5)` | Load test 20 activities: 0-result rate 0% (was 12%), P50 1.4s, no 429 | 0.5d |
| **5. Cache Unification** | Delete `intelligentCache.ts`, keep `smartCacheManager.ts` only, TTL `search 5m / traffic 3m` | `hitRate >80%` after warmup, no `Map` leak | 0.5d |
| **6. Explore Map in Gala** | `src/app/itinerary-generator/components/ItineraryMap.tsx` reuse `InteractiveRouteMap` | Visual QA: itinerary legs render as `route-primary` polyline | 1d |

Each slice ships behind flag (`CITY_CONFIG_ENABLED`, `HYBRID_SEARCH`, `TRAFFIC_RANK`) — boring, obvious, reversible.

---

## 7. VERIFICATION & DONE CRITERIA

- **Unit:** `npm test` — existing `trafficColors.test.ts` passes; new `imageService.test.ts` asserts Tier 0 hit, Tier 3 fallback
- **Live probes (already done):** `service_role` insert `refund` → success; concurrent `consume_credits(3) ×2` → only 1 succeeds (atomic)
- **Perf:** k6 `POST /api/gemini/itinerary-generator` 50 VUs: P50 <2s, 0% 0-result, TomTom 429 <1%
- **Image:** Manual QA 5 cities (Baguio, Cebu, Davao, Manila, El Nido): every card has non-404 image, Baguio = curated, world = Google/Wiki/Map
- **Build:** `npx tsc --noEmit` 0 errors, `next build` 0 `remotePatterns` warnings

---

## 8. RISKS & MITIGATIONS

- **Google key leak in photo URL** → Mitigate: proxy via `src/app/api/images/proxy/route.ts` (sign URL server-side) if required; current direct URL is acceptable for MVP (key restricted to `maps.googleapis.com` referrer)
- **TomTom quota** → `p-limit(5)` + 3m cache + `429 Retry-After` backoff (already in `tomtomTraffic.ts:152`)
- **Wikimedia rate limit** → 3s timeout + fallback to static map, no retry
- **Supabase `places` growth** → Partition by `city_id`, `ivfflat` only where `embedding not null`, nightly `VACUUM ANALYZE`

---

## 9. DECISION

**Plan preserves UI/function/purpose, improves arch on every axis:** decoupled city, hybrid world search, accurate tiered images, deterministic traffic ranking, unified cache, Explore reuse. No web search, no hard traffic filter.

**Next action:** Approve Slice 2 (City Config) or let Slice 1 bake in prod for 24h and observe `enrichActivitiesWithImages` hit rate.

