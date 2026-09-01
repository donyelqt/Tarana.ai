# Tarana Eats — City Scale Plan

**Status:** REFINED 2026-09-01 (stress test against the 2026-08-25 draft surfaced 14 BLOCKER/CRITICAL findings + 14 MAJOR/MINOR findings; this revision is the implementation-ready spec. **0% of slices implemented.** 1 AGENTS.md stop-ship (H1-Eats charge-first refactor) is out of scope of this spec; file as separate hotfix PR. The 2026-08-25 "Draft — Ready for Review" claim was premature; the spec enabled a Cebu-paying-user-gets-Baguio bug in production.)
**Date:** 2026-09-01 (re-issued) | **Original draft:** 2026-08-25 | **Branch:** local only (MCP gitignored) | **Mode:** Build
**Scope:** Keep UI/function/purpose identical, enable strict city-scoped Eats beyond Baguio
**Depends on:** `cityConfig.ts` (shipped, Gala), `imageService.ts` tiered images (shipped), H1-Eats hotfix (NOT yet landed)

---

## 1. Problem

Eats is Baguio-locked: 20 restaurants + 20 full menus hardcoded as `src/app/tarana-eats/data/menus/*.ts`. No city concept in form/API (grep `cityId` / `city_id` under `src/app/tarana-eats/` and `src/app/api/gemini/food-recommendations/` returns **0 matches**), no DB. Adding Cebu requires 20 new TS files + PR. TomTom/Places provide POI names but **zero per-dish price data**, so Gala's hybrid retrieval does not transplant.

**Current production bug (unchained, since 2026-08-25):** A user picks Cebu in the form → the API receives no `cityId` → Gemini prompt hardcodes "Baguio City" (`src/app/tarana-eats/data/helpers.ts:42` and `src/app/api/gemini/food-recommendations/route.ts:199-261`) → Gemini returns Baguio restaurants → grounding filter at `route.ts:417-435` passes the Baguio names because `foodData.restaurants` is unfiltered (all Baguio) → user is charged 1 credit (`route.ts:360-379` charges-after-success with no refund path) → `useTaranaEatsService.ts:55` writes `location: "Baguio City"` to `saved_meals`. A Cebu user pays 1 credit and receives Baguio recommendations. This violates AGENTS.md "CHARGE-FIRST, ATOMIC, REFUND-ON-FAILURE" and the spec's own "Strict city scope" goal. H1-Eats is the minimum fix; the rest of this spec implements the rest.

Scaling blocker is **structured menu ingestion**, not retrieval. 80% content ops, 20% arch.

---

## 2. Goals / Non-Goals

**Goals:**
- Strict city scope: `baguio` → only Baguio menus, `cebu` → only Cebu menus (no leakage). Enforced at THREE layers: form, engine, prompt + DB filter. Not one.
- Data decoupled from code (add a city via inserts, not a PR)
- Images never broken (curated → Unsplash/Wiki → map). `imageService.enrich` MUST be wired into the Eats pipeline.
- Backward compat: no `cityId` = `baguio`, existing `saved_meals` schema unchanged. But `saved_meals.location` MUST be set from `CITY_CONFIGS[cityId].name`, not hardcoded "Baguio City" — current code is a UX regression masked as backward compat.
- **Charge-first per AGENTS.md.** The current `route.ts:360-379` charge-after pattern is forbidden in any new code and must be refactored before any slice lands.

**Non-Goals:**
- Auto-scraping menus from delivery apps (legal/fragile)
- Traffic-aware food ranking (marginal value)
- Replacing curated Baguio menus with thin POI data — but Slice 3 place-cards for empty cities is allowed and explicitly bounded.
- Charge-after pattern (forbidden by AGENTS.md)
- Engine returning Baguio restaurants for a non-Baguio `cityId` (forbidden by §2 goal 1)
- Mobile/Expo client (separate track)

---

## 3. Proposed Architecture

```
User [Destination chips: Baguio • Cebu • Manila ▾] + budget/cravings
  │
  ├─ cityConfig.ts → cityId → bounds/center (reuse Gala)
  │
  ├─ cityFilter (NEW, load-bearing — enforced BEFORE Gemini, not after)
  │   └─ foodData.restaurants.filter(r => r.cityId === cityId)
  │        → if empty && !SLICE_3_ENABLED → return { matches: [], reason: 'no_menus_in_city' }
  │        → if empty &&  SLICE_3_ENABLED → discoveryService.fetchTomTomPlaces(cityId)
  │
  ├─ Menu Retrieval (strict per city)
  │   ├─ Try: pgvector over eats_menu_items where city_id = $1 (exact dish+price)
  │   └─ Fallback (Slice 3): TomTom Places restaurants <city> bounds (no prices) → show place card
  │        with price_level estimate, imageService photo, tag "menu unavailable"
  │
  ├─ imageService.enrich (NEW wiring — must be called before response)
  │   └─ for each result lacking image_url → tiered chain (curated → Unsplash → Wiki → TomTom static map → comingsoon)
  │
  ├─ Gemini food-recommendations (charge-first per AGENTS.md; prompt MUST interpolate ${CITY_CONFIGS[cityId].name})
  │
  └─ budgetAllocator + recommendationEngine (must accept and enforce cityId param)
```

**Load-bearing additions vs the 2026-08-25 draft:**
- `cityFilter` box is a NEW diagram node that runs BEFORE the Gemini call, not after. This is the single change that prevents the Cebu→Baguio bug.
- `imageService.enrich` is now an explicit pipeline stage, not an aside.
- The prompt box now says "must interpolate" — the existing code hardcodes "Baguio City" and must change.

---

## 4. Data Model

**New tables (replaces hardcoded TS menus):**

```sql
-- Migration file: supabase/migrations/2026xxxx_create_eats_tables.sql

create table eats_restaurants (
  id text primary key, -- cityId:slug e.g. "cebu:k-flavors-cebu"
  city_id text not null, -- baguio|cebu|manila|davao|ph-wide
  name text not null,
  cuisine text[],
  price_range int4range, -- read/write adapter documented in §4.1
  lat double precision, lon double precision,
  image_url text,
  owner_email text not null, -- NEW: content-owner field, required
  content_owner_verified boolean not null default false, -- NEW: gating flag
  last_verified_at timestamptz, -- NEW: set by cron or admin re-verification
  created_at timestamptz default now()
);
create index on eats_restaurants (city_id);
create index on eats_restaurants (owner_email) where content_owner_verified = false;

create table eats_menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text references eats_restaurants(id) on delete cascade,
  city_id text not null,
  name text not null,
  price numeric not null,
  category text, -- appetizer|main|dessert|drink
  description text,
  embedding vector(768), -- populated by §4.2 embedding pipeline
  created_at timestamptz default now()
);
create index on eats_menu_items (city_id);
create index on eats_menu_items using ivfflat (embedding vector_cosine_ops) with (lists=200)
  where embedding is not null;  -- REVISED 2026-09-01: lists=200 minimum (Gala stress test §3.5)
```

### 4.1 Read/write layer (REVISED — was unspecified)

`price_range int4range` ↔ `RestaurantData.priceRange: {min: number, max: number}` is a runtime-mismatch risk. Document the read/write layer explicitly:
- **Write** (admin / CSV import): build `[min, max]` int4range literal in raw SQL via `supabaseAdmin.from('eats_restaurants').insert({ price_range: '[100,500]' })`. Validate min ≤ max ≤ 10000 server-side.
- **Read**: select `lower(price_range), upper(price_range)` and reconstruct `{min, max}` in `recommendationEngine`. The spec's existing averaging logic at `recommendationEngine.ts:130` (`(restaurant.priceRange.min + restaurant.priceRange.max) / 2`) is JS-shape; must work with the reconstructed shape.
- Add a smoke test: round-trip a row, assert `priceRange` object matches input.

### 4.2 Embedding pipeline (NEW — was unspecified)

`embedding vector(768)` is declared but no code populates it. Spec this:

- **Model:** `text-embedding-004` (matches existing itinerary embeddings; 768d, same dimension as `eats_menu_items.embedding` and `itinerary_embeddings.embedding`).
- **Trigger:** `BEFORE INSERT` on `eats_menu_items` via a PL/pgSQL function that calls the `http` extension → Gemini embeddings endpoint. The `http` extension is already enabled in the supabase project (verify in Supabase dashboard; if not, fall back to a Node script `scripts/embed-menu-items.ts` run on CSV import).
- **Backfill:** `scripts/seed-eats-menus.ts` reads the existing 20 hardcoded TS menus, inserts as `city_id='baguio'`, and triggers embedding per row (Node path, since PL/pgSQL + http requires the extension).
- **Re-embed on edit:** `BEFORE UPDATE OF name, description, category` re-embeds.
- **Cost:** ~$0.0001 per dish. 20 Baguio dishes × $0.0001 = $0.002 one-time.
- **Failure mode:** if embedding call fails, row inserts with `embedding = NULL`; ivfflat index is partial on `embedding is not null` so the row is still retrievable via title-based search. Log a warning; backfill in a cron.

### 4.3 Seed script

`scripts/seed-eats-menus.ts` reads the 20 hardcoded TS menus under `src/app/tarana-eats/data/menus/`, parses each into `eats_restaurants` + `eats_menu_items` rows with `city_id='baguio'`, and triggers embedding. Idempotent: `ON CONFLICT (id) DO NOTHING`. After it runs:
- `select count(*) from eats_menu_items where city_id='baguio'` = sum of all dish counts in the 20 menus (count once, commit the number in the script's `-- expected: <N>` comment).
- `select count(*) from eats_restaurants where city_id='baguio'` = 20.

After the seed lands, the static `import { ... } from "./menus/..."` lines at `src/app/tarana-eats/data/restaurants.ts:11-30` MUST be removed (or kept only as a Baguio fallback behind `process.env.USE_TS_MENU_FALLBACK=true`). Removing them is the spec's "Replaces hardcoded TS menus" promise landing.

**No change to `saved_meals` schema** (already stores `cafe_name, price, image, menu_items jsonb`). But the `useTaranaEatsService.ts:55` hardcoded `location: "Baguio City"` MUST be replaced with `location: CITY_CONFIGS[cityId].name` — this is a code change, not a schema change.

---

## 5. API / UI Changes

### 5.1 Form

`TaranaEatsForm.tsx` — add Destination chips (same 6-city UX as Gala's `ItineraryForm.tsx:15-21`, default `baguio`).

`TaranaEatsFormValues` — add `cityId?: CityId` field (reuse `src/lib/data/cityConfig.ts` `CityId` type). FormValues serialization (FormData) MUST include `cityId`.

### 5.2 API

`src/app/api/gemini/food-recommendations/route.ts` — explicit changes:

1. **Add zod import + zod parse of `req.json()`** at `route.ts:108`. Schema includes `cityId: z.enum(['baguio','cebu','manila','davao','ph-wide','world']).optional()`.
2. **H1-Eats charge-first refactor** (file as separate hotfix PR, BLOCKS all slices): at `route.ts:360-379`, call `CreditService.consumeCredits({ userId, amount: 1, service: 'tarana_eats', description: 'food recommendations' })` BEFORE the Gemini call. Wrap Gemini in a `charged = true` flag. On ANY non-success return path (Gemini error, <MIN grounded matches, deterministic fallback, empty result) call `CreditService.refundCredits()`. Remove the pre-flight `CreditService.getCurrentBalance` race at `route.ts:90-106` — rely on `InsufficientCreditsError` thrown by `consumeCredits` atomically.
3. **Server-side city filter BEFORE Gemini**: at the call to Gemini, filter `foodData.restaurants` to `r.cityId === (cityId ?? 'baguio')`. If the filtered set is empty AND `SLICE_3_ENABLED=false` (default for v1), short-circuit to `{ matches: [], reason: 'no_menus_in_city' }` with HTTP 200. Do NOT call Gemini.
4. **Interpolate city into prompts**:
   - `src/app/tarana-eats/data/helpers.ts:42` `createFoodPrompt` → change hardcoded "Baguio City" to `for ${CITY_CONFIGS[cityId].name}`.
   - `src/app/api/gemini/food-recommendations/route.ts:199-261` `enhancedPrompt` → add `in ${CITY_CONFIGS[cityId].name}` to the "CRITICAL INSTRUCTIONS" block.
5. **`parseUserPreferences`** at `route.ts:671-720` → extract `cityId` from body and return it as part of the preferences object.
6. **Wire `imageService.enrich`** at the end of the pipeline (after the engine returns, before the response). For each result lacking `image_url`, call `enrichActivitiesWithImages([...], { city })`.
7. **Set `saved_meals.location`** correctly in `useTaranaEatsService.ts:55` — replace hardcoded "Baguio City" with `CITY_CONFIGS[cityId].name`.
8. **Remove "supplementing with retrieval engine" silent path** at `route.ts:437-458`. If Gemini returns < MIN_RECOMMENDATIONS grounded matches, the route MUST either (a) refund and return the empty state, or (b) charge and return the supplemented set. No silent third path. Default for v1: refund + empty state. Spec Slice 3 (TomTom fallback) is a future improvement.

### 5.3 Client service — ALL signatures being changed (REVISED — was incomplete)

Every function that touches city. Enumerate all of them so no caller is missed:

- `TaranaEatsFormValues` (`src/app/tarana-eats/components/TaranaEatsForm.tsx:31-37`) — add `cityId?: CityId`.
- `FormData` serialization in the same file — include `cityId`.
- `parseUserPreferences` (`src/app/api/gemini/food-recommendations/route.ts:671-720`) — return `cityId`.
- `recommendationEngine.generateRecommendations` (`src/app/tarana-eats/services/recommendationEngine.ts:57-76`) — add `cityId: CityId` param; filter input array at line 76 BEFORE scoring; propagate to `getRecommendedMenuItems` and `getMenuSuggestions`.
- `menuIndexingService.indexRestaurants` (`src/app/tarana-eats/services/menuIndexingService.ts:51-67`) — add `cityId` param; only index restaurants where `r.cityId === cityId`.
- `menuIndexingService.searchMenuItems` — add `cityId` param; only return matches from restaurants where `r.cityId === cityId`.
- `createFoodPrompt` (`src/app/tarana-eats/data/helpers.ts:42`) — accept `cityId`; interpolate `for ${CITY_CONFIGS[cityId].name}`.
- `enhancedPrompt` (`src/app/api/gemini/food-recommendations/route.ts:199-261`) — accept `cityId`; interpolate `in ${CITY_CONFIGS[cityId].name}`.
- `useTaranaEatsAI` payload (`src/app/tarana-eats/hooks/useTaranaEatsAI.ts:27-37`) — add `cityId` to outgoing payload.
- `useTaranaEatsService.saveToMeals` (`src/app/tarana-eats/hooks/useTaranaEatsService.ts:55`) — accept `cityId`; set `location: CITY_CONFIGS[cityId].name`.

All 11 changes ship in Slice 1 as a single atomic PR. Any partial state (e.g., form has cityId but engine doesn't) re-introduces the Cebu→Baguio bug.

### 5.4 Images

`imageService.enrich` (reuse the Gala implementation at `src/lib/services/imageService.ts:91-257`) MUST be called inside the Eats pipeline before the response is returned. The current Eats code never imports `imageService` (grep `imageService` under `src/app/tarana-eats/` → 0 hits). Slice 1 verify column: a query for `cityId=manila` with a TomTom POI card returns a non-404 image (Tier 2 Wikimedia or Tier 3 TomTom static map fallback).

---

## 6. Slices (Verifiable, Incremental)

**Slices ship behind flags** (`USE_CITY_SCOPED_EATS`, `EATS_SLICE_3_ENABLED`, `EATS_H1_LANDED`). Each slice's flag default is OFF until the verify column passes. Baguio behavior is preserved until Slice 2 provides data.

**Estimates are 3-point (O = optimistic, L = likely, P = pessimistic).**

| Slice | Touch | Verify | Est (O/L/P) |
|---|---|---|---|
| **H1-Eats. Charge-first refactor** (out-of-spec hotfix PR) | `route.ts:90-106, 360-379, 437-458`; new `charged` flag; new `refundCredits` on all non-success returns; remove pre-flight `getCurrentBalance` | Jest: mock Gemini success → 1 charge, 0 refund; mock Gemini error → 1 charge, 1 refund; mock <MIN grounded → 1 charge, 1 refund; `tsc --noEmit` clean | 0.5 / 1 / 1.5d |
| **0. Decouple data from code** | Migration `20260901000000_create_eats_tables.sql` (§4 DDL + §4.1/4.2/4.3 + `owner_email` + `content_owner_verified` + `last_verified_at`); `scripts/seed-eats-menus.ts` reads 20 TS menus; pgvector read path in `menuIndexingService.searchMenuItems` (replaces static-file index — see Slice 0b) | `select count(*) from eats_menu_items where city_id='baguio'` = N (commit N); `select count(*) from eats_restaurants where city_id='baguio'` = 20; `npx tsc --noEmit` clean; `seed-eats-menus.test.ts` asserts idempotent re-run | 0.5 / 1 / 1.5d |
| **0b. pgvector read replacing static-file index** | `menuIndexingService.searchMenuItems` switches from in-memory inverted-word index to pgvector query `where city_id = $1` against `eats_menu_items.embedding`; `ivfflat lists=200` index from §4 | Jest: mock pgvector result with 3 dishes in cebu + 1 in manila; query `cityId=cebu` returns only 3; query `cityId=manila` returns 1 | 0.5 / 0.5 / 1d |
| **1. Strict city scope (11-signature atomic PR)** | All 11 signatures in §5.3 land together. Form, API zod, parseUserPreferences, recommendationEngine, menuIndexingService, createFoodPrompt, enhancedPrompt, useTaranaEatsAI, useTaranaEatsService, imageService wiring | Jest: `cityId=cebu` → 0 Baguio dishes at all 11 layers; `cityId=baguio` → identical to prod (snapshot test); `route.test.ts` charge-first + refund-on-failure; `contextBuilder.test.ts` prompt contains 'Cebu' for `cityId=cebu`; `imageService.test.ts` Eats wiring returns non-404; `npx tsc --noEmit` clean | 1 / 1.5 / 3d |
| **2. Ingestion (admin + CSV)** | `POST /api/eats/admin/restaurants`; `POST /api/eats/admin/menu-items/csv`; auth: `getServerSession` + `user.role === 'admin'`; rate limit 10 req/min; CSV size cap 1MB; CSRF; audit log row in `eats_restaurants`; triggers §4.2 embedding per row | Jest: admin auth required (no session → 401); non-admin → 403; CSV parse happy path inserts 3 Cebu restaurants; rate limit triggers at 11th request; smoke test round-trips a row including `int4range` ↔ `{min,max}` | 1 / 2 / 3d (depends on admin-role user being committed) |
| **3. Hybrid discovery fallback (TomTom POI cards)** | `discoveryService.fetchTomTomPlaces(cityId)`; `TomTomPlaceCard` type; UI branch in `FoodMatchCard` / `FoodMatchesPreview` on `dataSource === 'tomtom'`; `imageService.enrich` for POI cards; flag `EATS_SLICE_3_ENABLED` default OFF | Live: `cityId=davao` (no menus, flag ON) returns TomTom restaurants with map/Unsplash images, no hallucinated prices; `cityId=davao` (flag OFF) returns `{ matches: [], reason: 'no_menus_in_city' }`; Jest: empty `foodData` + flag ON → TomTom called; empty + flag OFF → empty state | 1 / 2 / 3d (depends on TomTom `countrySet` threading from Gala Slice 2a) |

**Slice ordering rule:** H1-Eats → 0 → 0b → 1 → 2 (after admin user committed) → 3 (after Gala Slice 2a). Each slice ends with `npx tsc --noEmit` clean and the verify column passing.

**Out of scope:**
- Expo/mobile client (depends on `places` migration landing + a separate mobile track).
- H1-Eats hotfix (filed separately).
- Vite SPA retirement (separate spec; AGENTS.md constraint to keep Vite isolated from Next remains in force).
- Charge-after pattern (forbidden by AGENTS.md).

---

## 7. Verification / Done Criteria

- **Unit** (`npx jest` — currently 145 failing across 24 suites, must reach 0 failing):
  - `seed-eats-menus.test.ts` — idempotent re-run; 20 Baguio restaurants; correct N dishes.
  - `menuIndexingService.test.ts` — `cityId=cebu` returns only Cebu; `cityId=manila` returns only Manila; no leakage.
  - `recommendationEngine.test.ts` — `cityId=cebu` + 20 Baguio input → 0 output; `cityId=baguio` + 20 Baguio input → identical to prod snapshot.
  - `route.test.ts` (H1-Eats) — charge-first; refund on Gemini error; refund on <MIN grounded; refund on empty filtered set; `InsufficientCreditsError` short-circuits before Gemini.
  - `createFoodPrompt.test.ts` — `cityId=cebu` prompt contains "Cebu"; `cityId=cebu` prompt does NOT contain "Baguio" (the old hardcode).
  - `enhancedPrompt.test.ts` — same as above for server prompt.
  - `imageService.test.ts` (Eats wiring) — `recommendationEngine` returns `image_url` for non-curated restaurants; Tier 3 fallback at minimum.
  - `price_range` smoke test — round-trip a row, assert `{min, max}` matches input.
- **Live probes (production-equivalent)**:
  - `baguio` → 20 restaurants + N dishes; `cebu` (empty) → `{ matches: [], reason: 'no_menus_in_city' }` with HTTP 200; `cebu` (after CSV import) → seeded restaurants + exact dish+price.
  - `cityId=cebu` + Gemini-prompt inspection → prompt contains "Cebu", not "Baguio".
  - `saved_meals.location` for a Cebu save → "Cebu City", not "Baguio City".
- **Build**: `npx tsc --noEmit` 0 errors (currently failing), `next build` 0 `remotePatterns` warnings.
- **Billing invariant**: `InsufficientCreditsError` short-circuits before any Gemini call. No free fallback. No charge without refund on non-success.
- **No silent Baguio leakage when `cityId=cebu`**: enforced at 3 layers (form → engine filter → prompt + DB filter).

---

## 8. Risks & Mitigations

- **Content velocity:** Menus must be typed per city — without Slice 2, Eats stays Baguio-only (acceptable). Mitigate: CSV import + admin form. **New:** gate Slice 2 on (a) admin-role user committed, (b) `owner_email` policy documented, (c) rollback plan filed.
- **No per-dish photos at scale:** Unsplash/Wiki are category-accurate, not dish-specific — mitigated by restaurant-level photo + TomTom map fallback. **New:** imageService must be wired into Eats pipeline (Slice 1 verify) before this risk is mitigated for non-Baguio.
- **Budget allocator with `ph-wide`:** Wide bounds dilute relevance — mitigate: keep `ph-wide` as TomTom discovery only (no exact-price matching).
- **`saved_meals.location` hardcoded "Baguio City"** (NEW — discovered in audit) — masked as backward compat; writes wrong data for non-Baguio users. Mitigate: `useTaranaEatsService.ts:55` reads `cityId` and sets `location: CITY_CONFIGS[cityId].name`. Trivial fix; land with Slice 1.
- **`price_range int4range` ↔ JS `{min,max}`** (NEW — discovered in audit) — silent runtime risk. Mitigate: §4.1 documents the read/write layer; smoke test in §7.
- **In-memory caches do not survive Vercel cold starts** (from Gala stress test finding 3.7). Eats in-memory `menuIndexingService` index is rebuilt per cold start; with 100 restaurants, rebuild is fast (<50ms), but as data grows, migrate to Supabase-persisted index or rely solely on the pgvector read path.
- **Multi-agent path charges after generation** (from Gala H2) — out of scope; tracked separately. Same pattern does not exist in Eats (Eats is not multi-agent), but the charge-after pattern at `route.ts:360-379` is the equivalent violation. H1-Eats fixes it.
- **Empty-state UX undefined between Slice 1 and Slice 3** (NEW — discovered in audit) — currently falls through to free fallback. Mitigate: §3 architecture's `cityFilter` box explicitly returns `{ matches: [], reason: 'no_menus_in_city' }` HTTP 200 when filtered set is empty and Slice 3 is disabled.
- **Spec §9 ownership gate is unenforceable** (NEW — discovered in audit) — replaced with concrete gates in §6 Slice 2 entry: (a) admin-role user committed, (b) `owner_email` policy documented, (c) rollback plan filed.

---

## 9. Decision

Do **H1-Eats hotfix first** (charge-first refactor, ~1 day, AGENTS.md compliance). Then **Slice 0** (migration + seed + pgvector read) + **Slice 0b** (replace static-file index with pgvector read) + **Slice 1** (11-signature atomic `cityId` plumbing) as a single release, ~3 days combined. **Slice 2** begins only when (a) an admin-role user is committed, AND (b) `owner_email` policy is documented, AND (c) rollback plan is filed. **Defer Slice 3** until a city has zero menus AND Gala Slice 2a (countrySet threading) lands.

**Rollback plan:** If any slice after H1-Eats lands and the verify column fails, the feature flags (`USE_CITY_SCOPED_EATS=false`, `EATS_SLICE_3_ENABLED=false`) flip the route back to the pre-Slice-0 behavior (all 20 hardcoded TS menus, no cityId, prompt hardcodes "Baguio City"). The H1-Eats charge-first refactor is NOT rolled back — AGENTS.md compliance is non-negotiable.

**Pre-merge gate (in order):**
1. H1-Eats hotfix merged and tested.
2. This spec re-approved.
3. `npx tsc --noEmit` clean, `npx jest` all pass (currently 145 failing).
4. Slices 0 + 0b + 1 landed as a single release.
5. `cityId=cebu` end-to-end verified: 0 Baguio dishes at all 11 layers; `saved_meals.location` = "Cebu City"; prompt contains "Cebu".
6. Slice 2 begins only when the 3 §9 gates are met.

---

## 10. Appendix — Audit Delta vs 2026-08-25 Draft

| # | Source | Finding | Spec action |
|---|---|---|---|
| E.1 | Architect #1 (scope) | Slice 0 0% done; no `eats_restaurants` / `eats_menu_items` migration | §4 named migration file + §4.3 seed script |
| E.2 | Architect #1 | Slice 1 0% done; zero `cityId` plumbing | §5.3 enumerates all 11 signatures |
| E.3 | Architect #1 | Spec §4 says "Replaces hardcoded TS menus" but nothing replaced | §4.3 explicit removal of `restaurants.ts:11-30` static imports |
| E.4 | Architect #1 | "Slice 0+1 now (~1 day)" claim false (0 commits since 2026-08-25) | §6 status column; §9 pre-merge gate |
| E.5 | Architect #1 | Embedding pipeline unspecified | §4.2 (NEW) |
| E.6 | Architect #1 | CSV admin endpoint has no auth spec | §6 Slice 2 verify column + §8 new risk |
| E.7 | Architect #1 | Hybrid fallback (Slice 3) unimplementable today (no TomTom in route) | §6 Slice 3 ordering gated on Gala Slice 2a |
| E.8 | Architect #1 | §6 verification unverifiable (no cityId anywhere) | §6 Slice 1 preconditions; §7 verify column |
| E.9 | Architect #1 | `imageService` NOT wired into Eats | §5.4 explicit; §6 Slice 1 verify; §7 test |
| E.10 | Architect #1 (BLOCKER) | Charge-after violates AGENTS.md | §5.2 H1-Eats; out of scope as hotfix PR |
| E.11 | Architect #1 | No test coverage for Eats | §7 enumerate 8 new test files |
| E.12 | Architect #1 | `saved_meals` regression claim unverified | §5.2 #7 + §8 new risk |
| E.13 | Architect #1 | Spec lacks rollback / feature-flag plan | §6 flag names; §9 rollback plan |
| E.14 | Architect #1 | "56 Baguio refs" cite unverified | removed specific number; replaced with concrete evidence list |
| E.15 | Architect #2 (correctness, CRITICAL) | "Strict city scope" is fiction — every layer missing | §2 goal 1 enforced at 3 layers; §5.3 11 signatures |
| E.16 | Architect #2 (HIGH) | `imageService` not wired | §5.4 |
| E.17 | Architect #2 (CRITICAL) | Eats route charges after, never refunds on zero/failed | §5.2 H1-Eats; §5.2 #8 explicit refund + empty-state |
| E.18 | Architect #2 (HIGH) | Credit balance pre-flight is race, not atomic | §5.2 H1-Eats: remove pre-flight |
| E.19 | Architect #2 (CRITICAL) | Prompt-city invariant violation by construction | §5.2 #4 interpolate city into both prompts |
| E.20 | Architect #2 (HIGH) | Slice 3 fallback self-contradicts Non-Goal; empty-state UX undefined | §3 `cityFilter` box; §5.2 #3 explicit empty state |
| E.21 | Architect #2 (HIGH) | §9 ownership gate unenforceable | §6 Slice 2 entry; §9 Decision 3 gates |
| E.22 | Architect #2 (CRITICAL) | `recommendationEngine` filters nothing by city | §5.3 #4; §6 Slice 1 verify |
| E.23 | Architect #2 (HIGH) | `menuIndexingService` is static-file only | §6 Slice 0b |
| E.24 | Architect #2 (CRITICAL) | Gemini prompt never sees cityId | §5.2 #4 + §5.3 #6/#7 + §7 test |
| E.25 | Architect #2 (MEDIUM) | `price_range int4range` ↔ JS shape | §4.1 (NEW) |
| E.26 | Architect #2 (MEDIUM) | `saved_meals.location` hardcoded "Baguio City" | §5.2 #7; §8 new risk |
| E.27 | Architect #2 (LOW) | §5 enumerates "add cityId param" but omits callers | §5.3 enumerates all 11 |
| E.28 | Architect #2 (LOW) | §6 Slice 1 verify "cityId=baguio → identical to prod" needs snapshot test | §7 snapshot test |
