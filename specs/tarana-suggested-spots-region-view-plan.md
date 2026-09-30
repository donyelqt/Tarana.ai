# Suggested Spots — Region View (v3, shipped)

> **Status 2026-10-01: shipped on `main` (#671, #672).** Pills are
> **Baguio / Manila / Davao + Visayas + Luzon**. `REGION_MEMBERS` is exactly
> `boracay` + `cebu` (both pill-less, served by the route for the union
> only); `LUZON_MEMBERS` is `baguio` + `manila` (both keep standalone
> pills AND feed the region). El Nido has no Spots pill — retrieval rows
> (`SUPPORTED`, `CITY_CONFIGS`, `TargetCityId`) remain, Gala untouched.
> Spots-only mall overlays: SM Seaside (cebu pool), SM MOA + Bonifacio High
> Street (manila pool). Provider-pinned, route-prepended, Gala/allowlist
> untouched. This file records that shipped shape; §§1–11 below are the
> original v2 plan (member correction + design), kept for history.

## Assumptions (correct me before any gate)

1. `boracay` and `cebu` scopes exist and return pools (depends on the parent spec's Slice 0+).
2. TomTom relevance scores are roughly comparable across pools (only matters for one rank option; the recommended option doesn't need it).
3. 3-card render cap unchanged; no new enrichment width.
4. Mobile parity is a separate decision, not a blocker.

---

## 1. Evidence (verified in-repo)

- `SuggestedSpots.tsx` today: one `useState<SpotScopeId>('baguio')` → one `useQuery(spotsQueryOptions(city, status))` keyed `['suggested-spots', city]` → `toSpotCard(p, origin)` with `getCityCenter(city)` → `.slice(0, 3)`.
- `spotsQueryOptions` (`dashboard/utils.ts:368-379`): 1-hour staleTime, `enabled` on auth. The factory already accepts an injectable `queryFn` — the region view reuses it unmodified.
- Route contract: `/api/spots?city=` 400s unknown ids (`SUPPORTED` check, `route.ts:75`). The region tab must never send a region id to the route.
- Gala contract: `isTargetCityId('visayas')` is false → honest empty. A region id must never reach `getTouristPois`.
- No region concept exists anywhere: zero matches for region-view/aggregation code outside `/api/stats` global counters (different thing: server-side aggregates, not multi-city fan-out).

## 2. Contract

- Region exists in **exactly one place**: the component that renders it
  (`REGION_META` + `REGION_MEMBERS`/`LUZON_MEMBERS`; region ids never leave
  the component).
- Never added to: `SpotScopeId`, `SPOT_SCOPES`, `SUPPORTED`, `TargetCityId`, `CITY_CONFIGS`, Gala `z.enum`, form pills, `places.city_id`, mobile lists.
- Backend delta: **zero at v2 scope** (city queries only). *Superseded for
  the shipped shape:* the route gained overlay prepend + a `SUPPORTED`-only
  guard, and `fetchSpots`/`spotsQueryOptions` widened to `city: string`
  (see §12). Gala stays untouched.
- Gala behavior: unchanged. `getTouristPois('visayas')` and
  `getTouristPois('luzon')` return `[]` by existing design; the view calls
  neither.

## 3. Component design (the whole change)

```text
state:  view = { kind: 'city', id: SpotScopeId } | { kind: 'region', id: 'visayas' }
region members (constant): ['boracay', 'cebu']

city view   → existing path, untouched
region view → two useQuery(['suggested-spots', member]) with enabled = tab-active
              → per-payload toSpotCard(payload, getCityCenter(payload.city))
                 (each card ranked from its OWN city center — do not recenter
                  all three on one origin)
              → merge → rank (§4) → slice(0, 3)
              → subtitle "Top picks across the Visayas"
```

- Prefetch rule: region queries fire **only when the tab is active**. Idle users cost nothing extra. No mount-time prefetch.
- Downstream untouched: `SpotlightCard`, `ENRICH_LIMIT=6`, `FINALIST_CAP=12`, 3-card grid.
- Empty handling: a member with 0 rows contributes 0; region shows whatever the others return (same honest-empty convention as the city views).
- Accessibility: the tab joins the existing `role="group" aria-label="Destination city"`; keep `aria-pressed` semantics.

## 4. Open decisions (answer before implementation)

1. **Rank rule.** Options: (a) **round-robin top-1 per pool then fill** — recommended and implemented; guarantees each member is represented, immune to cross-pool score incomparability; (b) sort merged by TomTom relevance score desc — simple but assumes scores are comparable across pools, and one strong city can swallow the tab.
2. **Prefetch on mount or on click?** On-click (matches the quota posture everywhere else in this codebase).
3. **Label copy.** "Top picks across the Visayas" (shipped; "Visayas highlights" rejected as vague).
4. **Mobile parity.** Mirror in `Spots.tsx` or web-only? Its pills mirror `SPOT_SCOPES`; a web-only tab reopens the skew Slice 4 of the Boracay spec closes.

## 5. Touchpoint inventory

| File | Change |
|---|---|
| `src/app/dashboard/components/SuggestedSpots.tsx` | view state (`city` vs `region-visayas`); region branch: 2 queries, union + §4 rank, region subtitle; region tab next to pills |
| `src/app/dashboard/utils.ts` | pure `mergeRegionPools(pools) → SpotPayload[]` helper (~30 lines), unit-tested without React |
| Nothing else | No route, service, cache, config, Gala, or mobile change in v1 |

## 6. Slices (spec only)

- [x] **Slice R1 — Region tab + union.** View state, 2 queries gated on tab-active, union + rank per §4, region subtitle. *Verified: `tsc` clean; city path pixel-identical; region tab shows ≤3 cards each traceable to a member pool.*
- [x] **Slice R2 — Unit tests.** `mergeRegionPools`: empty member, bad coords, all-empty → empty state, 3-card cap, member-pin. *Verified: `regionPools.test.ts` 5/5 green; existing `route.test.ts` untouched.*
- [ ] **Slice R3 — Osmani review.** *Accept: no unresolved Critical/Required.*

## 7. Verify

```text
pnpm exec tsc --noEmit
pnpm test -- --runInBand src/app/dashboard/components/__tests__/regionPools.test.ts src/app/dashboard
# live: open tab, confirm 2 queries fired (network), round-robin across boracay+cebu
```

## 8. Rollback

Remove the tab + branch; member scopes untouched. No migration — nothing was ever written outside the component.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Rank rule hides a member city | Round-robin default; test asserts representation when both pools non-empty |
| 2× query fan-out on every tab open | Gate on tab-active; 1-hour staleTime dedupes repeat opens |
| Region tab over empty pools | Honest empty per member; §4 rank handles partial data |
| Scope creep into Gala regions | Contract §2 forbids it; `isTargetCityId` is the enforcement |

## 10. Definition of done

- [x] Region tab renders ≤3 cards, each from a real member pool (boracay/cebu)
- [x] No `visayas` id in any allowlist, route, cache, Gala path, or mobile list
- [x] City path unchanged at v2 scope; backend delta was zero then (later
  superseded by the overlay/guard change — §12)
- [x] Osmani review replaced by manual five-axis review (the reviewer
  subagent hung twice; §12 verification record lists what was checked)

## 11. Not doing (and why)

- A `"visayas"` retrieval scope — the parent spec §§2–3 rejects it with numbers (254,880 km² box, 289–500km member distances, Mimaropa mislabel)
- El Nido in the Visayas tab — Palawan is Mimaropa, so it was excluded from
  Visayas. *Superseded 2026-10-01:* the `el_nido` Spots **pill** was dropped
  (per user call) while its retrieval rows and Gala picker survive; the
  Spots surface is now the `Luzon` tab over `baguio + manila` — El Nido is
  in neither. See §12.
- Gala region itineraries — no product exists for multi-city single trips; out of scope
- Mobile parity in v1 — separate decision (§4.4)
- New ranking infrastructure — `toSpotCard` + existing helpers suffice

---

## 12. Shipped-state addendum (2026-10-01, verified against `main`)

What the v2 plan above got right, and what changed on the way to `main`.
Every claim names the file that proves it.

### 12.1 Pill row and the single-pill invariant

- Pills: `baguio`, `manila`, `davao` (`SPOT_SCOPES`, `utils.ts:148-152`)
  plus `visayas`, `luzon` from the region loop (`SuggestedSpots.tsx:125-139`).
- **No id may render twice.** #672 fixed the two-Luzon-tabs bug: `luzon` had
  been added to `SPOT_SCOPES` *and* to the region loop, so one pill was inert.
  `luzon` is now region-only, exactly like `visayas`. The invariant is pinned
  by a test (`regionPools.test.ts`: pillIds == `[baguio, manila, davao]`, and
  `not.toContain('luzon')`).
- `boracay` / `cebu` have no standalone pills (unified into Visayas by user
  call). `manila` keeps its pill **and** feeds Luzon (user call: it is a
  primary metro; collapsing it would bury its pool inside a shared 3-slot).
- El Nido has no Spots pill. Retrieval rows survive — `SUPPORTED` still lists
  `el_nido` (`route.ts:24`), `CITY_CONFIGS` + `TargetCityId` untouched — so
  `?city=el_nido` still serves and Gala behavior is unchanged.

### 12.2 Region unions (view-only, never retrieval scopes)

- `REGION_MEMBERS = ['boracay', 'cebu']` and
  `LUZON_MEMBERS = ['baguio', 'manila']` (`utils.ts:382-384`). Neither is a
  `SpotScopeId`; no route, service, cache, or Gala path reads them. The
  component fires one ordinary per-city query per member
  (`SuggestedSpots.tsx:52-67`) and never sends a region id.
- Union rule: round-robin top-1 per pool, then fill, cap 3. Rows carry
  `poolCity`; render keys are `regionCardKey(city, spot)` = `city:title` plus
  a 4-decimal coordinate cell on a true same-city collision. #670 fixed the
  Boracay-Island key duplication (two TomTom rows, one name, one cell).
  City-path cards keep `key={spot.name}` — inside a single pool the route's
  own identity keys already guarantee uniqueness.
- Known and accepted: Luzon round-robin fill favors Baguio's 37-row curated
  pool over Manila's live pool. Revisit only if Luzon reads as "Baguio + 1".

### 12.3 Retrieval is deliberately wider than the pill row

- `SUPPORTED = ['baguio', 'cebu', 'manila', 'davao', 'boracay', 'el_nido']`
  (`route.ts:24`) stays wider than `SPOT_SCOPES`. The guard checks
  `SUPPORTED` only (`route.ts:77`), so pill-less members keep returning 200 —
  proven by `serves region members with no pill` in `route.test.ts`.
- `isSpotScopeId` is now pill-bound and has no consumer in `src`; it is kept
  as an exported predicate only.
- `fetchSpots` and `spotsQueryOptions` take `city: string` rather than
  `SpotScopeId` (`utils.ts:459-495`) so region tabs can query pill-less
  members without widening `SPOT_SCOPES` again.

### 12.4 Mall overlays (Spots-only, provider-pinned)

- `SPOT_OVERLAYS` (`utils.ts:197-201`):
  - `SM Seaside City Cebu` — 10.281732, 123.880608 → `cebu` pool → **Visayas** tab only.
  - `SM Mall of Asia` — 14.534844, 120.98284 → `manila` pool → **Luzon** tab + Manila pill.
  - `Bonifacio High Street` — 14.550612, 121.050053 → `manila` pool → **Luzon** tab + Manila pill.
    BGC is a district, not a POI; the pin is Bo's Coffee on the High Street,
    the district's representative point.
- Coordinates came from a live TomTom Search probe on 2026-09-30, not from
  memory. Display titles deliberately differ from provider row names (the
  provider's own "SM Seaside City Cebu" hit is an EV charging station).
- **Why overlays instead of an allowlist entry:** the provider
  miscategorizes all three (`electric vehicle station`, `shop`,
  `restaurant`), so no tourist-category term matches and the coverage layer
  rejects them honestly. Adding `shopping`/`mall` to
  `TOURIST_CATEGORY_ALLOWLIST` would change Gala itineraries and every city
  pool — a far larger blast radius than Suggested Spots needs.
- Behavior: overlays are prepended *before* `rotateByDay`, so they cycle
  with the pool and are never pinned at the head (`route.ts:207-210`). They
  yield to live rows on normalized-title collision, and the existing head-6
  enrichment dresses them (photo tier chain + measured traffic) like any
  other row. Gala, cache, and `touristPoi` are untouched — verified by grep
  (no mall terms in `touristPoi.ts`).
- MOA/BHS appearing in both Manila and Luzon is **structural, not a bug**:
  the two views read the same `?city=manila` feed. Baguio's curated rows
  behave the same way across Baguio and Luzon.

### 12.5 Verification record

- Full suite 108/108 (878 passed) · `tsc --noEmit` clean · ESLint 0 errors on
  touched files (one pre-existing `tomtomTrafficService` restricted-import
  warning in `route.ts` predates this work).
- Shipped as one slice per branch/PR, no co-author trailers: #669 (Visayas
  members), #670 (region render keys), #671 (pill unification + Luzon +
  overlays), #672 (single Luzon pill). This file is the docs slice.
- Known gap: the §10 "Osmani review" gate was satisfied manually, not by the
  subagent (it hung and was cancelled twice). The manual pass covered
  correctness, readability, architecture, security, and performance, and
  removed two dead imports it would have flagged.

### 12.6 Gotchas for future agents

- Never add a region id to `SPOT_SCOPES` — it renders a second, inert pill
  (#672).
- Never add a region id to `SUPPORTED`, `TargetCityId`, or the Gala enum —
  regions are view-only unions, not retrieval scopes.
- Never "fix" a missing mall by widening `TOURIST_CATEGORY_ALLOWLIST` —
  overlays are the Spots-only path; the allowlist is Gala's.
- Overlays bypass `isTouristPoi` bounds/category verification by design
  (coordinates are provider-pinned). Keep the list to reviewed venues.
- Pill-less scopes (`boracay`, `cebu`, `el_nido`) still answer
  `?city=`; that is required for the region unions, not an oversight.
