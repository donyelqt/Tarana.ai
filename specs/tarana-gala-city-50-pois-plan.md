# Tarana Gala — Davao/Manila/Cebu → 50 Live Tourist POIs Plan

**Status:** Ready for implementation
**Date:** 2026-09-25
**Consumers:** Tarana Gala itinerary generation and Dashboard Suggested Spots
**Target cities:** Cebu, Manila, Davao
**Baguio:** unchanged in this initiative

---

## 1. Scope and current state

Two independent live-location pipelines currently serve the target cities:

| Consumer | Current path | Current cap |
|---|---|---|
| Dashboard `SuggestedSpots` | `GET /api/spots?city=` → one TomTom fuzzy search → bounds/dedupe → rotation → head enrichment → first 3 cards | Intended 12, but the upstream TomTom request is hardcoded to `limit=10`, so 12 is not reachable in production |
| Tarana Gala | `findAndScoreActivities` → non-Baguio TomTom query loop → bounds/dedupe/rotation → map at most 20 → `FINALIST_CAP=12` before traffic/image work | Depends on several 10-result requests; no shared 50-item pool |

The operational caps are:

| Cap | Location | Must change? |
|---|---|---|
| 10 results per TomTom request | `src/lib/services/tomtomRouting.ts:316-373` | Yes, for the coverage path only |
| 12 Dashboard response | `src/app/api/spots/route.ts:196-208` | Yes → up to 50 |
| 6 Dashboard enrichment head | `src/app/api/spots/route.ts:22-23,233-252` | No — cost control |
| 3 Dashboard visible cards | `src/app/dashboard/components/SuggestedSpots.tsx:28-36` | No — render cap |
| Gala 12/20 candidate caps | `src/app/api/gemini/itinerary-generator/lib/activitySearch.ts:268-350,489-497` | Candidate pool yes; expensive shortlist no |
| 18 Gala prompt activities | `contextBuilder.ts` | No |

**Fact:** `public.places` already exists with `city_id`, `title`, `lat`, `lon`, `category`, `source`, `image_url`, `metadata`, `valid_until`, and timestamps (`supabase/migrations/20260901000000_create_places.sql`). Its RLS is deny-all, and server code uses `supabaseAdmin` (`supabase/migrations/20260924000000_rls_deny_all_places_embeddings_users.sql`).

**Gap:** `activitySearch.ts` writes live TomTom results into `places`, but no code reads `places` back. `spots/route.ts` does not use `places` at all. Grokking the existing world-scale plan, the intended read path is missing, not the schema.

**Fact:** current TomTom search uses the fuzzy endpoint and hardcodes `limit=10`. The official Search API supports `limit` up to 100 and has a POI-only endpoint (`poiSearch`). Sources:

- https://docs.tomtom.com/search-api/documentation/search-service/fuzzy-search
- https://docs.tomtom.com/search-api/documentation/search-service/points-of-interest-search
- https://docs.tomtom.com/search-api/documentation/poi-categories-service/poi-categories

---

## 2. Objective

Return up to **50 accepted, live, tourist-oriented POIs per target city**, sourced from TomTom through one shared server-only location service, cached in `places`, and consumed by both Gala and Dashboard without multiplying traffic or image fan-out.

“Top 50” means the retrieval pool. It does not mean:

- 50 rendered Dashboard cards;
- 50 final itinerary activities;
- 50 image fetches;
- 50 traffic fetches;
- 50 hardcoded places.

**Acceptance in one sentence:** Cebu, Manila, and Davao can each serve up to 50 unique, in-bounds, category-verified POIs from a fresh `places` cache or a TomTom POI backfill, while Dashboard still renders 3 cards and Gala still shortlists 12 before expensive enrichment.

---

## 3. Non-goals

- No curated catalog for Cebu, Manila, or Davao unless live coverage proves insufficient.
- No new external provider or dependency.
- No widening of city bounds without evidence.
- No increase in final itinerary activity count.
- No 50-card Dashboard redesign.
- No image or traffic call for every one of the 50 candidates.
- No fabricated fallback traffic levels or Baguio substitution for target-city failures.

---

## 4. Canonical architecture

```text
Gala / Dashboard
      │
      ▼
touristPoiService.getTouristPois(cityId, limit=50)
      │
      ├─ 1. Validate cityId (target-city allowlist; never unknown → Baguio)
      │
      ├─ 2. readFreshPlaces(cityId, 50)
      │      └─ places: valid_until IS NULL OR valid_until > now()
      │
      ├─ 3. If fewer than target: TomTom POI Search backfill
      │      ├─ fixed tourist query buckets (not consumer-specific)
      │      ├─ poiSearch with limit <= 100, countrySet, language, bounds, view=Unified
      │      └─ stop when 50 accepted
      │
      ├─ 4. Quality gate
      │      ├─ POI-only
      │      ├─ city-bounds check
      │      ├─ tourist category allowlist
      │      └─ stable dedupe
      │
      ├─ 5. Upsert accepted rows into places
      │      └─ source='tomtom', valid_until=now()+7d,
      │         metadata={tomtomId, score, category, categories, address, query}
      │
      └─ 6. Return ranked SearchResult[] (up to 50)
```

Consumer responsibilities:

- **Dashboard `/api/spots`:** map the shared service output into the existing `SpotPayload` DTO. Enrich only the top 6 after ranking/rotation. Return up to 50.
- **Gala `findAndScoreActivities`:** replace the non-Baguio direct TomTom loop with the shared service. Keep interest boosting and `FINALIST_CAP=12` before traffic/image work. Do not write `places` inline anymore; the service owns that.
- **Baguio:** keep the curated branch untouched.

---

## 5. Contracts

> **Measured coverage gate (2026-09-25, live TomTom key, strict allowlist + clean single-term buckets):**
>
> | City | Raw | Accepted | Ineligible | Over cap | Result |
> |---|---|---|---|---|---|
> | Cebu | 169 | **50** | 71 | 43 | Reaches 50 |
> | Manila | 100 | **50** | 0 | 50 | Reaches 50 |
> | Davao | 192 | **16** | 160 | 0 | Genuine shortfall |
>
> Cebu and Manila reach the 50-POI target from live POI Search. **Davao does not:**
> only 16 of 192 raw results pass the tourist allowlist, and the rest are
> commercial or civic POIs (company, shop, automotive dealer, petrol station,
> condominium, government office). There is no over-cap backlog to promote —
> Davao simply lacks live tourist-category inventory in TomTom.
>
> `categorySearch` can reach 50 for Davao, but the mix is overwhelmingly churches
> (46 churches + 2 parks + 2 attractions), which is category padding, not a
> credible tourist-spot list.
>
> **Consequence:** the 50-POI target is achievable for Cebu and Manila today.
> Davao needs a product decision, not padding: ship the honest measured count,
> curate a Davao supplement, or accept a different source. The implementation
> returns the measured count and never fabricates the gap.


### 5.1 City validation

The shared service accepts only canonical target IDs:

```ts
type TargetCityId = 'cebu' | 'manila' | 'davao';
```

Unknown IDs must throw or return an explicit unsupported result. They must never silently fall back to Baguio.

### 5.2 POI search method

Extend the existing TomTom adapter; do not fork a second HTTP client.

```ts
type PoiSearchOptions = {
  countrySet?: string;
  language?: string;
  limit?: number; // clamped to 1..100
};

searchPois(
  query: string,
  bounds: BoundingBox,
  options?: PoiSearchOptions,
): Promise<SearchResult[]>;
```

Behavior:

- endpoint: `/search/2/poiSearch/{query}.json`;
- parameters: `limit`, `countrySet`, `language`, `topLeft`, `btmRight`, `view=Unified`;
- default limit for the coverage path: `50`; cap: `100`;
- existing fuzzy `searchLocations` remains unchanged with `limit=10`;
- cache key includes query, bounds, country, language, and limit;
- one 429 retry remains the existing behavior.

### 5.3 Tourist eligibility

Extend `SearchResult` with optional provider category metadata:

```ts
categories?: string[];
categorySet?: number[];
```

A result is eligible only when all are true:

1. provider `placeType` normalizes to `POI`;
2. both coordinates are finite;
3. coordinates pass `isWithinCityBounds(lat, lon, cityId)`;
4. name and stable ID are non-empty;
5. normalized category metadata contains an allowlisted tourist category.

Allowlist groups (category names, not unverified numeric IDs):

- attraction / tourist attraction / important tourist attraction
- landmark / monument / historic site / historical
- museum / cultural center / arts center
- park / garden / botanical / nature reserve / wildlife
- viewpoint / scenic / observation
- beach / waterfall / lake / island
- zoo / aquarium / amusement park / theme park
- cathedral / church / temple / mosque / religious site
- palace / fort / castle / promenade / pier / marina

Reject generic restaurants, cafes, hotels, malls, offices, residences, ATMs, fuel, and unknown categories. Do not use a minimum TomTom relevance score as a tourist-quality proxy; `score` is query relevance, not a quality guarantee. Rank by score but define quality by category and bounds.

### 5.4 Dedupe and ordering

Use this precedence:

1. provider ID collision → drop lower-scoring duplicate;
2. normalized name + 4-decimal coordinate collision → drop lower-scoring duplicate;
3. same normalized name within the same 3-decimal coordinate bucket → keep the highest-scoring row (handles provider coordinate jitter);
4. distinct names at the same coordinates remain distinct rows.

Do not use coordinate-only dedupe. It collapses distinct venues that share a building or gate.

### 5.5 `places` cache contract

New server-only helper, co-located with the location service or under `src/lib/data/`:

```ts
readFreshPlaces(cityId: TargetCityId, limit: number): Promise<SearchResult[]>;
upsertTouristPlaces(cityId: TargetCityId, results: SearchResult[]): Promise<void>;
```

Rules:

- `readFreshPlaces` queries `places` with `city_id=cityId` and `(valid_until IS NULL OR valid_until > now())`, ordered by `updated_at DESC`;
- `readFreshPlaces` never throws into the request path; a missing table or DB error logs a safe warning and falls back to TomTom;
- `upsertTouristPlaces` writes `source='tomtom'`, `valid_until=now()+7d`, and full provenance metadata;
- a repeated request within 7 days should be served from `places` without calling TomTom when at least the target number of fresh rows exists;
- an empty TomTom result must not delete valid cached rows;
- `places` access stays server-side through `supabaseAdmin`; no client access.

### 5.6 Rollback

`TOURIST_POI_CACHE_ENABLED=false` disables the `places` read/write path and uses live TomTom only. Default is `true`. This is the rollback lever; no schema change is required.

---

## 6. Implementation slices

### Slice 1 — TomTom POI-only contract

**Files:**

- `src/lib/services/tomtomRouting.ts`
- `src/types/route-optimization.ts`
- `src/lib/services/__tests__/tomtomRoutingSearch.test.ts`

- [x] add `searchPois` with bounded limit, POI endpoint, bounds, country/language, `view=Unified`;
- [x] preserve `searchLocations` and its current default limit;
- [x] add category metadata to the transform;
- [ ] add tests proving the fuzzy default is unchanged and the POI method clamps `limit`.

**Verify:**

```text
pnpm test -- --runInBand src/lib/services/__tests__/tomtomRoutingSearch.test.ts
pnpm exec tsc --noEmit
```

### Slice 2 — Shared tourist POI service and `places` cache

**Files:**

- `src/lib/services/touristPoiService.ts` (new)
- `src/lib/data/touristPoiCache.ts` (new) or equivalent, server-only
- `src/lib/data/touristPoi.ts` (new) for eligibility and dedupe helpers
- service/cache tests

**Changes:**

- [x] validate the target-city allowlist;
- [x] fixed query buckets, such as:
  - `tourist attractions {city}`
  - `landmarks museums parks {city}`
  - `historic sites viewpoints {city}`
  - `beaches nature {city}`
- [x] stop as soon as 50 accepted unique POIs are reached;
- [x] require POI type, category allowlist, city bounds, valid coordinates;
- [x] dedupe by provider ID, normalized-name + coordinates, and same-name coordinate jitter;
- [x] read fresh `places` rows first;
- [x] backfill through TomTom only when fresh cache coverage is below target;
- [x] upsert accepted results with seven-day validity and provenance;
- [x] return honestly fewer than 50 when coverage is insufficient — never pad.

**Verify:**

```text
pnpm test -- --runInBand <new service/cache tests>
pnpm exec tsc --noEmit
```

### Slice 3 — Dashboard adapter

**Files:**

- `src/app/api/spots/route.ts`
- `src/app/api/spots/__tests__/route.test.ts`

**Changes:**

- [x] replace only the non-Baguio TomTom branch with `touristPoiService`;
- [x] return up to 50 POIs;
- [x] keep `ENRICH_LIMIT=6`;
- [x] keep the three-card client unchanged;
- [x] keep Baguio behavior unchanged;
- [x] preserve the existing `SpotPayload` response shape;
- [x] ensure traffic is only set from a measured result, never a fallback.

**Acceptance:**

- [x] `GET /api/spots?city=manila|cebu|davao` returns at most 50 rows;
- [x] every returned row has finite coordinates inside the requested city bounds;
- [x] no duplicate identity keys;
- [x] no generic business or address row;
- [x] response remains compatible with `toSpotCard` and `SpotlightCard`.

**Verify:**

```text
pnpm test -- --runInBand src/app/api/spots/__tests__/route.test.ts
pnpm exec tsc --noEmit
```

### Slice 4 — Gala adapter

**Files:**

- `src/app/api/gemini/itinerary-generator/lib/activitySearch.ts`
- relevant activity-search tests

**Changes:**

- [x] replace the non-Baguio direct query loop, bounds/dedupe/rotation, and inline `places` upsert with the shared service;
- [x] keep the up-to-50 candidate pool available to interest boosting;
- [x] keep `FINALIST_CAP=12` before traffic/image enrichment;
- [x] keep final itinerary activity counts bounded;
- [x] preserve strict city scoping and honest empty results;
- [x] remove the duplicated TomTom query map from Gala.

**Acceptance:**

- [x] non-Baguio Gala sources its candidates from the shared service;
- [x] traffic and image work still touches only the bounded shortlist;
- [x] no Baguio result enters Cebu, Manila, or Davao;
- [x] zero upstream results does not fabricate a city itinerary.

**Verify:**

```text
pnpm test -- --runInBand <activity-search tests>
pnpm exec tsc --noEmit
```

### Slice 5 — Coverage probe and full verification

**Files:**

- `scripts/tomtom-quality-probe.ts` or `scripts/tomtom-tourist-coverage-probe.ts`

**Changes:**

- probe Cebu, Manila, and Davao through the POI endpoint;
- report raw, accepted, rejected-by-category, out-of-bounds, duplicate, and latency counts;
- never print API keys or raw request URLs;
- report a clear blocked status when credentials are absent.

**Checks:**

```text
pnpm test -- --runInBand
pnpm exec tsc --noEmit
pnpm clean
pnpm build
node scripts/check-bundle-budget.mjs
```

Then run an Osmani review focused on:

- POI-only and category correctness;
- no cross-city leakage;
- no padding to 50;
- bounded external calls and cost;
- cache correctness and outage behavior;
- response contract compatibility.

---

## 7. Required acceptance tests

1. `searchPois` sends `/poiSearch/`, respects `limit <= 100`, sends bounds/country/language/view, and leaves fuzzy `searchLocations` at its existing default.
2. A generic business row with `category=office` is rejected.
3. A non-POI address is rejected.
4. An out-of-city POI is rejected.
5. Provider-ID duplicates and normalized-name + coordinate duplicates are collapsed.
6. Distinct venues at the same coordinates remain distinct.
7. Fresh `places` rows are served without calling TomTom.
8. Insufficient fresh `places` rows trigger a bounded TomTom backfill.
9. TomTom failure returns valid fresh cached rows, not an empty overwrite.
10. `GET /api/spots?city=cebu|manila|davao` returns at most 50, bounded, deduped, tourist-only rows.
11. Dashboard still enriches at most the head and still renders three cards.
12. Gala still shortlists at most 12 before traffic/image work and never leaks Baguio.
13. The live coverage probe reports accepted counts per target city.

---

## 8. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| TomTom has fewer than 50 allowlisted POIs in a city | Target unmet | Return fewer honestly; run the live probe; only consider curation with recorded evidence |
| Category names differ from the allowlist | False rejects | Keep the allowlist in one reviewed module; log rejected samples by category in the probe |
| Cold-start TomTom cost/latency | Slower first request | `places` read-first path, bounded query buckets, 7-day validity, in-process HTTP cache |
| DB unavailable or migration absent | Cache miss only | Catch read/write failure, log safely, fall back to TomTom; never fail the request |
| Duplicate or overlapping venues | Misleading cards | Provider ID + normalized-name/coordinate dedupe with same-name jitter guard |
| Dashboard enrichment fan-out | Quota blow-up | Keep `ENRICH_LIMIT=6` after ranking/rotation |
| Gala traffic/image fan-out | Latency/cost blow-up | Keep `FINALIST_CAP=12`; pool expansion does not increase enrichment width |
| Existing fuzzy callers regress | Autocomplete/routing breakage | Add a new method; do not change `searchLocations` defaults |
| Target-city failure falls back to Baguio | Wrong-city product behavior | Keep strict-city scoping; do not substitute sample Baguio data |

---

## 9. Definition of Done

- [ ] Cebu, Manila, and Davao have a shared POI-only retrieval path.
- [ ] Each target city can serve up to 50 accepted tourist POIs when upstream coverage exists.
- [ ] Results are POI-only, category-filtered, city-bounded, and deduplicated correctly.
- [ ] Fresh `places` rows are read before TomTom; successful TomTom rows are cached with provenance and expiry.
- [ ] Dashboard returns up to 50, enriches at most 6, and still renders 3 cards.
- [ ] Gala receives up to 50 candidates but still shortlists 12 before traffic/image work.
- [ ] Baguio behavior is unchanged.
- [ ] Unit, route, type, build, bundle-budget, and live-probe checks pass or are explicitly environment-blocked.
- [ ] Osmani review has no unresolved Critical or Required findings.
