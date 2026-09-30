# Tarana Gala — Image Resolution Bug Fixes (v1, shipped)

> **Status 2026-10-01: shipped on `main` via #674, #675, #676, #677.** This file
> records the shipped shape, the evidence that each root cause was real, and
> the guards that keep it fixed. It is a record, not a plan — there is no
> remaining work in it.

The single user-visible symptom, reported four ways:

1. "the logs show it finds imgs through the unsplash … but still used the fallback"
2. "why at baguio is using the fallback img? isn't our baguio has already curated images"
3. "for poblacion market it uses the img of night market … that's baguio not manila"
4. "it should use the fallback img"

Every one was a **different** root cause wearing the same costume. Six landed
bugs, eight fixed sites, and a silent failure mode: a wrong or missing photo
produces no log line, so the tier logs looked healthy while the card rendered
something else.

---

## 1. Impact, measured

### 1.1 What the logs said vs what shipped

| Run (from the report) | Activities | Image resolved by the tier chain | Correct image on the card |
|---|---|---|---|
| Boracay | 9 | 5 (Unsplash) | 0 — all wiped, showed the placeholder |
| Manila (parks) | 12 | 7 (Unsplash/Wikimedia) | 0 — all wiped, showed the placeholder |
| Manila (markets) | 12 | 4 (Unsplash) | 4 correct + 8 with no photo to show |
| Baguio | 12 | 0 (curated catalog, never logged) | 0 — the curated photo was never attached |

Reproduced deterministically in `imagePipeline.e2e.test.ts` against the
pre-#674 code:

```
expected: https://images.unsplash.com/photo-luneta-park-abc?w=1200
received: /images/comingsoon.png
```

That is the reported symptom in two lines: the log promised Unsplash, the
response carried the fallback.

### 1.2 Blast radius

- **City scopes affected:** 7 of 8 (`manila`, `cebu`, `davao`, `boracay`,
  `el_nido`, `ph-wide`, `world`). Only `baguio` was ever correct-by-accident.
- **Activities wrong per non-Baguio run:** every activity whose image the
  chain resolved. Observed 5/9 (56%) and 7/12 (58%); the ceiling is 100% —
  the leak had no server-side filter.
- **Cross-city photo collisions:** `CURATED_IMAGE_MAP` is keyed by bare
  title. 10 of its 37 local entries use a generic venue name that other
  cities also have ("The Mansion", "Botanical Garden", "Wright Park",
  "Baguio Cathedral", "SM City Baguio", …). Counting any title containing a
  generic venue word (mansion/garden/park/market/station/plaza/hotel/cafe/
  restaurant/cathedral), **18 of 37 = 49%** of the catalog is a collision
  surface.
- **Silent:** zero log lines for any of the six bugs. `git grep` found no
  error path — the wrong image *is* the output.

### 1.3 Not measured

No traffic or analytics data was read, so this file makes **no claim about
the percentage of users who saw a wrong photo.** The percentages above are
per-run code-path shares, which are exact.

---

## 2. Root causes and fixes

- [x] **#1 — Server-truth re-attach read the allowlist from the model.**
      `organizeItineraryByDays` resolved images by title from
      `it.searchMetadata.allowedActivities`, but `GuaranteedJsonEngine`
      returns an `ItinerarySchema`-valid object with **no `searchMetadata`
      field** (the schema is only title/subtitle/items). `allowedMap` was
      therefore always empty and every activity took the else branch. The
      server-truth list now travels as an explicit parameter
      (`handleItineraryProcessing → processItinerary → organizeItineraryByDays`)
      from `findAndScoreActivities(...).searchMetadata.allowedActivities` at
      all three call sites. Security posture unchanged: model-supplied URLs
      remain untrusted and still never win. → **#674**
- [x] **#2 — Curated photos were never attached.** `enrichActivitiesWithImages`
      had two exits that skipped Tier 0: the "all curated" fast path returned
      the input array untouched, and the per-item loop returned on a curated
      title *before* calling `getAccurateImageForPlace`. Baguio activities
      arrive from vector search and the TomTom supplement with `image: ""`, so
      the shortcut's premise was never true. `applyCurated()` now runs over the
      whole batch up front. This is also why Baguio logs showed no
      `🖼️ Image for …` lines at all. → **#675**
- [x] **#3 — Case drift in two curated paths.** `kflavors_taranagala.JPG` vs
      the file `kflavors_taranagala.jpg`, and the mirror image for
      `kj_korean_palace_baguio_taranagala`. Invisible on macOS/Windows
      (`existsSync` returns true); a **404 on Vercel**, so the card silently
      fell back even after #2. Both corrected to the real on-disk casing. →
      **#675**
- [x] **#4 — The themed fallback design had never rendered.**
      `getFallbackImage()` branches across six themed placeholders; **none of
      the six existed in `public/`** (git history has only
      `hero-placeholder.svg`). Every branch 404'd, `onError` fired, and the
      card showed the logo. The five missing JPGs were authored in the card's
      own language — soft `#F4F9FF → #E4EEFB` panel matching the card's
      `bg-[#eff6ff]`, Tarana `#0066FF` stroke glyph — so the existing design
      works as coded instead of being replaced. → **#676**
- [x] **#5 — Cross-city curated image leak.** `enhanceItinerary` fell back to
      a fuzzy match against `sampleItinerary` — titled *"A personalized
      Baguio Experience"* — when the server sent no image, with **no city
      gate**. For any other city it scored every Baguio place on shared words
      (+2) and shared tags (+3) and copied the winner:

      | Non-Baguio place | Matched | Why it scored |
      |---|---|---|
      | Poblacion Market | Baguio Night Market | shares "market" |
      | Robinsons Supermarket Tutuban | Mines View Park | shared tags alone |

      The code comment acknowledged this exact risk but only guarded the case
      where the server *did* send an image; the no-image path — most of Manila
      per the tier logs — was open. The dashboard's `SuggestedSpots` path is
      the correct reference: `SpotlightCard.tsx:59-79` renders the API image
      verbatim over a logo base layer and never consults a catalog. The match
      now requires `cityId === 'baguio'`, and the `= "baguio"` default was
      removed so omission fails **closed** (fallback image) instead of open
      (wrong-city photo). → **#677**
- [x] **#6 — Server Tier 0 had the same hole, one layer deeper.**
      `CURATED_IMAGE_MAP` is keyed by bare title with no city dimension, so a
      name collision handed another city a Baguio photo. Routed through
      `curatedImageFor()`, which answers only for Baguio; all four call sites
      now pass `cityId`. → **#677**

Three smaller sites in the same class, fixed with the above:

- [x] **Image cache key omitted the city** — a cached Baguio answer for "The
      Mansion" was served to a Manila request for the same title. Found by the
      new test, not by inspection. `cityId` is now part of the key. → **#677**
- [x] **Fetch path clobbered good images** — `results[idx] = { ...act, image:
      url }` ran unconditionally, so a chain that resolved nothing replaced a
      server-supplied image with `null`. Now only overwrites on a real hit. → **#677**
- [x] **Hardcoded city in copy and in the error fallback** — the preview empty
      state said "your personalized Baguio itinerary" for every city, and a
      failed generation for a non-Baguio scope substituted the whole Baguio
      sample itinerary. → **#677**

---

## 3. Guards

- [x] `src/lib/services/__tests__/imagePipeline.e2e.test.ts` (2 cases) — drives
      the real pipeline with only `fetch` stubbed at the process boundary:
      tier chain → server allowlist → model output with no `searchMetadata` →
      `handleItineraryProcessing` → **the object the browser receives**.
      Asserts on that final object, which is why it reproduces a bug that
      `getAccurateImageForPlace`'s own unit test stayed green through.
- [x] `src/lib/services/__tests__/curatedImageCityGate.test.ts` (8 cases) —
      the collision surface: four real generic titles × five non-Baguio
      cities, unknown city fails closed, batch path, no-network-for-Baguio,
      server-supplied images preserved outside Baguio, curated authoritative
      for Baguio.
- [x] `src/app/itinerary-generator/services/__tests__/imageCityScope.test.ts`
      (6 cases) — the reported pairs, all seven non-Baguio scopes, Baguio
      still resolved, server image untouched.
- [x] `src/lib/images/__tests__/shippedImagePaths.test.ts` (5 cases) — every
      `/images/…` literal production code can hand `next/image` must exist on
      disk, **byte-for-byte**, and be non-empty. Compares `readdir`/`stat`,
      **never `existsSync`**, so a case-insensitive filesystem cannot pass a
      broken path. Test fixtures and `enhancedPromptEngine`'s few-shot prompt
      text are excluded and documented.
- [x] `src/lib/services/__tests__/curatedBaguioEnrich.test.ts` (3 cases) —
      the curated attach fix from #675, now with its scope declared.

**24 new/updated cases. Every one RED before its fix.**

---

## 4. Audited and deliberately unchanged

- [x] Server retrieval is **already** strict-city guarded —
      `activitySearch.ts:255` (shared POI pool, honest empty otherwise),
      `:423` / `:680` / `:761` (Baguio-only supplements behind a city check).
- [x] `getActivityCoordinates` is **safe by miss** — TomTom lat/lon is
      preferred, so a non-Baguio activity never falls into the Baguio title
      map. Confirmed by the logs: Manila coordinates were correct.
- [x] `activitySearch.ts:146` filters vector results to Baguio-catalog titles,
      which looks like a leak but is **replaced** at `:299` by the strict-city
      TomTom pool before it can render. Latent, not live.
- [x] `src/app/api/gemini/itinerary-generator/agent/agent.ts` hardcodes Baguio
      traffic context and has **zero importers** — dead code.
- [x] `ItineraryPreview.tsx` had `generatedItinerary || sampleItinerary`; it is
      unreachable (the branch above returns early on a null itinerary) and was
      removed so it cannot become live later.

---

## 5. Verification

- [x] Image + service suites: **15 suites / 115 tests** green.
- [x] Full suite: **908 passed / 6 skipped**, one pre-existing failure
      (`food-recommendations` — verified failing on clean `main`, unrelated).
- [x] `tsc --noEmit`: 0 errors.
- [x] ESLint: 0 errors. One pre-existing warning in `spots/route.ts`,
      byte-identical on a clean tree.
- [x] CI `verify` + `e2e-smoke` + `migration-replay` + Vercel green on every
      PR.
