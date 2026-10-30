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
  
  label: string;
  nextTierName: string;
  nextBenefit: string;
  progress: number;
  invitesNeeded: number;
}


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


export function isFallbackWeather(
  w: { isFallback?: boolean } | null | undefined
): boolean {
  return w?.isFallback === true;
}












export type TrafficLevel = 'Low' | 'Moderate' | 'High';

export interface RecommendationCard {
  name: string;
  image: string | null;
  distance: string;
  time: string;
  
  traffic?: TrafficLevel;
  lat: number;
  lon: number;
  mapLabel?: string;
}


export const SPOT_SCOPES = [
  { id: 'baguio', label: 'Baguio' },
  { id: 'manila', label: 'Manila' },
  { id: 'davao', label: 'Davao' },
] as const;

export type SpotScopeId = (typeof SPOT_SCOPES)[number]['id'];

export function isSpotScopeId(value: unknown): value is SpotScopeId {
  return SPOT_SCOPES.some((s) => s.id === value);
}


export interface SpotPayload {
  name: string;
  image: string | null;
  lat: number | null;
  lon: number | null;
  peakHours: string | null;
  traffic?: TrafficLevel;
}


export interface SpotOverlay {
  
  city: 'cebu' | 'manila';
  
  name: string;
  lat: number;
  lon: number;
}

export const SPOT_OVERLAYS: readonly SpotOverlay[] = [
  { city: 'cebu', name: 'SM Seaside City Cebu', lat: 10.281732, lon: 123.880608 },
  { city: 'manila', name: 'SM Mall of Asia', lat: 14.534844, lon: 120.98284 },
  { city: 'manila', name: 'Bonifacio High Street', lat: 14.550612, lon: 121.050053 },
];


export function withSpotOverlays(city: string, pool: SpotPayload[]): SpotPayload[] {
  const overlays = SPOT_OVERLAYS.filter((o) => o.city === city);
  if (overlays.length === 0) return pool;
  const have = new Set(pool.map((s) => s.name.trim().toLowerCase()));
  const rows: SpotPayload[] = overlays
    .filter((o) => !have.has(o.name.trim().toLowerCase()))
    .map((o) => ({ name: o.name, image: null, lat: o.lat, lon: o.lon, peakHours: null }));
  return [...rows, ...pool];
}


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


export function spotPool(): Activity[] {
  const all = sampleItinerary.items.flatMap((s) => s.activities);
  return all.filter(
    (a) =>
      !isCafeActivity(a.title) &&
      coordsFor(a.title, a.lat, a.lon) !== null &&
      imageSrc(a.image) !== null
  );
}


export function rankSpots(
  pool: Activity[],
  now: Date = new Date(),
  count = 3,
  isPeak: (peakHours: string) => boolean = isCurrentlyPeakHours
): Activity[] {
  
  
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


export function spotsSubtitle(
  top: Activity[],
  isPeak: (peakHours: string) => boolean = isCurrentlyPeakHours
): string {
  const first = top[0];
  if (!first?.peakHours) return 'Optimized for low traffic and crowd';
  return isPeak(first.peakHours) ? 'Best available now' : 'Quietest right now';
}


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

export const REGION_MEMBERS = ['boracay', 'cebu'] as const;

export const LUZON_MEMBERS = ['baguio', 'manila'] as const;

export interface RegionSpotPool {
  city: string;
  spots: SpotPayload[];
}


export interface RegionCard extends SpotPayload {
  
  poolCity: string;
}

export function mergeRegionPools(pools: readonly RegionSpotPool[]): RegionCard[] {
  const finite = pools.map((pool) => ({
    city: pool.city,
    
    
    
    
    
    
    
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
      
      
      
      const key = regionCardKey(pool.city, next);
      if (seen.has(key)) continue;
      seen.add(key);
      progressed = true;
      out.push({ ...next, poolCity: pool.city });
    }
  }
  return out;
}


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


export async function fetchSpots(
  
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
      
      
      traffic:
        s.traffic === 'Low' || s.traffic === 'Moderate' || s.traffic === 'High'
          ? s.traffic
          : undefined,
    }));
}


export function spotsQueryOptions(
  
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

export const WEATHER_FALLBACK_RETRY_MS = 60 * 1000;
export const REFERRAL_STALE_TIME_MS = 60 * 1000;


export function weatherQueryOptions(
  enabled: boolean,
  
  
  
  
  queryFn: () => Promise<WeatherData | null> = () => fetchWeatherFromAPI()
): UseQueryOptions<WeatherData | null> {
  return {
    queryKey: [...WEATHER_QUERY_KEY],
    queryFn,
    enabled,
    staleTime: WEATHER_STALE_TIME_MS,
    gcTime: WEATHER_GC_TIME_MS,
    
    
    refetchOnMount: true as const,
    
    
    
    
    
    refetchInterval: (query) =>
      isFallbackWeather(query.state.data ?? null)
        ? WEATHER_FALLBACK_RETRY_MS
        : false,
  };
}


export interface TaranaStatsView {
  itineraries: number;
  cafes: number;
  meals: number;
  explorers: number;
}


export async function fetchReferralStats(
  fetcher: typeof fetch = fetch
): Promise<ReferralStatsView | null> {
  const r = await fetcher('/api/referrals/stats');
  if (!r.ok) throw new Error(`Referral stats error: ${r.status}`);
  return mapReferralStatsResponse(await r.json());
}


export function buildInviteLink(origin: string, code: string): string {
  return `${origin}/auth/signup?ref=${encodeURIComponent(code)}`;
}


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




