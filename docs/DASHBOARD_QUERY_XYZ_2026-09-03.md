# Dashboard Weather + Referral Stats → TanStack Query — XYZ

**Files:** `src/app/dashboard/page.tsx`, `src/app/dashboard/utils.ts`,
`src/app/dashboard/__tests__/utils.test.ts`, `src/lib/core/utils.ts`
**Commits:** `3e4757e` → merge `4bb1b49` → `6f7b6c1` → merge `85ccc09`
**Convention:** `QueryProvider` (`src/components/providers/QueryProvider.tsx`:
`staleTime` 5min, `gcTime` 10min, `refetchOnMount: false`,
`refetchOnWindowFocus: false`, `retry: 1`) + `useQuery` pattern already used by
`saved-trips`, `saved-meals`, `settings`
**Date:** 2026-09-03

## X — What we saw
On the dashboard, every mount fired a manual weather `fetch` (1 OpenWeather
proxy hit per visit, zero caching) and **two** un-deduped referral-stats
fetches (mount + manual re-fetch after tracking). The referral endpoint in use
(`/api/referrals/debug`) returns **404 in production** (`debug/route.ts:10-12`),
so prod users were stuck on "Loading referrals..." permanently. The tier widget
also computed its 1/3/5 ladder inline (duplicating `TierService`), rendering
`10/5 referrals` for users past 5, and the offline weather fallback (18°C
"clear sky") was presented as live data.

## Y — What we did about it
1. **Weather → `useQuery`** (`["weather", "baguio"]`, `staleTime` 10min,
   `refetchOnMount: true` — the provider default `false` would serve stale
   weather forever; `true` refetches on mount only when stale).
2. **Referral stats → `useQuery`** (`["referral-stats", id]`, `staleTime` 60s,
   `enabled` gated on `!!session?.user?.id` per the `saved-meals` convention),
   pointed at prod-safe `/api/referrals/stats` with an `r.ok` guard, refreshed
   via `invalidateQueries` after tracking instead of a manual re-fetch.
3. **Pure mappers in `dashboard/utils.ts`** (`mapReferralStatsResponse`,
   `getReferralDisplay`) consume server `tierProgress` — the hardcoded ladder
   is deleted, benefits derive from `TIER_CONFIGS`, maxed users render `10/10`.
4. **Fallback marker:** `WeatherData.isFallback?` (optional — all 5 existing
   `fetchWeatherFromAPI` callers unaffected); the card badges fallback data as
   "Typical Baguio weather — live data unavailable."

> **Impact vs. verification / correction 2026-09-03.** This doc first blamed
> transient upstream 400s. The badge's own `proxy 400: Invalid coordinates`
> line plus a `node -e` reproduction proved the real cause instead: from the
> TanStack migration (`3e4757e`) through the factory refactor, the weather
> `queryFn` was the **bare `fetchWeatherFromAPI` reference**, which TanStack
> invokes with a QueryFunctionContext argument — so every call sent
> `lat=[object Object]` (verified: `parseFloat` of it is `NaN`). The user's
> "worked before TanStack" report was correct; the transient theory was wrong.
> "Before" counts below are read from pre-patch code; "after" counts are
> measured. No browser paint metrics: this change alters request volume and
> correctness, not DOM.

## Z — The outcome

### Impact (before: read from pre-patch code; after: measured)
| Flow | Before | After |
|---|---|---|
| Weather proxy hits per 3 dashboard mounts | 3 (fetch on every mount) | **1, measured** (`pageNetwork.test.tsx`) |
| Weather request validity | `lat=[object Object]` → upstream/proxy 400 on **every** call since `3e4757e` | real coords, asserted per-call in `pageNetwork.test.tsx` |
| Referral-stats fetches per 3 mounts | 6 (mount + re-fetch, un-deduped) | **1, measured** (`pageNetwork.test.tsx`) |
| Referral endpoint failure rate in prod | 100% (`debug` 404) | **0%** (`/stats`; `r.ok` guard + `retry: 1`) |
| Tarana Stats values | hardcoded 302 / 22 / 104 / 4,901 (visits cards had no source at all) | **measured**: `count(itineraries)`, `restaurants.length`, `count(saved_meals)`, `count(users)` via `GET /api/stats`; visits fiction deleted |
| Suggested Spots cards | 3 hardcoded names/distances/traffic | **ranked live**: off-peak first (soft penalty, never filtered) + daily rotation; distances haversine from city center (`~`), traffic from live peak state |
| Recommended Cafes cards | 3 hardcoded names/distances/traffic | **taste-matched**: cuisine/tag overlap with your saved meals (saved spots excluded), ratings fallback; subtitle honest about which mode |
| Tier-label overflow (`current > 5`) | `10/5 referrals` | **`10/10`** + max-tier message |
| Fallback weather shown as live | always | **badged** as typical, not live |
| Hardcoded tier ladder in render layer | ~15 lines | **0** (server `tierProgress`) |

### Verification (measured — not "impact", just proof it holds)
- **11/11** new Jest tests pass (`dashboard/__tests__/utils.test.ts`: mapper
  shapes, display states incl. the `10/10` overflow case, fallback detection).
- **Cache behavior measured with a real `QueryClient`**
  (`dashboard/__tests__/queryCache.test.tsx`, 3/3 pass, against the shipped
  `weatherQueryOptions`/`referralQueryOptions` factories in `dashboard/utils.ts`
  — page and test share the config, so no drift):
  - weather: **2 mounts → 1 `queryFn` call** (second mount served from cache).
    Sabotage check: `staleTime = 0` makes this test fail (2 calls) → the test
    is non-vacuous.
  - referral: **1 fetch on mount, exactly 1 more after `invalidateQueries`**
    (the post-tracking refresh path); `enabled` is `false` when
    unauthenticated or id-less.
- **Real page, 3 mounts, one shared client** (`pageNetwork.test.tsx`, 1/1
  pass): renders actual `page.tsx` (auth mocked authenticated, fetch routed
  by URL) → `/api/weather` called **once**, `/api/referrals/stats` called
  **once**, `/api/stats` called **once** with real card values rendered
  (`34` under MEALS SAVED, `56` under EXPLORERS); mounts 2–3 served fully
  from cache. This is the end-to-end request count short of a real browser
  (jsdom: no layout/paint).
- **Stats route** (`api/stats/__tests__/route.test.ts`, 2/2): exact counts +
  static cafes length passthrough; any single table failure → 500.
- **Recommendations** (`dashboard/__tests__/utils.test.ts`, +9): haversine
  Burnham ≈0.5km, peak→High/off-peak→Low/unknown→Moderate, off-peak-first +
  deterministic rotation, taste overlap + save-exclusion, null-skips,
  TZ-proof peak assertions. Page-level: real page renders 3 Visit Spot +
  3 taste-matched View Cafe cards with "Matched to your tastes".
- Gala machinery deliberately NOT used (per-load AI cost/latency/quota for 6
  cards); only its soft-penalty ranking principle. No geolocation, no
  per-visit routing (quota + permission friction); distances are
  from-center `~` estimates, disclosed in code and copy.
- **0** `tsc` errors in changed code; full-repo `tsc` shows only the **10
  pre-existing** `email.test.ts` errors (untouched).
- Scoped suites green (`dashboard` 15/15, `trafficColors` 50/50).
- Static components (`SuggestedSpots`, `RecommendedCafes`, Tarana Stats) and
  `useSession` intentionally untouched.

## Gotchas for future readers
- `fetchWeatherFromAPI` never rejects (returns fallback) — `useQuery.isError`
  on weather is effectively dead; the badge, not the error card, is the
  fallback signal.
- `session.user.id` is assumed present when `status === 'authenticated'`
  (`auth.ts:371`); Google lookup-miss leaves it `undefined` and the `!!id`
  gate keeps the widget on loading rather than fetching as `undefined`.
