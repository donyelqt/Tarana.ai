import { TIER_CONFIGS } from '@/lib/referral-system/types';
import { fetchWeatherFromAPI, type WeatherData } from '@/lib/core/utils';
import type { UseQueryOptions } from '@tanstack/react-query';

/**
 * View model for the dashboard referral widget. `nextTier` is null once the
 * user reaches the top tier (Voyager) — the render layer treats that as maxed.
 */
export interface ReferralStatsView {
  activeReferrals: number;
  currentTier: string;
  nextTier: string | null;
  nextTierRequirement: number | null;
  progress: number | null;
}

export interface ReferralDisplay {
  current: number;
  tier: string;
  isMaxed: boolean;
  /** e.g. "1/3". Never overflows: maxed users see "10/10", not "10/5". */
  label: string;
  nextTierName: string;
  nextBenefit: string;
  progress: number;
  invitesNeeded: number;
}

/**
 * Map a raw /api/referrals/stats payload to the dashboard view model.
 * Returns null for any shape that lacks usable stats — the widget then keeps
 * showing its loading state instead of crashing on undefined fields.
 */
export function mapReferralStatsResponse(input: unknown): ReferralStatsView | null {
  if (!input || typeof input !== 'object') return null;
  const d = input as {
    success?: unknown;
    stats?: unknown;
    tierProgress?: unknown;
  };
  if (d.success !== true) return null;
  if (!d.stats || typeof d.stats !== 'object') return null;

  const stats = d.stats as { activeReferrals?: unknown; currentTier?: unknown };
  const tp = (d.tierProgress ?? {}) as {
    nextTier?: unknown;
    nextTierRequirement?: unknown;
    progress?: unknown;
  };

  return {
    activeReferrals:
      typeof stats.activeReferrals === 'number' ? stats.activeReferrals : 0,
    currentTier:
      typeof stats.currentTier === 'string' ? stats.currentTier : 'Default',
    nextTier: typeof tp.nextTier === 'string' ? tp.nextTier : null,
    nextTierRequirement:
      typeof tp.nextTierRequirement === 'number' ? tp.nextTierRequirement : null,
    progress: typeof tp.progress === 'number' ? tp.progress : null,
  };
}

/**
 * Derive widget copy from the server-provided tierProgress. Thresholds and
 * benefits come from TIER_CONFIGS (single source of truth) — no hardcoded
 * 1/3/5 ladder in the render layer.
 */
export function getReferralDisplay(view: ReferralStatsView): ReferralDisplay {
  const isMaxed = view.nextTier == null;
  const nextTarget = view.nextTierRequirement ?? view.activeReferrals;
  const progress =
    view.progress ??
    (isMaxed || nextTarget <= 0
      ? 100
      : Math.min((view.activeReferrals / nextTarget) * 100, 100));

  let nextBenefit = 'Max tier reached!';
  if (!isMaxed && view.nextTier) {
    const cfg = (TIER_CONFIGS as Record<string, { dailyCredits: number }>)[
      view.nextTier
    ];
    nextBenefit = cfg ? `${cfg.dailyCredits} credits/day` : '';
  }

  return {
    current: view.activeReferrals,
    tier: view.currentTier,
    isMaxed,
    label: `${view.activeReferrals}/${nextTarget}`,
    nextTierName: view.nextTier ?? view.currentTier,
    nextBenefit,
    progress,
    invitesNeeded: isMaxed ? 0 : Math.max(nextTarget - view.activeReferrals, 0),
  };
}

/** True only when the weather payload is the offline fallback (utils.ts). */
export function isFallbackWeather(
  w: { isFallback?: boolean } | null | undefined
): boolean {
  return w?.isFallback === true;
}

export const WEATHER_QUERY_KEY = ['weather', 'baguio'] as const;
export const WEATHER_STALE_TIME_MS = 10 * 60 * 1000;
export const WEATHER_GC_TIME_MS = 30 * 60 * 1000;
export const STATS_STALE_TIME_MS = 5 * 60 * 1000;
/**
 * While the cache holds fallback data (upstream was down at fetch time),
 * revalidate in the background at this cadence until live data arrives.
 * Cost is bounded: only during outages, and it stops the moment live data
 * lands. Deliberately longer than the OpenWeather free-tier 60 calls/min
 * budget is per-key, not per-client — one client at 1/min is noise.
 */
export const WEATHER_FALLBACK_RETRY_MS = 60 * 1000;
export const REFERRAL_STALE_TIME_MS = 60 * 1000;

/**
 * Shipped weather query config (single source of truth — page.tsx and tests
 * share this factory, so a regression in staleTime/refetch policy breaks the
 * cache test instead of silently restoring per-mount refetch).
 */
export function weatherQueryOptions(
  enabled: boolean,
  // NOTE: must stay a zero-arg closure. TanStack invokes queryFn with a
  // QueryFunctionContext argument — passing the bare fetchWeatherFromAPI
  // reference made lat=[object Object] (2026-09-03 incident: every dashboard
  // weather call 400'd from the TanStack migration until this fix).
  queryFn: () => Promise<WeatherData | null> = () => fetchWeatherFromAPI()
): UseQueryOptions<WeatherData | null> {
  return {
    queryKey: [...WEATHER_QUERY_KEY],
    queryFn,
    enabled,
    staleTime: WEATHER_STALE_TIME_MS,
    gcTime: WEATHER_GC_TIME_MS,
    // Provider default is refetchOnMount: false (would serve stale weather
    // forever). true = refetch on mount only when stale (>10min).
    refetchOnMount: true as const,
    // Self-healing outage behavior (2026-09-03 incident: fallback cached as
    // data sat visible for the full 10-min stale window). While the cached
    // value is the offline fallback, poll in the background until live data
    // arrives; live data disables the interval entirely (quota-safe: the
    // 10-min staleTime still governs the healthy path).
    refetchInterval: (query) =>
      isFallbackWeather(query.state.data ?? null)
        ? WEATHER_FALLBACK_RETRY_MS
        : false,
  };
}

/** Global aggregates for the Tarana Stats widget (GET /api/stats). */
export interface TaranaStatsView {
  itineraries: number;
  cafes: number;
  meals: number;
  explorers: number;
}

/** Fetch + map /api/referrals/stats. Throws on HTTP error so retry engages. */
export async function fetchReferralStats(
  fetcher: typeof fetch = fetch
): Promise<ReferralStatsView | null> {
  const r = await fetcher('/api/referrals/stats');
  if (!r.ok) throw new Error(`Referral stats error: ${r.status}`);
  return mapReferralStatsResponse(await r.json());
}

/** Fetch + map /api/stats. Throws on HTTP error so retry engages. */
export async function fetchTaranaStats(
  fetcher: typeof fetch = fetch
): Promise<TaranaStatsView | null> {
  const r = await fetcher('/api/stats');
  if (!r.ok) throw new Error(`Tarana stats error: ${r.status}`);
  return mapTaranaStatsResponse(await r.json());
}

export function mapTaranaStatsResponse(input: unknown): TaranaStatsView | null {
  if (!input || typeof input !== 'object') return null;
  const d = input as { success?: unknown; stats?: unknown };
  if (d.success !== true) return null;
  if (!d.stats || typeof d.stats !== 'object') return null;
  const s = d.stats as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    itineraries: num(s.itineraries),
    cafes: num(s.cafes),
    meals: num(s.meals),
    explorers: num(s.explorers),
  };
}

/** Shipped stats config: public aggregates, 5-min stale like the provider default. */
export function taranaStatsQueryOptions(
  status: string,
  queryFn: () => Promise<TaranaStatsView | null> = () => fetchTaranaStats()
): UseQueryOptions<TaranaStatsView | null> {
  return {
    queryKey: ['tarana-stats'],
    queryFn,
    enabled: status === 'authenticated',
    staleTime: STATS_STALE_TIME_MS,
  };
}

/**
 * Shipped referral query config. Gate matches the saved-meals convention
 * (saved-meals/page.tsx:36): no fetch+cache of ["referral-stats", undefined].
 */

export function referralQueryOptions(
  status: string,
  userId: string | undefined,
  queryFn: () => Promise<ReferralStatsView | null> = () =>
    fetchReferralStats()
): UseQueryOptions<ReferralStatsView | null> {
  return {
    queryKey: ['referral-stats', userId],
    queryFn,
    enabled: status === 'authenticated' && !!userId,
    staleTime: REFERRAL_STALE_TIME_MS,
  };
}




