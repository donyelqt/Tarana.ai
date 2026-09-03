import { TIER_CONFIGS } from '@/lib/referral-system/types';
import {
  BAGUIO_COORDINATES,
  fetchWeatherFromAPI,
  type WeatherData,
} from '@/lib/core/utils';
import type { UseQueryOptions } from '@tanstack/react-query';
import { getActivityCoordinates } from '@/lib/data/baguioCoordinates';
import {
  getManilaTime,
  isCurrentlyPeakHours,
  isPeakHour,
} from '@/lib/traffic/peakHours';
import { restaurants } from '@/app/tarana-eats/data/taranaEatsData';
import type { RestaurantData } from '@/app/tarana-eats/data/types';
import {
  sampleItinerary,
  type Activity,
} from '@/app/itinerary-generator/data/itineraryData';
import type { SavedMeal } from '@/app/saved-meals/data';
import type { StaticImageData } from 'next/image';

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

// ---------------------------------------------------------------------------
// Recommendations engine (Suggested Spots + Recommended Cafes)
//
// Every value on the cards is DERIVED, never hardcoded:
// - pool: real datasets (itinerary activities, restaurant registry)
// - order: live signals (off-peak state, taste overlap) + deterministic rotation
// - distance/time: haversine from Baguio center, "~"-prefixed estimates —
//   there is no user geolocation in the app, so "from you" is unknowable.
//   Gala principle applied: soft-penalty ranking, never hard filters.
// ---------------------------------------------------------------------------

export type TrafficLevel = 'Low' | 'Moderate' | 'High';

export interface RecommendationCard {
  name: string;
  image: string;
  distance: string;
  time: string;
  traffic: TrafficLevel;
  lat: number;
  lon: number;
  mapLabel?: string;
}

/** City driving average used for "~N min" estimates. */
export const AVG_CITY_KMH = 20;

export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistanceKm(km: number): string {
  return km < 10 ? `~${km.toFixed(1)}km` : `~${Math.round(km)}km`;
}

export function estimateMinutes(km: number): string {
  return `~${Math.max(1, Math.round((km / AVG_CITY_KMH) * 60))} min`;
}

function imageSrc(image: string | StaticImageData): string | null {
  if (typeof image === 'string') return image || null;
  return image?.src ?? null;
}

function coordsFor(
  title: string,
  lat?: number,
  lon?: number
): { lat: number; lon: number } | null {
  if (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon)
  ) {
    return { lat, lon };
  }
  const c = getActivityCoordinates(title);
  return c ? { lat: c.lat, lon: c.lon } : null;
}

/**
 * Per-place traffic from live peak state. In-peak → High, off-peak → Low.
 * No data → Moderate (unknown-typical). Documented coarseness: without a
 * routing origin this is a schedule signal, not a measured jam.
 */
export function trafficForSpot(
  peakHours: string | undefined,
  isPeak: (peakHours: string) => boolean = isCurrentlyPeakHours
): TrafficLevel {
  if (!peakHours) return 'Moderate';
  return isPeak(peakHours) ? 'High' : 'Low';
}

function isCafeActivity(title: string): boolean {
  const t = title.toLowerCase();
  return restaurants.some((r) => {
    const n = r.name.toLowerCase();
    return t.includes(n) || n.includes(t);
  });
}

/** Attraction pool: real activities with resolvable coords + image. */
export function spotPool(): Activity[] {
  const all = sampleItinerary.items.flatMap((s) => s.activities);
  return all.filter(
    (a) =>
      !isCafeActivity(a.title) &&
      coordsFor(a.title, a.lat, a.lon) !== null &&
      imageSrc(a.image) !== null
  );
}

/**
 * Rank spots: off-peak first (soft bonus/penalty à la Gala — never filtered),
 * then deterministic daily rotation for variety. Injectable clock + peak fn
 * for tests.
 */
export function rankSpots(
  pool: Activity[],
  now: Date = new Date(),
  count = 3,
  isPeak: (peakHours: string) => boolean = isCurrentlyPeakHours
): Activity[] {
  // Rotate the POOL first (variety), then stable-sort by score: ranking
  // integrity wins — off-peak always outranks in-peak, ties break by day.
  const day = Math.floor(now.getTime() / 86400000);
  const rot = pool.length ? day % pool.length : 0;
  const rotated = [...pool.slice(rot), ...pool.slice(0, rot)];
  const scored = rotated.map((a) => {
    let score = 0;
    if (a.peakHours) score += isPeak(a.peakHours) ? -2 : 2;
    return { a, score };
  });
  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, count).map((s) => s.a);
}

/**
 * Honest subtitle for the spots header, derived from the actual top pick:
 * off-peak on top → "Quietest right now"; everything peaking → the ranking
 * still surfaces the least-bad option ("Best available now"); no peak data
 * at all → the generic line. Never claims quiet it can't see.
 */
export function spotsSubtitle(
  top: Activity[],
  isPeak: (peakHours: string) => boolean = isCurrentlyPeakHours
): string {
  const first = top[0];
  if (!first?.peakHours) return 'Optimized for low traffic and crowd';
  return isPeak(first.peakHours) ? 'Best available now' : 'Quietest right now';
}

export function toSpotCard(
  activity: Activity,
  origin: { lat: number; lon: number } = BAGUIO_COORDINATES
): RecommendationCard | null {
  const coords = coordsFor(activity.title, activity.lat, activity.lon);
  const image = imageSrc(activity.image);
  if (!coords || !image) return null;
  const km = haversineKm(origin, coords);
  return {
    name: activity.title,
    image,
    distance: formatDistanceKm(km),
    time: estimateMinutes(km),
    traffic: trafficForSpot(activity.peakHours),
    lat: coords.lat,
    lon: coords.lon,
  };
}

export interface RankedCafe {
  restaurant: RestaurantData;
  /** Number of cuisine/tag terms overlapping the user's taste profile. */
  score: number;
  matchedOn: string[];
}

function findRestaurant(name: string): RestaurantData | undefined {
  const t = name.toLowerCase().trim();
  return (
    restaurants.find((r) => r.name.toLowerCase() === t) ??
    restaurants.find((r) => {
      const n = r.name.toLowerCase();
      return t.includes(n) || n.includes(t);
    })
  );
}

/** Taste profile from the user's saved meals: cuisines + tags of saved spots. */
export function tasteProfile(savedMeals: SavedMeal[]): {
  terms: Set<string>;
  savedNames: Set<string>;
} {
  const terms = new Set<string>();
  const savedNames = new Set<string>();
  for (const meal of savedMeals) {
    if (!meal?.cafeName) continue;
    savedNames.add(meal.cafeName.toLowerCase().trim());
    const r = findRestaurant(meal.cafeName);
    if (!r) continue;
    for (const term of [...r.cuisine, ...r.tags]) terms.add(term.toLowerCase());
  }
  return { terms, savedNames };
}

/**
 * Rank cafes by taste overlap (discovery: already-saved spots excluded).
 * No saves, or no overlap → ratings order fallback. Cafes without resolvable
 * coords are skipped (distance must stay real).
 */
export function rankCafes(savedMeals: SavedMeal[], count = 3): RankedCafe[] {
  const { terms, savedNames } = tasteProfile(savedMeals);
  const scored = restaurants
    .filter(
      (r) =>
        !savedNames.has(r.name.toLowerCase()) && coordsFor(r.name) !== null
    )
    .map((r) => {
      const candidates = new Set(
        [...r.cuisine, ...r.tags].map((t) => t.toLowerCase())
      );
      const matchedOn = [...candidates].filter((t) => terms.has(t));
      return { restaurant: r, score: matchedOn.length, matchedOn };
    });
  scored.sort(
    (x, y) =>
      y.score - x.score ||
      (y.restaurant.ratings ?? 0) - (x.restaurant.ratings ?? 0) ||
      x.restaurant.name.localeCompare(y.restaurant.name)
  );
  return scored.slice(0, count);
}

/** City-level traffic is the only live signal for cafes (no per-place hours). */
export function toCafeCard(
  ranked: RankedCafe,
  origin: { lat: number; lon: number } = BAGUIO_COORDINATES,
  now: Date = getManilaTime()
): RecommendationCard | null {
  const { restaurant } = ranked;
  const coords = coordsFor(restaurant.name);
  const image = imageSrc(restaurant.image);
  if (!coords || !image) return null;
  const km = haversineKm(origin, coords);
  return {
    name: restaurant.name,
    image,
    distance: formatDistanceKm(km),
    time: estimateMinutes(km),
    traffic: isPeakHour(now) ? 'High' : 'Low',
    lat: coords.lat,
    lon: coords.lon,
  };
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




