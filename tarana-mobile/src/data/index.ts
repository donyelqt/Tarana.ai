import { config } from '../config';
import { exchangeForMobileToken, clearStoredToken, withMobileAuth } from '../auth';
import { createMobileSupabaseClient } from '../supabase';
import { getCityCenter, getCityTimezone } from 'tarana-web/data/cityConfig';
import * as Db from '../db';
import { parseStoredGoodFor } from '../db/goodFor';
import { generateWithLlama } from '../llm/generateWithLlama';
import { toWebMealType } from './mealTypeMapping';
import type { WebMealType } from './mealTypeMapping';
import type { LocalMeal, LocalProfile, LocalTrip } from '../db';

export type { LocalProfile, LocalTrip, LocalMeal } from '../db';
export type { LocalProfile as Profile, LocalTrip as Trip, LocalMeal as Meal } from '../db';

export { toWebMealType } from './mealTypeMapping';
export type { WebMealType, MobileMealTab } from './mealTypeMapping';


export const getActiveProfile = Db.getActiveProfile;
export const getActiveProfileId = Db.getActiveProfileId;
export const createProfile = Db.createProfile;
export const clearActiveProfile = Db.clearActiveProfile;

export async function signOut(): Promise<void> {
  await Db.clearActiveProfile();
  await clearStoredToken();
}


export const listTrips = Db.listTripsByProfile;
export const createTrip = Db.createTrip;
export const updateTrip = Db.updateTrip;
export const deleteTrip = Db.deleteTrip;
export const upsertImportedTrip = Db.upsertImportedTrip;


export const listMeals = Db.listMealsByProfile;
export const createMeal = Db.createMeal;
export const deleteMeal = Db.deleteMeal;
export const upsertImportedMeal = Db.upsertImportedMeal;


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

export async function importWebTrips(email: string): Promise<{ imported: number; profile: LocalProfile; userId: string }> {
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
  return { imported, profile, userId };
}


export type ExportSummary = {
  exported: number;
  skipped: number;
  failures: string[];
};

type SaveItineraryBody = {
  title: string;
  date: string;
  budget: string;
  tags: string[];
  formData: unknown;
  itineraryData: unknown;
  weatherData?: unknown;
};

const EXPORT_KEY_PREFIX = 'tarana-mobile-export';
const MAX_EXPORT_KEY_LENGTH = 256;

function exportIdempotencyKey(localTripId: string): string | null {
  const key = `${EXPORT_KEY_PREFIX}:${localTripId}`;
  return key.length <= MAX_EXPORT_KEY_LENGTH ? key : null;
}

function buildExportBody(trip: LocalTrip): SaveItineraryBody | null {
  let payload: unknown;
  try {
    payload = JSON.parse(trip.payload as string);
  } catch {
    return null;
  }

  const title = typeof trip.title === 'string' && trip.title.trim() ? trip.title.trim() : null;
  const date = typeof trip.date === 'string' && trip.date.trim() ? trip.date.trim() : null;
  const budget = typeof trip.budget === 'string' && trip.budget.trim() ? trip.budget.trim() : null;
  if (!title || !date || !budget) return null;

  if (typeof payload !== 'object' || payload === null) return null;
  if (!('formData' in payload) || !('itineraryData' in payload)) return null;

  const formData = payload.formData;
  const itineraryData = payload.itineraryData;
  const weatherData = 'weatherData' in payload ? payload.weatherData : undefined;
  if (typeof formData !== 'object' || formData === null || Array.isArray(formData)) return null;
  if (typeof itineraryData !== 'object' || itineraryData === null || Array.isArray(itineraryData)) return null;

  return {
    title,
    date,
    budget,
    tags: (trip.tags ?? []).filter((t): t is string => typeof t === 'string'),
    formData,
    itineraryData,
    weatherData: weatherData ?? undefined,
  };
}

function webErrorMessage(status: number, body: unknown): string {
  const error = body && typeof body === 'object' && 'error' in body ? body.error : undefined;
  if (typeof error === 'string' && error.trim()) return `HTTP ${status}: ${error}`;
  return `HTTP ${status}`;
}

function savedTripId(body: unknown): string | null {
  const data = body && typeof body === 'object' && 'data' in body ? body.data : undefined;
  const id = data && typeof data === 'object' && 'id' in data ? data.id : undefined;
  return typeof id === 'string' ? id : null;
}

export async function exportLocalTrips(profileId: string): Promise<ExportSummary> {
  const trips = await Db.listTripsByProfile(profileId);
  const candidates = trips.filter((t) => t.source === 'local' && t.payload !== null);

  if (candidates.length === 0) return { exported: 0, skipped: 0, failures: [] };

  const baseUrl = config.webBaseUrl.replace(/\/$/, '');
  const headers = await withMobileAuth({
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });

  const summary: ExportSummary = { exported: 0, skipped: 0, failures: [] };

  for (const trip of candidates) {
    const label = trip.title && trip.title.trim() ? trip.title.trim() : trip.id;
    const idempotencyKey = exportIdempotencyKey(trip.id);

    if (idempotencyKey === null) {
      summary.skipped += 1;
      summary.failures.push(`${label}: the local trip id is too long to use as an export key.`);
      continue;
    }

    const body = buildExportBody(trip);
    if (body === null) {
      summary.skipped += 1;
      summary.failures.push(`${label}: this trip is missing the details the web requires (title, date, budget, or itinerary).`);
      continue;
    }

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/saved-itineraries`, {
        method: 'POST',
        headers: { ...headers, 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(body),
      });
    } catch {
      summary.failures.push(`${label}: could not reach the web app.`);
      continue;
    }

    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      summary.failures.push(`${label}: the web reply was not valid JSON${res.ok ? '' : ` (HTTP ${res.status})`}.`);
      continue;
    }

    if (!res.ok) {
      summary.failures.push(`${label}: ${webErrorMessage(res.status, parsed)}`);
      continue;
    }

    const savedId = savedTripId(parsed);
    if (savedId === null) {
      summary.failures.push(`${label}: the web reply did not include the saved trip.`);
      continue;
    }

    await Db.linkExportedRow('trips', trip.id, savedId);

    summary.exported += 1;
  }

  return summary;
}

type WebMealRow = {
  id: string;
  cafe_name?: string | null;
  meal_type?: string | null;
  price?: number | string | null;
  good_for?: string | string[] | null;
  location?: string | null;
  menu_items?: unknown;
};

function mealPrice(value: WebMealRow["price"]): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function mealGoodFor(value: WebMealRow["good_for"]): string[] {
  if (Array.isArray(value)) return value.filter((t): t is string => typeof t === 'string');
  if (typeof value === 'string' && value.trim() !== '') return [value];
  return [];
}

export async function importWebMeals(_userId: string, profileId: string): Promise<{ imported: number }> {
  const baseUrl = config.webBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/api/saved-meals`, {
    method: 'GET',
    headers: await withMobileAuth({ Accept: 'application/json' }),
  });
  if (!res.ok) {
    throw new Error(`Web meals import failed (HTTP ${res.status})`);
  }
  const payload = (await res.json()) as { data?: WebMealRow[] };
  const rows = (Array.isArray(payload?.data) ? payload.data : []) as WebMealRow[];
  let imported = 0;
  for (const row of rows) {
    if (!row || typeof row.id !== 'string') continue;
    const cafeName = typeof row.cafe_name === 'string' ? row.cafe_name : '';
    if (!cafeName.trim()) continue;
    let items: string | null = null;
    try {
      items = JSON.stringify(row.menu_items ?? []);
    } catch {
      items = null;
    }
    await Db.upsertImportedMeal({
      profileId,
      sourceId: row.id,
      cafeName,
      mealType: typeof row.meal_type === 'string' ? row.meal_type : null,
      price: mealPrice(row.price),
      goodFor: mealGoodFor(row.good_for),
      location: typeof row.location === 'string' ? row.location : null,
      items,
    });
    imported += 1;
  }
  return { imported };
}


type SaveMealBody = {
  cafe_name: string;
  meal_type: WebMealType;
  price: number;
  good_for: string | null;
  location: string | null;
  menu_items: unknown[];
};

function buildMealExportBody(meal: LocalMeal): SaveMealBody | null {
  const cafeName = typeof meal.cafe_name === 'string' && meal.cafe_name.trim() ? meal.cafe_name.trim() : null;
  const rawType = typeof meal.meal_type === 'string' && meal.meal_type.trim() ? meal.meal_type.trim() : null;
  const mealType = rawType === null ? null : toWebMealType(rawType);
  if (!cafeName || !mealType) return null;
  if (cafeName.length > 200) return null;

  const price =
    typeof meal.price === 'number' && Number.isFinite(meal.price) && meal.price > 0 ? meal.price : null;
  if (price === null) return null;

  const goodForEntry = parseStoredGoodFor(meal.good_for).find((v) => typeof v === 'string' && v.trim());
  const goodFor = goodForEntry ? goodForEntry.trim() : null;
  if (goodFor !== null && goodFor.length > 20) return null;

  const location = typeof meal.location === 'string' && meal.location.trim() ? meal.location.trim() : null;
  if (location !== null && location.length > 200) return null;

  let menuItems: unknown;
  try {
    menuItems = JSON.parse(meal.items ?? '[]');
  } catch {
    return null;
  }
  if (!Array.isArray(menuItems)) return null;
  if (menuItems.length > 200) return null;

  return {
    cafe_name: cafeName,
    meal_type: mealType,
    price,
    good_for: goodFor,
    location,
    menu_items: menuItems,
  };
}

export async function exportLocalMeals(profileId: string): Promise<ExportSummary> {
  const meals = await Db.listMealsByProfile(profileId);
  const candidates = meals.filter((m) => m.source === 'local');

  if (candidates.length === 0) return { exported: 0, skipped: 0, failures: [] };

  const baseUrl = config.webBaseUrl.replace(/\/$/, '');
  const headers = await withMobileAuth({
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });

  const summary: ExportSummary = { exported: 0, skipped: 0, failures: [] };

  for (const meal of candidates) {
    const label = meal.cafe_name && meal.cafe_name.trim() ? meal.cafe_name.trim() : meal.id;
    const idempotencyKey = exportIdempotencyKey(meal.id);

    if (idempotencyKey === null) {
      summary.skipped += 1;
      summary.failures.push(`${label}: the local meal id is too long to use as an export key.`);
      continue;
    }

    const body = buildMealExportBody(meal);
    if (body === null) {
      summary.skipped += 1;
      summary.failures.push(`${label}: this meal is missing the details the web requires (cafe name, meal type, or a positive price).`);
      continue;
    }

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/saved-meals`, {
        method: 'POST',
        headers: { ...headers, 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(body),
      });
    } catch {
      summary.failures.push(`${label}: could not reach the web app.`);
      continue;
    }

    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      summary.failures.push(`${label}: the web reply was not valid JSON${res.ok ? '' : ` (HTTP ${res.status})`}.`);
      continue;
    }

    if (!res.ok) {
      summary.failures.push(`${label}: ${webErrorMessage(res.status, parsed)}`);
      continue;
    }

    const savedId = savedTripId(parsed);
    if (savedId === null) {
      summary.failures.push(`${label}: the web reply did not include the saved meal.`);
      continue;
    }

    await Db.linkExportedRow('meals', meal.id, savedId);

    summary.exported += 1;
  }

  return summary;
}


export type PlanInput = {
  city: string;
  budget: number | null;
  pax: number;
  days: number;
  startDate: string;
  endDate: string;
  interests: string[];
};

export async function generateItinerary(
  input: PlanInput,
  onProgress?: (message: string) => void
): Promise<LocalTrip> {
  const profileId = await Db.getActiveProfileId();
  if (!profileId) {
    throw new Error('Create a profile on this device before generating a trip.');
  }

  let generated;
  try {
    generated = await generateWithLlama(input, onProgress);
  } catch (e) {
    throw new Error(
      e instanceof Error
        ? `Could not build this itinerary: ${e.message}`
        : 'Could not build this itinerary on this device.'
    );
  }

  let payload: string;
  try {
    payload = JSON.stringify({
      formData: {
        budget: input.budget === null ? '' : String(input.budget),
        pax: String(input.pax),
        duration: `${input.days} ${input.days === 1 ? 'day' : 'days'}`,
        dates: { start: input.startDate, end: input.endDate },
        selectedInterests: input.interests,
      },
      itineraryData: {
        title: generated.title,
        subtitle: generated.subtitle,
        items: generated.items,
      },
    });
  } catch {
    throw new Error('The generated plan could not be saved on this device.');
  }

  return Db.createTrip({
    profileId,
    title: generated.title,
    date: input.startDate,
    budget: input.budget === null ? null : String(input.budget),
    tags: input.interests,
    payload,
  });
}


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

export type ExploreRouteType = 'fastest' | 'shortest' | 'eco' | 'thrilling';
export type ExploreVehicleType = 'car' | 'truck' | 'motorcycle' | 'bicycle' | 'walk';

export type ExplorePreferences = {
  routeType: ExploreRouteType;
  vehicleType: ExploreVehicleType;
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  avoidFerries?: boolean;
  avoidTrafficJams?: boolean;
};

export const DEFAULT_EXPLORE_PREFS: ExplorePreferences = {
  routeType: 'fastest',
  vehicleType: 'car',
  avoidTrafficJams: true,
};

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
  path: Array<{ lat: number; lon: number }>;
};

export type RouteTraffic = {
  level: RouteTrafficLevel;
  congestion: number;
  delayMinutes: number;
  incidents: number;
};

export const TRAFFIC_LABELS: Record<RouteTrafficLevel, string> = {
  VERY_LOW: 'Very low',
  LOW: 'Low',
  MODERATE: 'Moderate',
  HIGH: 'Heavy',
  SEVERE: 'Severe',
};

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
  alternativeCount: number;
  note: string | null;
  alternatives: RouteAlternative[];
  traffic: RouteTraffic | null;
  recommendation: { message: string; timeSavingsMinutes: number | null } | null;
  updatedAt: string;
  path: Array<{ lat: number; lon: number }>;
};

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

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


export type Weather = {
  temperature: number | null;
  condition: string | null;
  iconUrl: string | null;
};

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

export function trafficForSpot(peakHours: string | null | undefined): SpotTraffic | null {
  if (!peakHours) return null;
  const isPeak = isCurrentlyPeakHours(peakHours);
  if (isPeak) return 'SEVERE';
  return 'MODERATE';
}


export type SpotView = Spot & { distance: string; time: string };

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

export function spotMapsUrl(lat: number | null, lon: number | null): string | null {
  if (lat == null || lon == null) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}


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
