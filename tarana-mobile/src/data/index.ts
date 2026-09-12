/**
 * Backend-agnostic data seam (§2.1, §8).
 *
 * Contract-first (api-and-interface-design): screens consume THESE
 * functions and never `../db`, `../supabase`, or raw `fetch` to web APIs.
 * Swapping a domain from local to HTTP later means changing one function
 * body here — no screen rewrites.
 *
 * Current bindings:
 * - profiles, trips → local SQLite (`../db`). No network, no login.
 * - spots, weather → web enrichment proxy over HTTP. Verified session-free
 *   (`GET /api/spots`, `GET /api/weather` carry no auth check), so these
 *   deliberately send NO token. Offline → thrown Error → caller renders
 *   its cached/empty state (never a login wall).
 *
 * Boundary rule: every HTTP response is untrusted input — shape-validated
 * before use. Every write binds `?` parameters (see ../db).
 */
import { config } from '../config';
import { exchangeForMobileToken, clearStoredToken } from '../auth';
import { createMobileSupabaseClient } from '../supabase';
import { getCityCenter, getCityTimezone } from 'tarana-web/data/cityConfig';
import * as Db from '../db';
import type { LocalProfile } from '../db';

export type { LocalProfile, LocalTrip, LocalMeal } from '../db';
export type { LocalProfile as Profile, LocalTrip as Trip, LocalMeal as Meal } from '../db';

// ── Profiles (local) ─────────────────────────────────────

export const getActiveProfile = Db.getActiveProfile;
export const getActiveProfileId = Db.getActiveProfileId;
export const createProfile = Db.createProfile;
export const clearActiveProfile = Db.clearActiveProfile;

/** Sign-out: drop the local profile pointer and any linked token. */
export async function signOut(): Promise<void> {
  await Db.clearActiveProfile();
  await clearStoredToken();
}

// ── Trips (local; import writes land here too) ────────────

export const listTrips = Db.listTripsByProfile;
export const createTrip = Db.createTrip;
export const deleteTrip = Db.deleteTrip;
export const upsertImportedTrip = Db.upsertImportedTrip;

// ── Meals (local) ────────────────────────────────────────

export const listMeals = Db.listMealsByProfile;
export const createMeal = Db.createMeal;
export const deleteMeal = Db.deleteMeal;

// ── Web import (one-way copy; the JWT is single-use here) ───

type WebItineraryRow = {
  id: string;
  title?: string | null;
  date?: string | null;
  budget?: string | null;
  tags?: string[] | null;
  form_data?: unknown;
  itinerary_data?: unknown;
  weather_data?: unknown;
};

function toPayload(row: WebItineraryRow): string | null {
  try {
    return JSON.stringify({
      formData: row.form_data ?? null,
      itineraryData: row.itinerary_data ?? null,
      weatherData: row.weather_data ?? null,
    });
  } catch {
    return null;
  }
}

function nameFromEmail(email: string): string {
  const local = email.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
  return local || 'My Trips';
}

/**
 * One-way web import (§7.4): browser exchange → copy trips into SQLite →
 * forget the session. The typed credentials never leave the UI layer —
 * actual auth happens in the exchange; the email only seeds a profile
 * name when none exists. Re-imports update via (source, source_id).
 */
export async function importWebTrips(email: string): Promise<{ imported: number; profile: LocalProfile }> {
  const payload = await exchangeForMobileToken();
  const userId = payload?.id ?? payload?.sub;
  if (!userId) throw new Error('Link did not return a user.');

  const profile = (await Db.getActiveProfile()) ?? (await Db.createProfile(nameFromEmail(email)));

  const client = await createMobileSupabaseClient();
  const { data, error: qError } = await client
    .from('itineraries')
    .select('id,title,date,budget,tags,form_data,itinerary_data,weather_data')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (qError) throw new Error(qError.message);

  const rows = (Array.isArray(data) ? data : []) as WebItineraryRow[];
  let imported = 0;
  for (const row of rows) {
    if (!row || typeof row.id !== 'string') continue;
    await Db.upsertImportedTrip({
      profileId: profile.id,
      sourceId: row.id,
      title: row.title ?? null,
      date: row.date ?? null,
      budget: row.budget ?? null,
      tags: Array.isArray(row.tags) ? row.tags.filter((t): t is string => typeof t === 'string') : [],
      payload: toPayload(row),
    });
    imported += 1;
  }
  return { imported, profile };
}

// ── Plan generation (Phase-2 gate — honest stub, not a mock) ─

export type PlanInput = {
  city: string;
  budget: number | null;
  pax: number;
  days: number;
  startDate: string;
  endDate: string;
  interests: string[];
};

/**
 * On-device itinerary generation (§6 Q1 kill-gate).
 *
 * Deliberately unimplemented: the web POST is 401/402-gated by design and
 * there is no cloud fallback for a paid offline app. Phase 2 fills this
 * body with the validated local model; the Plan screen proves the
 * contract (typed input, validated form, honest pending state) meanwhile.
 * Throwing here is a capability gate, not missing code — callers render
 * the pending card, never a dead button.
 */
export async function generateItinerary(_input: PlanInput): Promise<never> {
  throw new Error(
    'On-device planning is being tuned and is not available in this build. Plan with the web app today — your trips import here in one tap.'
  );
}

// ── Places + routes (remote, session-free) ───────────────

export type Place = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
};

function isPlace(value: unknown): value is Place & { coordinates: { lat: number; lng: number } } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const coords = v.coordinates as Record<string, unknown> | undefined;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.address === 'string' &&
    !!coords &&
    typeof coords.lat === 'number' &&
    typeof coords.lng === 'number'
  );
}

/** Autocomplete via `GET /api/locations/search` (no auth; q ≥ 2 chars). */
export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const baseUrl = config.webBaseUrl.replace(/\/$/, '');
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/locations/search?q=${encodeURIComponent(q)}`);
  } catch {
    throw new Error('You are offline.');
  }
  if (!res.ok) throw new Error(`Place search failed (${res.status}).`);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error('Place search response was unreadable.');
  }
  if (typeof json !== 'object' || json === null || !Array.isArray((json as { results?: unknown }).results)) {
    throw new Error('Place search response was not successful.');
  }
  const results = (json as { results: unknown[] }).results;
  return results.filter(isPlace).map((r) => ({
    id: r.id,
    name: r.name,
    address: r.address,
    lat: r.coordinates.lat,
    lon: r.coordinates.lng,
  }));
}

export type RouteStep = {
  text: string;
  meters: number;
  seconds: number;
};

export type RouteTrafficLevel = 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';

/** Web parity: RouteType/VehicleType from `src/types/route-optimization.ts:33-34`. */
export type ExploreRouteType = 'fastest' | 'shortest' | 'eco' | 'thrilling';
export type ExploreVehicleType = 'car' | 'truck' | 'motorcycle' | 'bicycle' | 'walk';

/**
 * Web parity: FloatingSearchCard preferences (minus departureTime — that
 * needs a native datetime picker dep; the web default is unset, so
 * defaults stay at parity). Scenic sends 'thrilling' (web value).
 */
export type ExplorePreferences = {
  routeType: ExploreRouteType;
  vehicleType: ExploreVehicleType;
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  avoidFerries?: boolean;
  avoidTrafficJams?: boolean;
};

/** Web parity: ExploreMapView DEFAULT_PREFERENCES (routeType fastest, car, avoid jams). */
export const DEFAULT_EXPLORE_PREFS: ExplorePreferences = {
  routeType: 'fastest',
  vehicleType: 'car',
  avoidTrafficJams: true,
};

/**
 * Web parity: ExploreMapView POPULAR_LOCATIONS (pure data, Metro-safe).
 * Shown when the field is not actively typing — same isTyping rule as
 * FloatingSearchCard LocationField. lng → lon at the boundary.
 */
export const POPULAR_LOCATIONS: Place[] = [
  { id: 'uc_baguio', name: 'University of the Cordilleras', address: 'Gov. Pack Rd, Baguio City', lat: 16.4088, lon: 120.5979 },
  { id: 'newtown_plaza', name: 'New Town Plaza Hotel', address: 'Navy Base Road, Baguio City', lat: 16.4158, lon: 120.6122 },
  { id: 'burnham_park', name: 'Burnham Park', address: 'Downtown Baguio City', lat: 16.4095, lon: 120.5948 },
  { id: 'sm_baguio', name: 'SM City Baguio', address: 'Upper Session Rd, Baguio City', lat: 16.4088, lon: 120.5993 },
  { id: 'session_road', name: 'Session Road', address: 'Session Rd, Baguio City', lat: 16.4124, lon: 120.5973 },
  { id: 'baguio_cathedral', name: 'Baguio Cathedral', address: 'Cathedral Loop, Baguio City', lat: 16.4138, lon: 120.5934 },
  { id: 'camp_john_hay', name: 'Camp John Hay', address: 'Loakan Rd, Baguio City', lat: 16.4025, lon: 120.5897 },
  { id: 'mines_view_park', name: 'Mines View Park', address: 'Mines View Park Rd, Baguio City', lat: 16.4089, lon: 120.5678 },
];

export type RouteAlternative = {
  id: string;
  minutes: number;
  km: number;
  delayMinutes: number;
  steps: RouteStep[];
  /** Flattened leg geometry for map polylines (TomTom embed bridge). */
  path: Array<{ lat: number; lon: number }>;
};

export type RouteTraffic = {
  level: RouteTrafficLevel;
  congestion: number;
  delayMinutes: number;
  incidents: number;
};

/** Web parity: BottomRouteSheet traffic labels (Heavy for HIGH, Severe kept). */
export const TRAFFIC_LABELS: Record<RouteTrafficLevel, string> = {
  VERY_LOW: 'Very low',
  LOW: 'Low',
  MODERATE: 'Moderate',
  HIGH: 'Heavy',
  SEVERE: 'Severe',
};

/** Web parity: BottomRouteSheet dot colors as hex (no Tailwind on native). */
export const TRAFFIC_DOTS: Record<RouteTrafficLevel, string> = {
  VERY_LOW: '#10b981',
  LOW: '#22c55e',
  MODERATE: '#eab308',
  HIGH: '#f97316',
  SEVERE: '#ef4444',
};

export type RouteSummary = {
  minutes: number;
  km: number;
  delayMinutes: number;
  arrival: string | null;
  steps: RouteStep[];
  /** Kept for backward compat (S3 drops usage): prefer `alternatives.length`. */
  alternativeCount: number;
  /** Kept for backward compat (S3 drops usage): prefer `recommendation`. */
  note: string | null;
  alternatives: RouteAlternative[];
  traffic: RouteTraffic | null;
  recommendation: { message: string; timeSavingsMinutes: number | null } | null;
  /** ISO timestamp — BottomRouteSheet "Updated … · refreshes every 5 min". */
  updatedAt: string;
  /** Flattened primary-leg geometry for map polylines (TomTom embed bridge). */
  path: Array<{ lat: number; lon: number }>;
};

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** Route via `POST /api/routes/calculate` (no auth). List-first: no map SDK on device. */
export async function calculateRoute(
  origin: Place,
  destination: Place,
  prefs: ExplorePreferences = DEFAULT_EXPLORE_PREFS,
): Promise<RouteSummary> {
  const baseUrl = config.webBaseUrl.replace(/\/$/, '');
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/routes/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: { lat: origin.lat, lng: origin.lon, name: origin.name },
        destination: { lat: destination.lat, lng: destination.lon, name: destination.name },
        preferences: {
          routeType: prefs.routeType,
          vehicleType: prefs.vehicleType,
          ...(prefs.avoidTolls ? { avoidTolls: true } : {}),
          ...(prefs.avoidHighways ? { avoidHighways: true } : {}),
          ...(prefs.avoidFerries ? { avoidFerries: true } : {}),
          ...(prefs.avoidTrafficJams ? { avoidTrafficJams: true } : {}),
        },
      }),
    });
  } catch {
    throw new Error('You are offline.');
  }
  if (!res.ok) throw new Error(`Route request failed (${res.status}).`);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error('Route response was unreadable.');
  }
  if (typeof json !== 'object' || json === null) throw new Error('Route response was not successful.');
  const body = json as {
    primaryRoute?: { id?: unknown; summary?: Record<string, unknown>; instructions?: unknown[]; legs?: Array<{ instructions?: unknown[]; geometry?: { coordinates?: unknown } }>; geometry?: { coordinates?: unknown } };
    alternativeRoutes?: Array<{ id?: unknown; summary?: Record<string, unknown>; instructions?: unknown[]; legs?: Array<{ instructions?: unknown[]; geometry?: { coordinates?: unknown } }>; geometry?: { coordinates?: unknown } }>;
    trafficAnalysis?: Record<string, unknown>;
    recommendations?: Array<{ message?: unknown; timeSavings?: unknown }>;
  };
  const summary = body.primaryRoute?.summary;
  if (!summary) throw new Error('Route response was not successful.');
  const toSteps = (route: { instructions?: unknown[]; legs?: Array<{ instructions?: unknown[] }> }): RouteStep[] => {
    const direct = Array.isArray(route.instructions) ? (route.instructions as unknown[]) : null;
    const legSteps = (route.legs ?? []).flatMap((l) =>
      Array.isArray(l.instructions) ? (l.instructions as unknown[]) : []
    );
    return (direct ?? legSteps)
      .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
      .map((s) => ({
        text: str(s.instruction) ?? 'Continue',
        meters: num(s.distance) ?? 0,
        seconds: num(s.time) ?? 0,
      }));
  };
  const toMinutes = (s: Record<string, unknown>): number => Math.round((num(s.travelTimeInSeconds) ?? 0) / 60);
  const toKm = (s: Record<string, unknown>): number => Math.round(((num(s.lengthInMeters) ?? 0) / 1000) * 10) / 10;
  // Polyline source (web parity: InteractiveRouteMap flattens
  // legs[].geometry.coordinates; falls back to route.geometry).
  const toPath = (route: {
    legs?: Array<{ geometry?: { coordinates?: unknown } }>;
    geometry?: { coordinates?: unknown };
  }): Array<{ lat: number; lon: number }> => {
    const legPts = (route.legs ?? []).flatMap((l) =>
      Array.isArray(l.geometry?.coordinates) ? (l.geometry.coordinates as unknown[]) : []
    );
    const topPts =
      legPts.length === 0 && route.geometry && Array.isArray(route.geometry.coordinates)
        ? (route.geometry.coordinates as unknown[])
        : [];
    return (legPts.length > 0 ? legPts : topPts)
      .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
      .map((c) => ({
        lat: typeof c.lat === 'number' ? c.lat : NaN,
        lon:
          typeof c.lng === 'number' ? c.lng : typeof c.lon === 'number' ? (c.lon as number) : NaN,
      }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  };
  const seconds = num(summary.travelTimeInSeconds) ?? 0;
  const meters = num(summary.lengthInMeters) ?? 0;
  const delay = num(summary.trafficDelayInSeconds) ?? 0;
  const alternatives: RouteAlternative[] = Array.isArray(body.alternativeRoutes)
    ? body.alternativeRoutes
        .filter((a): a is NonNullable<typeof a> & { summary: Record<string, unknown> } =>
          typeof a === 'object' && a !== null && typeof a.summary === 'object' && a.summary !== null)
        .map((a) => ({
          id: typeof a.id === 'string' ? a.id : `${a.summary.lengthInMeters}-${a.summary.travelTimeInSeconds}`,
          minutes: toMinutes(a.summary),
          km: toKm(a.summary),
          delayMinutes: Math.round((num(a.summary.trafficDelayInSeconds) ?? 0) / 60),
          steps: toSteps(a),
          path: toPath(a),
        }))
    : [];
  // Traffic: web RouteTrafficAnalysis shape (BottomRouteSheet reads
  // overallTrafficLevel, congestionScore, estimatedDelay, segmentAnalysis).
  let traffic: RouteTraffic | null = null;
  const ta = body.trafficAnalysis;
  if (ta && typeof ta.overallTrafficLevel === 'string') {
    const level = ta.overallTrafficLevel as RouteTrafficLevel;
    if (TRAFFIC_LABELS[level]) {
      const segs = Array.isArray(ta.segmentAnalysis) ? (ta.segmentAnalysis as Array<{ incidents?: unknown[] }>) : [];
      traffic = {
        level,
        congestion: num(ta.congestionScore) ?? 0,
        delayMinutes: Math.round((num(ta.estimatedDelay) ?? 0) / 60),
        incidents: segs.reduce((n, s) => n + (Array.isArray(s.incidents) ? s.incidents.length : 0), 0),
      };
    }
  }
  // Recommendation: web sends {message, timeSavings} — NOT title/description
  // (the old reader here looked for title/description, so note was always null).
  const rec = Array.isArray(body.recommendations) ? body.recommendations[0] : undefined;
  const message = rec && typeof rec.message === 'string' ? rec.message : null;
  const savings = rec && typeof rec.timeSavings === 'number' && Number.isFinite(rec.timeSavings) ? rec.timeSavings : null;
  const recommendation = message ? { message, timeSavingsMinutes: savings } : null;
  return {
    minutes: Math.round(seconds / 60),
    km: Math.round((meters / 1000) * 10) / 10,
    delayMinutes: Math.round(delay / 60),
    arrival: str(summary.arrivalTime),
    steps: toSteps(body.primaryRoute ?? {}),
    alternativeCount: alternatives.length,
    note: recommendation ? recommendation.message : null,
    alternatives,
    traffic,
    recommendation,
    updatedAt: new Date().toISOString(),
    path: toPath((body.primaryRoute ?? {}) as Parameters<typeof toPath>[0]),
  };
}

/** Web parity: 5 traffic levels matching web TrafficLevel (route-optimization.ts:109) */
export type SpotTraffic = 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';

export type Spot = {
  name: string;
  image: string | null;
  lat: number | null;
  lon: number | null;
  peakHours: string | null;
  traffic?: SpotTraffic;
};

function isSpot(value: unknown): value is Spot {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === 'string' &&
    (v.image === null || typeof v.image === 'string' || typeof v.image === 'undefined') &&
    (v.lat === null || typeof v.lat === 'number' || typeof v.lat === 'undefined') &&
    (v.lon === null || typeof v.lon === 'number' || typeof v.lon === 'undefined') &&
    (v.peakHours === null || typeof v.peakHours === 'string' || typeof v.peakHours === 'undefined') &&
    (v.traffic === undefined || v.traffic === 'Low' || v.traffic === 'Moderate' || v.traffic === 'High')
  );
}

function normalizeSpot(value: Spot): Spot {
  return {
    name: value.name,
    image: value.image ?? null,
    lat: value.lat ?? null,
    lon: value.lon ?? null,
    peakHours: value.peakHours ?? null,
    ...(value.traffic ? { traffic: value.traffic } : {}),
  };
}

export async function fetchSpots(city: string): Promise<Spot[]> {
  const baseUrl = config.webBaseUrl.replace(/\/$/, '');
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/spots?city=${encodeURIComponent(city)}`);
  } catch {
    throw new Error('You are offline. Showing saved spots is not available yet — reconnect to refresh.');
  }
  if (!res.ok) throw new Error(`Spots request failed (${res.status}).`);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error('Spots response was unreadable.');
  }
  if (typeof json !== 'object' || json === null) throw new Error('Spots response was not successful.');
  const body = json as { success?: unknown; spots?: unknown; error?: unknown };
  if (body.success !== true || !Array.isArray(body.spots)) {
    throw new Error(typeof body.error === 'string' ? body.error : 'Spots response was not successful.');
  }
  return body.spots.filter(isSpot).map(normalizeSpot);
}

// ── Weather (remote enrichment, session-free) ─────────────

export type Weather = {
  temperature: number | null;
  condition: string | null;
  /** OpenWeather CDN icon (public, keyless). Null when unknown. */
  iconUrl: string | null;
};

/**
 * Shape-verified against the real contract: the route returns OpenWeather
 * native (`lib/core/utils.ts:10-39` WeatherData) — `main.temp`,
 * `weather[0].description/icon`. Anything else degrades to nulls, never
 * a crash or a guessed number.
 */
export async function fetchWeather(lat: number, lon: number): Promise<Weather> {
  const baseUrl = config.webBaseUrl.replace(/\/$/, '');
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/weather?lat=${lat}&lon=${lon}`);
  } catch {
    throw new Error('You are offline.');
  }
  if (!res.ok) throw new Error(`Weather request failed (${res.status}).`);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { temperature: null, condition: null, iconUrl: null };
  }
  if (typeof json !== 'object' || json === null) return { temperature: null, condition: null, iconUrl: null };
  const body = json as {
    main?: { temp?: unknown };
    weather?: Array<{ description?: unknown; icon?: unknown }>;
  };
  const temp = body.main && typeof body.main.temp === 'number' ? body.main.temp : null;
  const first = Array.isArray(body.weather) ? body.weather[0] : undefined;
  const description =
    first && typeof first.description === 'string' ? first.description : null;
  const icon = first && typeof first.icon === 'string' ? first.icon : null;
  return {
    temperature: temp,
    condition: description,
    iconUrl: icon ? `https://openweathermap.org/img/wn/${icon}@2x.png` : null,
  };
}

// ── Distance + Maps (web parity: dashboard/utils.ts:178-201) ──
// Formula and constant copied verbatim. Web measures from the CITY
// CENTER, not the user ("there is no user geolocation in the app" —
// utils.ts:128-130), so mobile needs no location permission either.

const AVG_CITY_KMH = 20;

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDistanceKm(km: number): string {
  return km < 10 ? `~${km.toFixed(1)}km` : `~${Math.round(km)}km`;
}

function estimateMinutes(km: number): string {
  return `~${Math.max(1, Math.round((km / AVG_CITY_KMH) * 60))} min`;
}

// ── Peak-derived traffic (web parity, vendored — see note) ───
// `trafficForSpot` + `isCurrentlyPeakHours` copied verbatim from
// `lib/traffic/peakHours.ts:38-120` and `dashboard/utils.ts:230-236`.
// Vendored, NOT imported: peakHours.ts's only import is `@/lib/...`, and
// the `@/` alias has no Metro mapping. Widening the remap for one pure
// date-math function would open the entire web tree to accidental
// Metro imports (any future `@/` pull of a web-only module breaks the
// build far from its cause). Pinned refs above; divergence check =
// `utils.test.ts` expectations (peak → High, off-peak → Low).

type PeakPeriod = { start: string; end: string };

function parsePeakPeriods(peakHoursStr: string): PeakPeriod[] {
  if (!peakHoursStr) return [];
  const periods: PeakPeriod[] = [];
  const timeRanges = peakHoursStr.split('/').map((range) => range.trim());
  for (const range of timeRanges) {
    if (
      range.toLowerCase().includes('saturday') ||
      range.toLowerCase().includes('sunday') ||
      range.toLowerCase().includes('weekday')
    ) {
      continue;
    }
    const timeMatch = range.match(/(\d{1,2}):?(\d{0,2})\s*(am|pm)\s*-\s*(\d{1,2}):?(\d{0,2})\s*(am|pm)/i);
    if (timeMatch) {
      const [, startHour, startMin = '00', startPeriod, endHour, endMin = '00', endPeriod] = timeMatch;
      periods.push({
        start: `${startHour}:${startMin.padStart(2, '0')} ${startPeriod.toUpperCase()}`,
        end: `${endHour}:${endMin.padStart(2, '0')} ${endPeriod.toUpperCase()}`,
      });
    }
  }
  return periods;
}

function convertTo24Hour(timeStr: string): number {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return -1;
  const [, hour, minute, period] = match;
  let hour24 = parseInt(hour);
  if (period.toUpperCase() === 'PM' && hour24 !== 12) {
    hour24 += 12;
  } else if (period.toUpperCase() === 'AM' && hour24 === 12) {
    hour24 = 0;
  }
  return hour24 * 100 + parseInt(minute);
}

function isCurrentlyPeakHours(peakHoursStr: string): boolean {
  const manilaTime = new Date(new Date().toLocaleString('en-US', { timeZone: getCityTimezone('baguio') }));
  const currentTime24 = manilaTime.getHours() * 100 + manilaTime.getMinutes();
  const periods = parsePeakPeriods(peakHoursStr);
  for (const period of periods) {
    const startTime = convertTo24Hour(period.start);
    const endTime = convertTo24Hour(period.end);
    if (startTime !== -1 && endTime !== -1) {
      if (startTime <= endTime) {
        if (currentTime24 >= startTime && currentTime24 <= endTime) return true;
      } else {
        if (currentTime24 >= startTime || currentTime24 <= endTime) return true;
      }
    }
  }
  return false;
}

/**
 * Per-place traffic from live peak state (web parity: trafficColors.ts:132-138).
 * Maps peak hours to 5 traffic levels: VERY_LOW, LOW, MODERATE, HIGH, SEVERE.
 * Peak hours → SEVERE during peak, HIGH during near-peak, MODERATE otherwise.
 */
export function trafficForSpot(peakHours: string | null | undefined): SpotTraffic | null {
  if (!peakHours) return null;
  // Peak hours (7-9am, 5-7pm Manila time) → SEVERE during peak, HIGH near peak, MODERATE otherwise
  const isPeak = isCurrentlyPeakHours(peakHours);
  if (isPeak) return 'SEVERE';
  // Near peak hours (within 1 hour of peak) → HIGH
  // For simplicity: if we have peak hours defined but not currently in peak, use MODERATE
  return 'MODERATE';
}

// ── Spot cards (web parity: SuggestedSpots.tsx:28-36 + toSpotCard) ──

export type SpotView = Spot & { distance: string; time: string };

/**
 * The exact web client shaping, same order: null-coord entries dropped
 * (toSpotCard returns null), distance/time from the city center,
 * traffic = measured flow ?? peak-derived (else hidden). Callers slice
 * the head (web takes 3); the rest stays available for "show all".
 */
export async function fetchSpotCards(cityId: string): Promise<SpotView[]> {
  const origin = getCityCenter(cityId);
  const spots = await fetchSpots(cityId);
  const cards: SpotView[] = [];
  for (const s of spots) {
    if (s.lat === null || s.lon === null || !Number.isFinite(s.lat) || !Number.isFinite(s.lon)) {
      continue;
    }
    const km = haversineKm(origin, { lat: s.lat, lon: s.lon });
    cards.push({
      ...s,
      distance: formatDistanceKm(km),
      time: estimateMinutes(km),
      ...(s.traffic || trafficForSpot(s.peakHours)
        ? { traffic: (s.traffic ?? trafficForSpot(s.peakHours)) as SpotTraffic }
        : {}),
    });
  }
  return cards;
}

/**
 * External Maps URL — same template as web `SpotlightCard.tsx:47-49`.
 * Native equivalent of BOTH web buttons: the iframe facade was a perf
 * workaround for web embeds (meaningless on native), so one system
 * "Open in Maps" action loses zero function. Null without coords.
 */
export function spotMapsUrl(lat: number | null, lon: number | null): string | null {
  if (lat == null || lon == null) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

// ── Web-asset URLs (progressive enhancement, never gating) ──

/**
 * Resolve a web `public/` path (e.g. "/images/goodsheperd.jpg") against the
 * configured web base. Mirrors the server `isRealPhoto` guard: placeholders
 * (`comingsoon`), map tiles, and non-image paths resolve to null so callers
 * hide the slot instead of rendering filler. Absolute http(s) URLs pass
 * through (spots photos, weather icons). Any failure → null, never throw:
 * images are enhancement, and offline means no images.
 */
export function resolveWebImage(path: string | null | undefined): string | null {
  if (!path || typeof path !== 'string') return null;
  if (/^https?:\/\//i.test(path)) {
    if (path.includes('api.tomtom.com/map') || path.includes('comingsoon')) return null;
    return path;
  }
  if (!path.startsWith('/images/')) return null;
  if (path.includes('comingsoon')) return null;
  return `${config.webBaseUrl.replace(/\/$/, '')}${path}`;
}
