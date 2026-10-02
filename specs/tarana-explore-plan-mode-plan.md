# Tarana Explore — Plan Mode Plan

**Status:** Draft, awaiting approval — no implementation yet.
**Date:** 2026-10-03
**Author:** Staff review of `src/app/tarana-explore/`, `src/app/itinerary-generator/`, `src/app/api/gemini/itinerary-generator/`, `src/agents/`, `src/lib/data/`.
**User decisions (2026-10-03):** all three §8 questions answered — (1) save
reuses Gala's path verbatim, (2) per-day routes, (3) traffic-aware stays on.
Verdicts recorded as §9; §8 becomes the decision log.

## Objective

Add a **Plan Mode** switch to Tarana Explore that turns the map page into a
Gala configuration surface: the DynamicIsland's route buttons become Gala
planner controls (destination, budget, pax, duration, dates, interests) in
Explore's interface language, and generating draws the day plan on the map —
pins per stop, route connecting the pins, per-day switching — without leaving
the map page or duplicating Gala's page.

Out of scope: changing Gala's own page, changing the itinerary model, new map
SDKs, offline support.

## Assumptions (correct me before any gate)

1. Web app only (`src/app/tarana-explore/`); nothing in `tarana-mobile/`.
2. Generation reuses the existing `POST /api/gemini/itinerary-generator`
   untouched — same request schema, same credits, same idempotency.
3. Explore's existing route-planning stays fully functional; Plan Mode is an
   additive layer with a hard mode boundary (route sheets and plan sheets
   never render simultaneously).
4. Single-city scope follows Gala's rule: one city per generation. The Gala
   destination aliases hold (`Visayas → boracay`, `Luzon → manila`), plus the
   `ph-wide` / `world` pills that exist in `ItineraryForm`'s `CITY_PILLS`.
5. Credits: generation is charged by the existing Gala path, exactly once per
   generation. The Explore page itself remains free to browse.

---

## 1. Evidence (verbatim, verified in-repo this session)

- Explore composition (`ExploreMapView.tsx:180-246`): full-screen
  `InteractiveRouteMap`, then `FloatingSearchCard` (top, hosts
  `DynamicIsland`), `TrafficBadge`, `MapControls` (absolute right rail:
  recenter / tilt / map-style), `BottomRouteSheet` (renders only when
  `currentRoute` exists), `SpotPreviewCard`, one error toast.
- `FloatingSearchCard.tsx:640` — `DynamicIsland` collapsed summary is
  origin/destination ("Where to?" when empty); expanded content is the route
  config: From/To fields, vehicle + route-type segmented rows, avoid-toggles,
  "Get directions" submit. `expanded = isOpen || isCalculating`. Outside
  pointerdown + Escape dismiss; after a route lands it collapses to the pill.
- `MapControls.tsx:19-73` — absolute right-center stack, three controls:
  recenter (`aria-label="Recenter to my route"`), tilt (`Box` when on,
  `Square` when off, `tiltOn` boolean), map style (`main`/`satellite` cycle
  with `Loader2` while changing).
- Gala form contract (`itinerary-generator/types/index.ts`): `CityId =
  "baguio" | "cebu" | "manila" | "davao" | "boracay" | "el_nido" |
  "ph-wide" | "world"`. `FormData` carries budget, pax, duration, dates,
  selectedInterests, `trafficAware`, `cityId`. `CITY_PILLS` are 7 alias tiles
  (Visayas → boracay, Luzon → manila).
- Generation (`useItineraryForm` + `useItineraryGenerator` +
  `POST /api/gemini/itinerary-generator`): city strict-scoping, 32KB body cap
  (413), credit charge-first with refund on failure, idempotency keys, single
  agent path (`USE_MULTI_AGENT`, `conciergeAgent` extracts
  interests/duration/budget/pax/cityId, duration clamped 1–14 days).
- Itinerary activities carry **no coordinates**: `Activity` is
  `image/title/time/desc/tags` (`itinerary-generator/types/index.ts:17-26`);
  the strict JSON schema requires exactly `image/title/time/desc/tags`
  (`guaranteedJsonEngine.ts:407-442`, REQUIRED image+title+time+desc+tags);
  `sanitisedAllowedActivities` keeps exactly `image/title/time/desc/tags`
  (+`peakHours`, traffic) and drops `metadata.lat/lon` on the floor
  (`activitySearch.ts:545-556` fast path; the same strip exists in the
  traffic-aware path). Coordinates exist only server-side:
  `BAGUIO_COORDINATES` (40 entries, Baguio only),
  `getActivityCoordinates(name)` exact+fuzzy, TomTom `SearchResult`
  `coordinates` on the strict-city `metadata` before the strip.
- No itinerary-to-map bridge exists anywhere: zero renders of `ItineraryData`
  on a map today. Suggested Spots Visit deep-links are the only Explore
  entry point (`parseDeepLink` seeds one destination).
- Map + route API accept what Plan Mode needs: `RouteRequest` takes optional
  `waypoints?: LocationPoint[]` (`route-optimization.ts:48-53`);
  `calculate` route zod caps waypoints at 10 (`api/routes/calculate/route.ts:25`);
  `InteractiveRouteMap` already renders numbered waypoint markers
  (`InteractiveRouteMap.tsx:630+`), accepts `waypoints` as a prop, and takes
  `origin`/`destination` independently of any route.
- Result presentation surface: `BottomRouteSheet` returns `null` when
  `currentRoute` is null — the sheet slot is free for a plan sheet and the
  page never renders both at once.

---

## 2. Capability map

Three modules, dependency order left to right. Each ships and verifies alone.

| Module id | Responsibility | Depends on |
|---|---|---|
| `plan-toggle` | Plan-mode switch in the right control stack; mode flag + mode-scoped state ownership | — |
| `plan-island` | Gala configuration rendered in Explore's island language (compact + expanded, inside the verified morph) | `plan-toggle` |
| `plan-itinerary` | Generation call + coordinate resolution + day-plan pins and route on the Explore map | `plan-toggle`, `plan-island` |

Build order: `plan-toggle` → `plan-island` → `plan-itinerary`.
Naming: `planMode` state, `PlanModeToggle` control, `PlanIslandConfig`
content, `PlanSheet` result.

---

## 3. Module specs

### 3.1 `plan-toggle` — the switch and the mode boundary

One button appended to the existing `MapControls` right stack, same 40px
circle language as recenter/tilt:

- Reads `aria-pressed={planMode}` plus a title ("Plan mode: On/Off"). Active
  state uses the rail's own active treatment (tilt's blue fill is the
  precedent — `bg-blue-600 border-blue-600 text-white`).
- **Owned in `ExploreMapView` as `planMode: boolean`, default off.** It is
  display state, not route state: toggling must not touch origin/destination
  the user already set.
- Mode boundary (both directions, no exceptions):
  - Entering Plan Mode: collapse the route island and keep endpoint values in
    parent state untouched (the island already preserves them across
    collapses today). Any live route sheet stays until the first plan action,
    then clears — the page never shows `BottomRouteSheet` and the plan sheet
    at once.
  - Leaving Plan Mode: clear plan state (config, pins, plan sheet); route
    state from before the mode switch is restored as-is.
- Component choice: extend `MapControls` props (`planMode`, `onTogglePlan`)
  rather than a second floating stack — one stack keeps the thumb zone and
  the z-order (`z-20`) the island expects.

### 3.2 `plan-island` — Gala config in Explore's language

`FloatingSearchCard` gains a mode-driven content swap. Everything about the
verified `DynamicIsland` shell stays: spring preset, compact/expanded morph,
outside-pointerdown + Escape dismissal, auto-collapse after a result.

- Collapsed pill: route summary off, plan summary on. The island's existing
  `compactWidth` precedent (240 empty / 320 set) applies — a plan summary
  ("3 days · Manila · ₱5k") may take the wide variant.
- Expanded content: Gala fields re-rendered as island rows, not a pasted
  form — destination alias tiles, budget popover, pax, duration, dates,
  interests, "Generate itinerary" submit. Reuse `CITY_PILLS` semantics
  (alias → real `cityId` before the API, never a region to the route).
- The `canSubmit`/validation and credit gating copy Gala's behavior: all
  fields present, generation billed once through the existing charge-first
  path, `showOutOfCredits` message on exhaustion, `isGenerating` spinner on
  submit. No second billing implementation.
- A11y bar from the route-config rows: labels above every field, `aria-pressed`
  on every selectable tile, errors below the field, one-line CTA.

### 3.3 `plan-itinerary` — pins and the day-plan route

The module that earns its complexity. Two changes, both forced by §1:

**(a) Coordinate resolution.** Generated activities have titles, not coords
(the strict schema forbids `lat`/`lon`; the sanitiser strips them). Mapping
them is a title→coordinate join, highest-confidence source first:

1. `getActivityCoordinates(title)` exact/fuzzy — Baguio today, ~40 entries.
2. TomTom POI search scoped to the generated `cityId` (the same calls
   `getTouristPois`/`getInterestPois` make, same bounds + `TopLeft`/
   `BottomRight` + allowlist).
3. No hit → the stop is listed by name in the plan sheet but has **no pin
   and no route leg**. Never Baguio-leak, never Null Island — both failure
   modes this repo has already burned on.

This join is per-stop, cacheable by `(cityId, normalised title)`, and where
`places` (`supabase/migrations/20260901000000_create_places.sql`: `id`,
`city_id`, `title`, `lat`, `lon`, `category`, deny-all RLS, `supabaseAdmin`
server reads) finally gets a reader — the 50-POI plan's gap note says no
code reads it back today.

**(b) Render.** The plan sheet owns the result slot (the `BottomRouteSheet`
`null`-when-no-route precedent): day tabs, stop list with times, "Save"
reusing `handleSaveItinerary`. On the map: pins at resolved stops plus the
existing `/api/routes/calculate` with `waypoints` capped at 10 (zod cap),
day-selected — one day's stops at a time, reselected on tab change, camera
reframed like a recenter. Origin/destination for the route call default to
the day's first/last resolved stop; the user's Explore endpoints are
untouched underneath.

Where a day resolves fewer than two stops, the sheet lists the day by name
with no route drawn — same honest-empty rule as the strict-city scope.

---

## 4. What stays untouched (audited, do not move)

- `POST /api/gemini/itinerary-generator` — schema, credits, idempotency,
  city scoping all reused as-is. The single-agent path is the only path this
  plan exercises; `USE_MULTI_AGENT` keeps its own meaning.
- `DynamicIsland` shell — spring, morph, clipping contract (`dynamicIslandClip.test.tsx`
  pins it).
- `MapControls` existing three controls; only the stack gains one button.
- `ItineraryForm` / Gala page — Plan Mode re-implements the fields as island
  rows; it does not import or restyle the page form (a page form at 448px
  island width is a different component, not a smaller one).
- `InteractiveRouteMap` waypoint markers — reused, not reimplemented.
- `sanitisedAllowedActivities` and the model schema — lat/lon stays out of
  model I/O. Resolution happens client-side (or server-to-server off the
  model path), never in the prompt.

---

## 5. Risks and answers

| Risk | Answer |
|---|---|
| Title→coordinate misses (nickname vs registry name) | Listed-by-name-no-pin rule (§3.3a); FUZZY matcher + TomTom scoped search before giving up |
| Misses cluster on non-Baguio cities (~40-title Baguio map only) | `places` reader or TomTom scoped fallback is part of the build, not a later optimisation |
| Waypoint cap (10) vs long days | Sheet lists all stops; route draws first 10 resolved per day, note on the sheet when capped |
| Generation cost surprise | Existing charge-first + refund + out-of-credits copy reused verbatim; one charge per generation |
| Island overcrowding (7 tiles + 6 field groups at 448px) | Rows, not a pasted page form; destination tiles compress to the `grid-cols-4` pattern the dashboard pills already use |
| Mode confusion (route vs plan state) | Hard boundary rule §3.1; route sheets and plan sheets never co-render |

---

## 6. Plan (slices, each independently verifiable)

1. **`plan-toggle`** — button in `MapControls` + `planMode` in
   `ExploreMapView` + enter/leave boundary. Verify: toggle flips, route
   state survives both directions, one sheet at a time.
2. **`plan-island`** — island content swap + Gala field rows + validation +
   collapsed plan summary. Verify: config submits a Gala-shaped `FormData`,
   pill aliasing never sends a region, credit-exhausted copy matches Gala.
3. **`plan-itinerary`** — generation call, coordinate join, plan sheet, day
   pins + waypoint route, save reuse. Verify: generated day renders pins and
   one route; unresolved stops listed without pins; save persists.
4. **Mobile pass** — thumb-zone reach of the new stack button, island at
   small widths, sheet overlap. Verify: 360px walkthrough of all three
   slices.

---

## 7. Verification (per-slice, not per-PR)

- Toggle: `MapControls` test — `aria-pressed` flips, callback fires; map
  view test — endpoints survive mode toggles in both directions.
- Island: island test — expanded plan content carries labelled fields;
  `CITY_PILLS` alias test — Visayas/Luzon resolve before the API call.
- Itinerary: title→coordinate join test — known title, fuzzy title, unknown
  title (no pin, listed); route call test — waypoints ≤ 10, day switch
  rebuilds the request; save reuses the Gala path.
- Browser: full Plan Mode walkthrough at desktop + 360px on the real Explore
  page, generation to pins to save.
- Global: `tsc --noEmit`, `next lint` on touched files, full suite, CI
  `verify` + `e2e-smoke` per existing PR practice.

---

## 8. Decision log (asked, answered 2026-10-03)

1. **Save → reuse Gala's path verbatim.** "Save destination — reuse Gala's
   handleSaveItinerary verbatim, or Plan Mode is view-only?" → reuse.
2. **Routes are per-day.** "Per-day routes or one whole-trip route?" →
   per-day (matches the confirmed behavior: routes connecting each day's
   stops into a day plan).
3. **Traffic-aware stays on.** "Keep Gala's default?" → yes.

## 9. Verdicts (principal judgment on the three decisions)

### 1. Save — reuse Gala's `handleSaveItinerary` verbatim. **Right call.**

Read first (`useItineraryGenerator.ts:130-182`): it does not touch the DOM.
It builds the payload from exactly two hook-owned values —
`formSnapshot` + `generatedItinerary` — posts through `saveItinerary()` to
`POST /api/saved-itineraries` (32KB cap, zod `SaveItinerarySchema`,
idempotent, 201), invalidates `['itineraries']`, toasts, and pushes
`/saved-trips`. Nothing in that chain reads the Gala page. A hook that takes
two values and returns a promise is portable by construction, and Explore
has no competing save to conflict with — the page's only mutation today is
nil (SearchCard keeps endpoint selections in parent state; nothing
persist). So the alternative — a second save path — is pure duplication for
zero new behavior. One correction to the spec's own §3.3 wording: the Plan
Sheet does not "reimplement" save, it *calls* the hook with the Plan Mode
form snapshot. If the hook ever gains a third dependency (a Gala-page DOM
read, a Gala-only context provider), that is the day to revisit — today it
has none, and I verified all three so-called page couplings are nil
(ToastsProvider is app-global, react-query is app-global, `router` is
`next/navigation`).

One real constraint, priced in: `handleGenerateItinerary` in Plan Mode must
populate `formSnapshot` itself, because the page-level Gala snapshot is set
as a side effect of that same hook call — Explore holds no persistent
`FormData` (`ExploreMapView` owns origin/destination/preferences only).
Generate-and-forget leaves save broken ("Cannot save itinerary"), which is
the one silent failure this decision must not ship. The `plan-island`
slice owns that assignment; the `plan-itinerary` slice's save test owns the
proof.

### 2. Per-day routes, not one whole-trip route. **Right call, and the cap
makes it the only honest one.**

The calculate route's zod caps `waypoints` at 10
(`api/routes/calculate/route.ts:25`). A 3-day itinerary at the model's own
pace (Gala composes ~2 stops per slot, 3 slots a day — `contextBuilder`
duration guidance, `contextBuilder.ts:120-128`) exceeds 10 resolved stops
well before day three. A whole-trip route would have to silently drop stops
or silently split into segments — both fail the repo's honest-empty rule
(`activitySearch.ts:255`, the strict-city precedent: never invent, never
hallucinate coverage). Per-day routing keeps every drawn leg inside a
verified contract: listed stops == drawn legs, day-selected, reselected on
tab change. The failure it converts — a 17-stop day that cannot legally fit
in one request — becomes a sheet note ("route shows first 10 resolved
stops"), which is the same degradation language the strict-city path
already uses.

Cost is honest too: one calculate call per visible day, not per trip. The
5-minute silent traffic refresh continues to apply only to the *drawn*
day's route — the same rule Explore already applies to its one route
(`ExploreMapView` refresh interval is keyed on `state.currentRoute`).

### 3. Traffic-aware stays on. **Right call, and almost free.**

Evidence: `findAndScoreActivities(..., trafficAware = true)` defaults on
(`activitySearch.ts:78`); the traffic-aware lane is the production lane —
it enriches every finalist with real-time TomTom levels and ranks by
`combinedTrafficScore` instead of hard-dropping congested stops
(`activitySearch.ts:469-504`). Explore already pays the traffic price: the
page silently refreshes traffic every 5 minutes on the live route. So the
cheapest consistent state is one where the pins Plan Mode draws already
carry the traffic ranking the map is about to show. Turning it off would buy
a faster generation in exchange for pins whose order contradicts the traffic
badge next to them — two truths on one screen.

The one thing it costs: generation latency. `trafficAwareActivitySearch`
runs per finalist and the itinerary path has a 60s platform ceiling
(`maxDuration = 60`, `route.ts:77`). Plan Mode inherits Gala's exposure
here unchanged — no new timeout surface, same refund-on-failure policy. If
a Plan Mode generation ever times out in the field, the fix is shared with
Gala, not Plan-Mode-specific.

---

**Standing correction to this spec's own evidence (§1):** the
"sanitisedAllowedActivities strips lat/lon" line was verified against the
traffic-aware sanitiser only. The fast-mode (non-traffic) path at
`activitySearch.ts:532-556` spreads `...s.metadata` — which *includes*
`lat`/`lon` from the strict-city layer — into `finalActivities`, whose
image enrichment is then typed `{ title, lat, lon, image }`. The
`sanitisedAllowedActivities` built from it still emits only the six
model-safe fields, so the *client-visible* claim stands, but the
intermediate object is richer than §1 implied. If a future reader needs
server-side coords for the title→coordinate join, the fast path is where
they already exist without a new lookup. Noted here so the plan's §3.3a
stays cheapest-first: registry, then the enriched intermediate where
reachable, then scoped TomTom lookup.
