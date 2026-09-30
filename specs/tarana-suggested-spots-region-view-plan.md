# Suggested Spots — Region View (v2, UI-only)

> **Status 2026-09-30: member set corrected.** Region members are **exactly
> `boracay` + `cebu`** — the two genuine Visayas scopes. El Nido is Palawan
> (Mimaropa), keeps its own `el_nido` city pill, and is deliberately excluded:
> a "Visayas" tab containing Luzon would be a mislabel, not a region.
> Implemented on `feat/suggested-spots-region-view` as a two-member union;
> this file records that shape, not the three-member draft it replaced.

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

- Region exists in **exactly one place**: the component that renders it.
- Never added to: `SpotScopeId`, `SPOT_SCOPES`, `SUPPORTED`, `TargetCityId`, `CITY_CONFIGS`, Gala `z.enum`, form pills, `places.city_id`, mobile lists.
- Backend delta: **zero**. Three existing city queries, existing keys, existing staleTime, existing partitions.
- Gala behavior: unchanged. `getTouristPois('visayas')` returns `[]` by existing design; the view never calls it.

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
- [x] City path unchanged; backend diff is zero
- [ ] Osmani review clean

## 11. Not doing (and why)

- A `"visayas"` retrieval scope — the parent spec §§2–3 rejects it with numbers (254,880 km² box, 289–500km member distances, Mimaropa mislabel)
- El Nido in the Visayas tab — Palawan is Mimaropa; it keeps its own `el_nido` pill in both Suggested Spots and Gala
- Gala region itineraries — no product exists for multi-city single trips; out of scope
- Mobile parity in v1 — separate decision (§4.4)
- New ranking infrastructure — `toSpotCard` + existing helpers suffice
