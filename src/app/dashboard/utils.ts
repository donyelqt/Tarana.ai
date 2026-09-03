import { TIER_CONFIGS } from '@/lib/referral-system/types';
import { fetchWeatherFromAPI, type WeatherData } from '@/lib/core/utils';

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
export const REFERRAL_STALE_TIME_MS = 60 * 1000;

/**
 * Shipped weather query config (single source of truth — page.tsx and tests
 * share this factory, so a regression in staleTime/refetch policy breaks the
 * cache test instead of silently restoring per-mount refetch).
 */
export function weatherQueryOptions(
  enabled: boolean,
  queryFn: () => Promise<WeatherData | null> = fetchWeatherFromAPI
) {
  return {
    queryKey: [...WEATHER_QUERY_KEY],
    queryFn,
    enabled,
    staleTime: WEATHER_STALE_TIME_MS,
    gcTime: WEATHER_GC_TIME_MS,
    // Provider default is refetchOnMount: false (would serve stale weather
    // forever). true = refetch on mount only when stale (>10min).
    refetchOnMount: true as const,
  };
}

/** Fetch + map /api/referrals/stats. Throws on HTTP error so retry engages. */
export async function fetchReferralStats(
  fetcher: typeof fetch = fetch
): Promise<ReferralStatsView | null> {
  const r = await fetcher('/api/referrals/stats');
  if (!r.ok) throw new Error(`Referral stats error: ${r.status}`);
  return mapReferralStatsResponse(await r.json());
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
) {
  return {
    queryKey: ['referral-stats', userId],
    queryFn,
    enabled: status === 'authenticated' && !!userId,
    staleTime: REFERRAL_STALE_TIME_MS,
  };
}


