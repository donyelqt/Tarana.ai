# Implementation Plan: Tarana Explore — Plan Mode

**Spec:** `specs/tarana-explore-plan-mode-plan.md` (decision log §8, verdicts §9).
**Status:** Ready. Slices below are ordered by dependency, one branch + one PR each.
**Scope:** 3 slices + 1 mobile pass. Each leaves `main` shippable.

## Overview

Add a Plan Mode switch to Tarana Explore. When on, the DynamicIsland renders
Gala's planner fields in Explore's island language, and generating draws each
day's stops as pins with a route connecting them, day by day. Reuses the
existing Gala generation route, its credit path, and its save path verbatim.

## Architecture decisions

1. **Mode is display state, owned by `ExploreMapView`.** `planMode: boolean`
   lives beside `tiltOn`/`mapStyle`. Route endpoints are untouched by a toggle
   in either direction — they are user work, not mode state.
2. **The island swaps content, not shell.** `FloatingSearchCard` keeps the
   verified `DynamicIsland` morph (spring `stiffness: 210, damping: 23`, the
   clip contract pinned by `dynamicIslandClip.test.tsx`). Only the rendered
   children and compact summary change per mode.
3. **Generation reuses `POST /api/gemini/itinerary-generator` unchanged**,
   called through the same hook the Gala page uses, so charge-first,
   refund-on-failure, idempotency, and the 32KB cap are inherited, not
   re-implemented.
4. **Coordinates are resolved client-side by title**, cheapest source first:
   `getActivityCoordinates` (registry, Baguio) → TomTom scoped to the
   generated `cityId`. Unresolved stops are listed by name with no pin and no
   leg. Never Baguio-leak, never Null Island.
5. **Routes are per-day.** The calculate route caps `waypoints` at 10
   (`api/routes/calculate/route.ts:25`); a 3-day itinerary exceeds that. Per-day
   keeps drawn legs equal to listed stops.
6. **Save is Gala's `handleSaveItinerary`, called with the Plan Mode form
   snapshot.** Plan Mode must set its own snapshot on generate — the Gala page
   gets it as a side effect, Explore has none.

## Task list

### Phase 1 — `plan-toggle` (branch `feat/explore-plan-mode-toggle`)

- [ ] **1.1 Add the Plan Mode button to `MapControls`.**
  Accept: fourth control in the existing right stack, same 40px circle
  language as recenter/tilt/style; `aria-pressed` reflects state; title reads
  "Plan mode: On/Off"; active state reuses tilt's blue fill
  (`bg-blue-600 border-blue-600 text-white`).
  Verify: component test — renders, `aria-pressed` flips on click, callback
  fires once; axe clean.
  Files: `src/app/tarana-explore/components/MapControls.tsx`,
  `src/app/tarana-explore/components/__tests__/mapControls.test.tsx`.
  Size: S.

- [ ] **1.2 Own `planMode` in `ExploreMapView` and wire the button.**
  Accept: `planMode` state defaults `false`; toggling changes no other state
  (origin/destination/preferences byte-identical before/after);
  `MapControls` receives `planMode` + `onTogglePlan`.
  Verify: map-view test — toggle both directions leaves endpoint state
  unchanged; no route recalculation is triggered by the toggle alone.
  Files: `src/app/tarana-explore/components/ExploreMapView.tsx`.
  Size: S.

- [ ] **1.3 Enforce the mode boundary.**
  Accept: entering Plan Mode collapses the island (`isOpen === false`) without
  clearing endpoints; leaving Plan Mode clears all plan state (config,
  resolved stops, plan sheet) and restores nothing else. Plan sheet and
  `BottomRouteSheet` never render together.
  Verify: test — enter then leave, plan state is empty and route state
  survives; a rendered route sheet plus plan mode never co-exists.
  Files: `src/app/tarana-explore/components/ExploreMapView.tsx`.
  Size: S.

> **Checkpoint after 1.1–1.3:** toggle works, route half of the page is
> untouched both directions, full suite green. Stop and review before 2.x.

### Phase 2 — `plan-island` (branch `feat/explore-plan-mode-island`)

- [ ] **2.1 Plan config container + form state.**
  Accept: a `PlanIslandConfig` component owns `budget`, `pax`, `duration`,
  `dates`, `selectedInterests`, `cityId` (Gala's `FormData` shape), seeded
  from Gala's own option lists (`budgetOptions`, `paxOptions`,
  `durationOptions`, `interests`, `CITY_PILLS`). No new option vocabulary.
  Verify: unit — defaults match Gala's, `CITY_PILLS` alias resolves
  (`visayas → boracay`, `luzon → manila`) before any request.
  Files: `src/app/tarana-explore/components/PlanIslandConfig.tsx`,
  `src/app/tarana-explore/components/__tests__/planIslandConfig.test.tsx`.
  Size: M.

- [ ] **2.2 Render it inside the island, in island language.**
  Accept: `FloatingSearchCard` swaps expanded children and compact summary by
  mode; labelled fields above inputs; `aria-pressed` on every selectable
  tile; submit is one line; compact pill shows a plan summary when config is
  set. Island shell/morph untouched.
  Verify: component test — mode on renders plan fields and not route fields,
  mode off renders route fields and not plan fields; existing
  `FloatingSearchCard` + `dynamicIslandClip` suites still green.
  Files: `src/app/tarana-explore/components/FloatingSearchCard.tsx`.
  Size: M.

- [ ] **2.3 Validation, credit gating, and submit.**
  Accept: submit blocked until budget + pax + duration + ≥1 interest, with
  Gala's exact messages; out-of-credits state shows Gala's copy and disables
  submit; `isGenerating` shows a spinner; the call goes through the existing
  Gala hook so billing is inherited.
  Verify: component test — each validation path, credit-exhausted path,
  in-flight path. Explicitly assert no second `fetch` to the generator on
  double submit.
  Files: `src/app/tarana-explore/components/PlanIslandConfig.tsx`,
  `src/app/tarana-explore/hooks/usePlanMode.ts`.
  Size: M.

> **Checkpoint after 2.1–2.3:** config submits a Gala-shaped request, billing
> is inherited, nothing in the route flow regressed.

### Phase 3 — `plan-itinerary` (branch `feat/explore-plan-mode-itinerary`)

- [ ] **3.1 Title → coordinate resolver.**
  Accept: pure, injectable (registry lookup + scoped search as arguments);
  exact match → fuzzy match → scoped TomTom → `null`; cache keyed
  `(cityId, normalisedTitle)`; a miss returns `null` and never a Baguio
  coordinate for a non-Baguio city.
  Verify: unit — known title, fuzzy title, unknown title, wrong-city title
  (must be `null`, not a Baguio pin).
  Files: `src/app/tarana-explore/lib/resolveStopCoordinates.ts`,
  `src/app/tarana-explore/lib/__tests__/resolveStopCoordinates.test.ts`.
  Size: M.

- [ ] **3.2 Plan sheet (results surface).**
  Accept: day tabs from `items[].period`; each day lists its stops with time
  and resolved/unresolved state; unresolved stops render by name with an
  explicit no-location marker; "Save" calls Gala's save with the Plan Mode
  snapshot; sheet renders only when a plan exists.
  Verify: component test — day tabs, mixed resolved/unresolved list, save
  payload carries the snapshot, empty plan renders nothing.
  Files: `src/app/tarana-explore/components/PlanSheet.tsx`,
  `src/app/tarana-explore/components/__tests__/planSheet.test.tsx`.
  Size: M.

- [ ] **3.3 Draw the day on the map.**
  Accept: selected day's resolved stops become pins; `/api/routes/calculate`
  is called with that day's stops as `waypoints` (≤10, first 10 when a day
  exceeds it) and the day's first/last resolved stop as origin/destination;
  switching days rebuilds the request; Explore's own endpoints stay untouched
  underneath.
  Verify: test — request shape per day (count, order, cap), day switch issues
  a new request, zero-resolved day draws no route and lists by name.
  Files: `src/app/tarana-explore/components/ExploreMapView.tsx`,
  `src/app/tarana-explore/hooks/usePlanMode.ts`.
  Size: M.

- [ ] **3.4 Save wiring end-to-end.**
  Accept: Plan Mode sets `formSnapshot` + `generatedItinerary` on generate;
  "Save" persists via `POST /api/saved-itineraries` and invalidates
  `['itineraries']`; the saved trip appears on `/saved-trips`.
  Verify: test — committed payload passes `SaveItinerarySchema`
  (`snapshot` non-null, `itineraryData` non-empty); generate-then-save
  without a snapshot produces the hook's explicit error, not a crash.
  Files: `src/app/tarana-explore/hooks/usePlanMode.ts`.
  Size: M.

> **Checkpoint after 3.1–3.4:** generation → pins → per-day route → save works
> end to end on the real Explore page at desktop width.

### Phase 4 — mobile pass (branch `fix/explore-plan-mode-mobile`)

- [ ] **4.1 Thumb-zone and small-width checks.**
  Accept: 360px — the fourth control does not overlap the island or the
  sheet; island config scrolls without horizontal overflow; each tap target
  ≥44px; sheet never traps the map.
  Verify: browser walkthrough at 360px with screenshots; no console errors.
  Files: `src/app/tarana-explore/components/*` (only where measurements
  demand it — no speculative restructuring).
  Size: S.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Title→coordinate misses cluster outside Baguio | Med | Registry → scoped TomTom → listed-no-pin; the miss is visible, never silent |
| Island overcrowding at 448px with 7 tiles + 6 field groups | Med | Rows not a pasted page form; destination tiles use the existing 4-col pattern |
| Per-day 10-waypoint cap truncates a long day | Low | Sheet states the cap; drawn legs always equal listed stops |
| Plan Mode generation latency (traffic-aware, 60s ceiling) | Med | Inherited from Gala unchanged; refund policy already covers failure |
| Mode state leaking into route state | High | §1.3 boundary tests: endpoints byte-identical across toggles |

## Parallelization

- 1.x → 2.x → 3.x are strictly sequential (each consumes the previous
  contract).
- 4.x depends on 1–3 shipping; it is a separate branch by design.
- 3.1 (pure resolver) can be built and verified in isolation before 3.2/3.3.

## Open questions

None — §8 of the spec is answered. Reopen only if a slice surfaces a
contract change (e.g. the generator starts returning coordinates).
