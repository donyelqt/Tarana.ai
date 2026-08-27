# Tarana Eats — City Scale Plan

**Status:** Draft — Ready for Review
**Date:** 2026-08-25 | **Scope:** Keep UI/function/purpose identical, enable strict city-scoped Eats beyond Baguio
**Depends on:** `cityConfig.ts` (shipped, Gala), `imageService.ts` tiered images (shipped)

---

## 1. Problem

Eats is Baguio-locked: 20 restaurants + 20 full menus hardcoded as `src/app/tarana-eats/data/menus/*.ts` (56 Baguio refs). No city concept in form/API (`grep city` = 0), no DB. Adding Cebu requires 20 new TS files + PR. TomTom/Places provide POI names but **zero per-dish price data**, so Gala’s hybrid retrieval does not transplant.

Scaling blocker is **structured menu ingestion**, not retrieval. 80% content ops, 20% arch.

## 2. Goals / Non-Goals

**Goals:**
- Strict city scope: `baguio` → only Baguio menus, `cebu` → only Cebu menus (no leakage)
- Data decoupled from code (add a city via inserts, not a PR)
- Images never broken (curated → Unsplash/Wiki → map)
- Backward compat: no cityId = baguio, existing saved meals unaffected

**Non-Goals:**
- Auto-scraping menus from delivery apps (legal/fragile)
- Traffic-aware food ranking (marginal value)
- Replacing curated Baguio menus with thin POI data

## 3. Proposed Architecture

```
User [Destination chips: Baguio • Cebu • Manila ▾] + budget/cravings
  │
  ├─ cityConfig.ts → cityId → bounds/center (reuse Gala)
  │
  ├─ Menu Retrieval (strict per city)
  │   ├─ Try: pgvector over eats_menu_items where city_id = $1 (exact dish+price)
  │   └─ Fallback: TomTom Places restaurants <city> bounds (no prices) → show place card
  │        with price_level estimate, imageService photo, tag "menu unavailable"
  │
  ├─ imageService (reuse) → curated eats images → Unsplash → Wiki → TomTom map
  │
  └─ budgetAllocator + Gemini food-recommendations (unchanged, now city-scoped)
```

## 4. Data Model

```sql
-- Replaces hardcoded TS menus
create table eats_restaurants (
  id text primary key, -- cityId:slug e.g. "cebu:k-flavors-cebu"
  city_id text not null, -- baguio|cebu|manila|davao|ph-wide
  name text not null,
  cuisine text[],
  price_range int4range,
  lat double precision, lon double precision,
  image_url text,
  created_at timestamptz default now()
);
create index on eats_restaurants (city_id);

create table eats_menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text references eats_restaurants(id) on delete cascade,
  city_id text not null,
  name text not null,
  price numeric not null,
  category text, -- appetizer|main|dessert|drink
  description text,
  embedding vector(768),
  created_at timestamptz default now()
);
create index on eats_menu_items (city_id);
create index on eats_menu_items using ivfflat (embedding vector_cosine_ops) with (lists=100)
  where embedding is not null;

-- Migration: seed existing 20 Baguio TS menus via script (one-time)
```

No change to `saved_meals` (already stores `cafe_name, price, image, menu_items jsonb`).

## 5. API / UI Changes

**Form:** Add `Destination` chips to `TaranaEatsForm.tsx` (same 6-city UX as Gala, default `baguio`). Add `cityId?: CityId` to `FormData` (reuse `src/lib/data/cityConfig.ts` type).

**Client service:** `tarana-eats/services/recommendationEngine.ts` + `services/menuIndexingService.ts` — add `cityId` param, filter `where city_id`.

**API:** `src/app/api/gemini/food-recommendations/route.ts` — zod `cityId` enum optional (passthrough), pass to `menuIndexingService.search(cityId, queryEmbedding)` and to prompt (`for ${cityLabel}`).

**Images:** Wire `imageService.enrich` for any restaurant lacking `image_url` (same tiered chain as Gala).

## 6. Slices (Verifiable, Incremental)

| Slice | Touch | Verify |
|---|---|---|
| 0. Decouple data from code | Create `eats_restaurants`/`eats_menu_items` tables + seed 20 Baguio menus via script | `select count(*) from eats_menu_items where city_id='baguio'` = existing menu item count; `npx tsc --noEmit` clean |
| 1. Strict city scope | Add `cityId` to `TaranaEatsForm`, `FormData`, `food-recommendations` zod + service filter; UI chips default `baguio` | `cityId=cebu` → 0 Baguio dishes, `cityId=baguio` → identical to prod; `npx tsc` clean |
| 2. Ingestion (unlock) | Admin `POST /api/eats/admin/restaurants` + menu CSV import (name,price,category) | Insert 1 Cebu restaurant via CSV → `cityId=cebu` returns it |
| 3. Hybrid discovery fallback | When `menu_items` count =0 for city, TomTom Places `restaurants <city>` → place card (no prices) + imageService | `cityId=davao` (no menus yet) → returns TomTom restaurants with map/Unsplash images, no hallucinated prices |

Each slice ships behind `cityId` default — Baguio behavior preserved until Slice 2 provides data.

## 7. Verification / Done

- Unit: `menuIndexingService` returns only requested `cityId` (no leakage)
- Live: `baguio` → 20 restaurants, `cebu` (empty) → TomTom place cards, `cebu` (seeded) → exact dish+price
- Build: `npx tsc --noEmit` clean, `next build` no `remotePatterns` warnings
- Images: every card has non-404 image (curated or fallback)
- No regression: existing `/saved-meals` read/write still works

## 8. Risks

- **Content velocity:** Menus must be typed per city — without Slice 2, Eats stays Baguio-only (acceptable). Mitigate: CSV import + admin form.
- **No per-dish photos at scale:** Unsplash/Wiki are category-accurate, not dish-specific — mitigated by restaurant-level photo + TomTom map fallback.
- **Budget allocator with `ph-wide`:** Wide bounds dilute relevance — mitigate: keep `ph-wide` as TomTom discovery only (no exact-price matching).

## 9. Decision

Do **Slice 0+1** now (future-proof, ~1 day, zero behavior change). Start **Slice 2** only when a menu owner for the 2nd city is committed. Defer **Slice 3** until a city has zero menus but you want discovery.

