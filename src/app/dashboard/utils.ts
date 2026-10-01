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
  image: string | null;
  distance: string;
  time: string;
  /** Absent when no live signal exists — the card hides the badge. */
  traffic?: TrafficLevel;
  lat: number;
  lon: number;
  mapLabel?: string;
}

/** City scopes with curated-or-searchable spot coverage. */
export const SPOT_SCOPES = [
  { id: 'baguio', label: 'Baguio' },
  { id: 'manila', label: 'Manila' },
  { id: 'davao', label: 'Davao' },
] as const;

export type SpotScopeId = (typeof SPOT_SCOPES)[number]['id'];

export function isSpotScopeId(value: unknown): value is SpotScopeId {
  return SPOT_SCOPES.some((s) => s.id === value);
}

/**
 * Transport shape for spots (GET /api/spots + curated Baguio pool).
 * peakHours null = no live signal (badge hidden, never guessed).
 * image null = no photo on file (placeholder rendered).
 * traffic = measured flow congestion (non-Baguio enriched path only).
 */
export interface SpotPayload {
  name: string;
  image: string | null;
  lat: number | null;
  lon: number | null;
  peakHours: string | null;
  traffic?: TrafficLevel;
}

/**
 * Spots-only curated overlay: venues the provider miscategorizes (malls come
 * back as `shop`/`shopping center`, never a tourist term) but users expect
 * in Suggested Spots. Coordinates are provider-pinned (TomTom Search,
 * 2026-09-30): SM Seaside 10.281732,123.880608 / SM MOA 14.534844,120.98284 /
 * Bonifacio High Street 14.550612,121.050053 (Bo's anchor; BGC is a district,
 * not a POI, so the pin is the district's representative point).
 * Display name ≠ provider name on purpose: the card shows the venue users
 * recognize, not the charging-station row the provider returns.
 * Spots-only: the route prepends these to the member pool (dedupe by title
 * guards the day TomTom fixes its categories). Gala, cache, touristPoi, and
 * the allowlist are untouched — mall traffic in itineraries stays rejected.
 */
export interface SpotOverlay {
  /** Route scope this overlay joins (`cebu` or `manila`). */
  city: 'cebu' | 'manila';
  /** Card title — what the user reads. */
  name: string;
  lat: number;
  lon: number;
}

export const SPOT_OVERLAYS: readonly SpotOverlay[] = [
  { city: 'cebu', name: 'SM Seaside City Cebu', lat: 10.281732, lon: 123.880608 },
  { city: 'manila', name: 'SM Mall of Asia', lat: 14.534844, lon: 120.98284 },
  { city: 'manila', name: 'Bonifacio High Street', lat: 14.550612, lon: 121.050053 },
];

/**
 * Prepend the city's curated overlays to a member pool. Overlay rows carry
 * null image/peakHours so the head-6 enrichment dresses them like any other
 * head row (photo tier-chain + measured traffic); rows TomTom already
 * returned (same normalized title) win and the overlay yields to them.
 */
export function withSpotOverlays(city: string, pool: SpotPayload[]): SpotPayload[] {
  const overlays = SPOT_OVERLAYS.filter((o) => o.city === city);
  if (overlays.length === 0) return pool;
  const have = new Set(pool.map((s) => s.name.trim().toLowerCase()));
  const rows: SpotPayload[] = overlays
    .filter((o) => !have.has(o.name.trim().toLowerCase()))
    .map((o) => ({ name: o.name, image: null, lat: o.lat, lon: o.lon, peakHours: null }));
  return [...rows, ...pool];
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
 * NO DATA → null (badge hidden). Never guessed — a "Moderate" without a
 * measurement is fiction with a color.
 */
export function trafficForSpot(
  peakHours: string | null | undefined,
  isPeak: (peakHours: string) => boolean = isCurrentlyPeakHours
): TrafficLevel | null {
  if (!peakHours) return null;
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

/** Bridge curated activities into the transport shape. */
export function activityToPayload(activity: Activity): SpotPayload {
  const coords = coordsFor(activity.title, activity.lat, activity.lon);
  return {
    name: activity.title,
    image: imageSrc(activity.image),
    lat: coords?.lat ?? null,
    lon: coords?.lon ?? null,
    peakHours: activity.peakHours ?? null,
  };
}

export function toSpotCard(
  payload: SpotPayload,
  origin: { lat: number; lon: number } = BAGUIO_COORDINATES
): RecommendationCard | null {
  if (
    payload.lat === null ||
    payload.lon === null ||
    !Number.isFinite(payload.lat) ||
    !Number.isFinite(payload.lon)
  ) {
    return null;
  }
  const coords = { lat: payload.lat, lon: payload.lon };
  const km = haversineKm(origin, coords);
  return {
    name: payload.name,
    image: payload.image || null,
    distance: formatDistanceKm(km),
    time: estimateMinutes(km),
    traffic: payload.traffic ?? trafficForSpot(payload.peakHours) ?? undefined,
    lat: coords.lat,
    lon: coords.lon,
  };
}
/**
 * Region-tab members. Neither list is a SpotScopeId: no route, service,
 * cache, or Gala path may ever read them. The only consumers are the
 * SuggestedSpots region tabs, which fire one ordinary per-city query per
 * member (all four members have route + CITY_CONFIG + TargetCityId rows).
 * Pills are Baguio/Manila/Davao + the two region tabs; boracay/cebu surface
 * only through Visayas, never as standalone pills.
 */
export const REGION_MEMBERS = ['boracay', 'cebu'] as const;
/** Luzon union: baguio + manila keep standalone pills AND feed the region. */
export const LUZON_MEMBERS = ['baguio', 'manila'] as const;

export interface RegionSpotPool {
  city: string;
  spots: SpotPayload[];
}

/**
 * Union member pools for a region view: round-robin top-1 per pool, then
 * fill, capped at three — so one strong city cannot swallow the tab, and
 * scores never need to be comparable across pools.
 *
 * Rows without finite coordinates are dropped (same rule as `toSpotCard`).
 * Every emitted row carries its source city in `poolCity`, because the route
 * payload has no provider id and the renderer needs an identity stabler than
 * the display name. Same title from two pools stays two rows; same title
 * twice from one pool collapses to one (matching upstream dedupe).
 * An all-empty input returns an empty region, never a fallback.
 */
export interface RegionCard extends SpotPayload {
  /** Owning pool city — part of the render key, not display content. */
  poolCity: string;
}

export function mergeRegionPools(pools: readonly RegionSpotPool[]): RegionCard[] {
  const finite = pools.map((pool) => ({
    city: pool.city,
    // Collapse same-titled rows inside one pool. TomTom genuinely holds several
    // distinct POIs sharing a name — "Boracay Island" comes back ten times
    // across the query buckets at two different coordinates ~500m apart, and
    // "Mountain View Nature's Park" twice at one point. Upstream keeps them
    // (correctly: they are different places), so the renderer received two
    // cards that were indistinguishable to the user. A card is identified by
    // what it shows, and that is the name.
    spots: dedupeByDisplayName(
      (pool.spots ?? []).filter(
        (s) =>
          !!s &&
          typeof s.name === 'string' &&
          typeof s.lat === 'number' &&
          Number.isFinite(s.lat) &&
          typeof s.lon === 'number' &&
          Number.isFinite(s.lon)
      )
    ),
  }));
  const out: RegionCard[] = [];
  const seen = new Set<string>();
  let progressed = true;
  while (out.length < 3 && progressed) {
    progressed = false;
    for (const pool of finite) {
      if (out.length >= 3) break;
      const next = pool.spots.shift();
      if (!next) continue;
      // A name already shown from ANOTHER pool stays visible: two cities may
      // legitimately both have a "SM City", and cross-pool identity is the
      // render key's job. Only within-pool duplicates collapse above.
      const key = regionCardKey(pool.city, next);
      if (seen.has(key)) continue;
      seen.add(key);
      progressed = true;
      out.push({ ...next, poolCity: pool.city });
    }
  }
  return out;
}

/**
 * Case- and whitespace-insensitive display identity. The first row wins, so
 * the ordering the pool arrived in decides which coordinates are kept.
 */
export function dedupeByDisplayName<T extends { name: string }>(spots: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const spot of spots) {
    const key = spot.name.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(spot);
  }
  return out;
}
/**
 * Render key for one region card: owning city plus normalized title, with a
 * 4-decimal coordinate cell only when the same city contributes the same
 * title twice. In practice the upstream dedupe makes the suffix dead code;
 * it exists so the key can never silently collide.
 */
export function regionCardKey(city: string, spot: Pick<SpotPayload, 'name' | 'lat' | 'lon'>): string {
  const base = `${city}:${spot.name.trim().toLowerCase()}`;
  const coords =
    typeof spot.lat === 'number' &&
    Number.isFinite(spot.lat) &&
    typeof spot.lon === 'number' &&
    Number.isFinite(spot.lon)
      ? `:${spot.lat.toFixed(4)},${spot.lon.toFixed(4)}`
      : '';
  return `${base}${coords}`;
}

export const SPOTS_STALE_TIME_MS = 60 * 60 * 1000;

/** Fetch + map GET /api/spots?city=. Throws on HTTP error so retry engages. */
export async function fetchSpots(
  // string, not SpotScopeId: the route serves boracay (region member) with no pill.
  city: string,
  fetcher: typeof fetch = fetch
): Promise<SpotPayload[] | null> {
  const r = await fetcher(`/api/spots?city=${encodeURIComponent(city)}`);
  if (!r.ok) throw new Error(`Spots error: ${r.status}`);
  const d = (await r.json()) as { success?: unknown; spots?: unknown };
  if (d.success !== true || !Array.isArray(d.spots)) return null;
  return d.spots
    .filter(
      (s): s is SpotPayload =>
        !!s &&
        typeof s === 'object' &&
        typeof (s as SpotPayload).name === 'string'
    )
    .map((s) => ({
      name: s.name,
      image: typeof s.image === 'string' ? s.image : null,
      lat: typeof s.lat === 'number' ? s.lat : null,
      lon: typeof s.lon === 'number' ? s.lon : null,
      peakHours: typeof s.peakHours === 'string' ? s.peakHours : null,
      // Sanitize: only real badge levels survive (else the style lookup
      // renders className "undefined").
      traffic:
        s.traffic === 'Low' || s.traffic === 'Moderate' || s.traffic === 'High'
          ? s.traffic
          : undefined,
    }));
}

/** Shipped spots config: POIs barely move — 1hr stale (matches TomTom cache). */
export function spotsQueryOptions(
  // string, not SpotScopeId: the region tab queries boracay, which has pills nowhere.
  city: string,
  status: string,
  queryFn: () => Promise<SpotPayload[] | null> = () => fetchSpots(city)
): UseQueryOptions<SpotPayload[] | null> {
  return {
    queryKey: ['suggested-spots', city],
    queryFn,
    enabled: status === 'authenticated',
    staleTime: SPOTS_STALE_TIME_MS,
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

/**
 * Build the shareable invite link. Format MUST stay
 * `{origin}/auth/signup?ref={code}` — ReferralTracker consumes `?ref=`
 * and no /invite route exists. Pure (testable, no window access here).
 */
export function buildInviteLink(origin: string, code: string): string {
  return `${origin}/auth/signup?ref=${encodeURIComponent(code)}`;
}

/** Fetch the DB-issued code (GET /api/referrals/code). Null when absent. */
export async function fetchReferralCode(
  fetcher: typeof fetch = fetch
): Promise<string | null> {
  const r = await fetcher('/api/referrals/code');
  if (!r.ok) throw new Error(`Referral code error: ${r.status}`);
  const d = (await r.json()) as { success?: unknown; referralCode?: unknown };
  return d.success === true && typeof d.referralCode === 'string'
    ? d.referralCode
    : null;
}

/**
 * Shipped invite-code config. The code MUST come from the DB trigger output
 * (8-char, via /api/referrals/code) — the old `${EMAIL}2024` fabrication
 * matched no row and every copied link was dead (2026-09-03).
 */
export function referralCodeQueryOptions(
  status: string,
  userId: string | undefined,
  queryFn: () => Promise<string | null> = () => fetchReferralCode()
): UseQueryOptions<string | null> {
  return {
    queryKey: ['referral-code', userId],
    queryFn,
    enabled: status === 'authenticated' && !!userId,
    staleTime: 60 * 60 * 1000,
  };
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




