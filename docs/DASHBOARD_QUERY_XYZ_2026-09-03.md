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

> **Impact vs. verification.** This repo has no product telemetry for the
> dashboard, so the impact figures below are counted from the request flow
> (fetches per mount in the code), not from measured analytics. The
> "verification" block is the part actually measured in CI.

## Z — The outcome

### Impact (counted from the request flow)
| Flow | Before | After |
|---|---|---|
| Weather proxy hits per dashboard visit | 1, every mount | **0** within the 10-min stale window |
| Referral-stats fetches per mount | **2**, un-deduped | **1**, cached 60s |
| Referral endpoint failure rate in prod | 100% (`404`) | **0%** (`/stats`) |
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
- **0** `tsc` errors in changed code; full-repo `tsc` shows only the **10
  pre-existing** `email.test.ts` errors (untouched).
- Scoped suites green (`dashboard` 14/14, `trafficColors` 50/50).
- Static components (`SuggestedSpots`, `RecommendedCafes`, Tarana Stats) and
  `useSession` intentionally untouched.
- Not measured (no browser harness in this env — no Playwright/MCP): end-user
  Network-tab counts across 3 hard reloads. The unit-level numbers above pin
  the mechanism; a 10-minute DevTools session would confirm it end to end.

## Gotchas for future readers
- `fetchWeatherFromAPI` never rejects (returns fallback) — `useQuery.isError`
  on weather is effectively dead; the badge, not the error card, is the
  fallback signal.
- `session.user.id` is assumed present when `status === 'authenticated'`
  (`auth.ts:371`); Google lookup-miss leaves it `undefined` and the `!!id`
  gate keeps the widget on loading rather than fetching as `undefined`.
