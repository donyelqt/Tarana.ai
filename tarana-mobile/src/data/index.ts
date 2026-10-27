/**
 * Backend-agnostic data seam (§2.1, §8).
 *
 * Contract-first (api-and-interface-design): screens consume THESE
 * functions and never `../db`, `../supabase`, or raw `fetch` to web APIs.
 * Swapping a domain from local to HTTP later means changing one function
 * body here — no screen rewrites.
 *
 * Current bindings:
 * - profiles, trips, meals → local SQLite (`../db`). No network, no login.
 * - trips + meals (sync) → the linked web account over HTTP. The mobile
 *   Bearer token is the credential: the middleware validates it and injects
 *   the session identity, so the token-bearing routes (`/api/saved-*`)
 *   accept a mobile request unchanged. Import pulls web → SQLite; export
 *   pushes local-only rows web-ward. NO operation deletes on either side.
 * - spots, weather → web enrichment proxy over HTTP. Verified session-free
 *   (`GET /api/spots`, `GET /api/weather` carry no auth check), so these
 *   deliberately send NO token. Offline → thrown Error → caller renders
 *   its cached/empty state (never a login wall).
 *
 * Boundary rule: every HTTP response is untrusted input — shape-validated
 * before use. Every write binds `?` parameters (see ../db).
 */
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

// The mobile-tab → web-union mapping lives in its own module so both the
// save site (a screen) and `buildMealExportBody` below share one definition,
// and so the mapping can be unit-tested without the seam's native imports.
// Re-exported here because screens consume the seam, never a data sibling.
export { toWebMealType } from './mealTypeMapping';
export type { WebMealType, MobileMealTab } from './mealTypeMapping';

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
export const upsertImportedMeal = Db.upsertImportedMeal;

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

// ── Web export (two-way copy: local → web) ─────────────────

export type ExportSummary = {
  exported: number;
  skipped: number;
  failures: string[];
};

/** The subset of `SaveItinerarySchema` the mobile client is responsible for. */
type SaveItineraryBody = {
  title: string;
  date: string;
  budget: string;
  tags: string[];
  formData: unknown;
  itineraryData: unknown;
  weatherData?: unknown;
};

/**
 * The idempotency key: derived from the local trip id so a retry always
 * carries the SAME key for the same trip. The web route scopes keys per
 * user+route, so a namespaced key can never collide with — or replay
 * against — an unrelated browser save.
 */
const EXPORT_KEY_PREFIX = 'tarana-mobile-export';
const MAX_EXPORT_KEY_LENGTH = 256;

function exportIdempotencyKey(localTripId: string): string | null {
  const key = `${EXPORT_KEY_PREFIX}:${localTripId}`;
  return key.length <= MAX_EXPORT_KEY_LENGTH ? key : null;
}

/**
 * Local-shape validation, mirroring the fields `SaveItinerarySchema`
 * requires. A trip that cannot satisfy the web contract is skipped with a
 * reason rather than POSTed and 400'd — the write is never attempted when
 * the failure is already knowable on device.
 */
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

  // Payload contract (`itinerarySchema.ts:65-69`): `formData` and
  // `itineraryData` are objects-or-null, `weatherData` is opaque. Checked
  // property by property rather than with a generic "is an object" guard,
  // which would pass a `{ formData: "boom" }` payload straight into the POST.
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

/** Server-supplied error text is the only useful diagnostic for a 4xx/5xx. */
function webErrorMessage(status: number, body: unknown): string {
  const error = body && typeof body === 'object' && 'error' in body ? body.error : undefined;
  if (typeof error === 'string' && error.trim()) return `HTTP ${status}: ${error}`;
  return `HTTP ${status}`;
}

/** Named boundary type for the part of `SavedItineraryDto` this function reads. */
function savedTripId(body: unknown): string | null {
  const data = body && typeof body === 'object' && 'data' in body ? body.data : undefined;
  const id = data && typeof data === 'object' && 'id' in data ? data.id : undefined;
  return typeof id === 'string' ? id : null;
}

/**
 * Two-way sync's export direction (§7.4 mirror): local-only trips are
 * POSTed to the web app so a linked account sees them on every device.
 *
 * Conflict rule — web is the source of truth for identity, SQLite for
 * local-only trips:
 * - Export NEVER deletes on either side. Nothing here removes a local row
 *   or a web row, so a partial run can only leave work undone, never data
 *   destroyed, and re-running the same export is always safe.
 * - Idempotency converges on the LOCAL TRIP ID (see `exportIdempotencyKey`).
 *   The web route claims `Idempotency-Key` before its insert and replays
 *   the cached response for an already-completed key, so a retry after a
 *   partial failure returns the SAME web id instead of inserting a second
 *   row. This is the export-side mirror of `upsertImportedTrip`'s
 *   `(source, source_id)` dedupe on the import side.
 * - A trip whose payload cannot produce a valid `SaveItinerarySchema` body
 *   is skipped with a reason, never POSTed.
 *
 * Per-trip isolation: one failure is recorded and the loop continues, so a
 * single malformed trip can neither abort the batch nor lose the report of
 * the trips that did land. Only a missing token or an unusable profile
 * (i.e. "this export cannot run at all") throws, because those cannot be
 * attributed to any trip.
 */
export async function exportLocalTrips(profileId: string): Promise<ExportSummary> {
  const trips = await Db.listTripsByProfile(profileId);
  const candidates = trips.filter((t) => t.source === 'local' && t.payload !== null);

  // Nothing to send beats an early token prompt: the exchange is a browser
  // round-trip the user has to authorise.
  if (candidates.length === 0) return { exported: 0, skipped: 0, failures: [] };

  const baseUrl = config.webBaseUrl.replace(/\/$/, '');
  // Resolved once, up front: a missing/invalid token is a whole-export
  // failure, not a per-trip one, so it must not be retried per row.
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
      // A payload the web schema rejects would 400 on POST; catching it here
      // keeps the reason on the device and skips the round-trip.
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
      // Transport failure. The web claim (if any) expires on its own TTL, and
      // the local id stays the key, so the next attempt converges.
      summary.failures.push(`${label}: could not reach the web app.`);
      continue;
    }

    // Every response body is untrusted: parse defensively and validate shape
    // before use (same boundary rule as every other call in this file).
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
      // The write may well have landed; without a returned id we cannot claim
      // success, and the idempotency key makes re-export safe.
      summary.failures.push(`${label}: the web reply did not include the saved trip.`);
      continue;
    }

    // 201 created, or any non-replay 2xx that still carries an id.
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

/**
 * One-way web meals import (§7.4 twin of importWebTrips): same exchange,
 * same profile, same (source, source_id) idempotency — `saved_meals` rows
 * land in SQLite via upsertImportedMeal.
 *
 * RLS remediation 2026-09-19: this no longer reads saved_meals directly with
 * the anon key (prod had permissive USING(true) policies — any client could
 * read/write all users' rows; strict auth.uid()=user_id policies are being
 * re-applied, and an anon read would then return zero rows). Identity comes
 * from the server-exchanged mobile token: the request hits
 * GET /api/saved-meals with `Authorization: Bearer <mobile-token>`, the
 * middleware validates the token and injects the session identity, and the
 * route queries with the service-role admin client scoped to the session —
 * the same pattern as the web app and importWebTrips.
 */
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

// ── Meals export (two-way copy: local → web) ──────────────

/** The subset of `SavedMealSchema` the mobile client is responsible for. */
type SaveMealBody = {
  cafe_name: string;
  meal_type: WebMealType;
  price: number;
  good_for: string | null;
  location: string | null;
  menu_items: unknown[];
};

/**
 * Local-shape validation, mirroring the fields `SavedMealSchema` requires.
 * A meal that cannot satisfy the web contract is skipped with a reason
 * rather than POSTed and 400'd, because the failure is already knowable on
 * device.
 *
 * The shape conversion the trips seam never needs: web `good_for` is ONE
 * nullable string while local `good_for` is a string array. The first
 * non-empty entry is the exact inverse of `mealGoodFor`, which maps the web
 * string to a one-element array on import, so a round-trip yields the value
 * that was saved. Joining the array instead would concatenate unrelated
 * labels and routinely blow the 20-character cap.
 *
 * `meal_type` is likewise mapped here, not passed through: the local column
 * is free text written historically as the raw mobile tab label, so rows
 * saved before the save site started normalizing it carry 'Snacks'/'Drinks'
 * — values the web row type accepts but the web filter can never match
 * (see `./mealTypeMapping`). Mapping on export repairs those rows on their
 * next sync without a migration, and keeps the export body in the web union
 * the same way a fresh save already is.
 */
function buildMealExportBody(meal: LocalMeal): SaveMealBody | null {
  const cafeName = typeof meal.cafe_name === 'string' && meal.cafe_name.trim() ? meal.cafe_name.trim() : null;
  const rawType = typeof meal.meal_type === 'string' && meal.meal_type.trim() ? meal.meal_type.trim() : null;
  // 'Snacks' → 'Snack', 'Drinks' → 'Snack'. A value already in the web union
  // passes through unchanged, so a web-imported row round-trips instead of
  // being dropped here. An unmappable type is null, which the `!mealType`
  // guard below skips — no invented bucket for a row that does not come from
  // a known tab.
  const mealType = rawType === null ? null : toWebMealType(rawType);
  if (!cafeName || !mealType) return null;
  if (cafeName.length > 200) return null;

  const price =
    typeof meal.price === 'number' && Number.isFinite(meal.price) && meal.price > 0 ? meal.price : null;
  if (price === null) return null;

  // `meal.good_for` is stored as a JSON STRING in the `meals` TEXT column
  // (what `createMeal`/`upsertImportedMeal` write), so `[]` is not its empty
  // form — the string form is. Parsing it here is the same inverse `toMeal`
  // applies on the read path, so the export body and the on-device list agree
  // on what a row's labels are instead of one path crashing on the other's
  // shape. A malformed or blank value is `[]`, never a throw: the export is a
  // batch over every local meal, and one bad column must not abort the rest.
  const goodForEntry = parseStoredGoodFor(meal.good_for).find((v) => typeof v === 'string' && v.trim());
  const goodFor = goodForEntry ? goodForEntry.trim() : null;
  // The cap is 20 characters. A first entry over it would 400, so the row is
  // skipped here rather than sent.
  if (goodFor !== null && goodFor.length > 20) return null;

  const location = typeof meal.location === 'string' && meal.location.trim() ? meal.location.trim() : null;
  if (location !== null && location.length > 200) return null;

  // Local `items` is a JSON string of dish objects, written by createMeal.
  // Null means the row never captured a dish, which the schema allows.
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

/**
 * Two-way sync's export direction (§7.4 mirror): local-only saved meals are
 * POSTed to the web app so a linked account sees them on every device.
 *
 * Conflict rule, identical to `exportLocalTrips`:
 * - Export NEVER deletes on either side. Nothing here removes a local row
 *   or a web row, so a partial run can only leave work undone, never data
 *   destroyed, and re-running the same export is always safe.
 * - Idempotency converges on the LOCAL MEAL ID (see `exportIdempotencyKey`).
 *   The route claims `Idempotency-Key` scoped to (user, route, key) before
 *   its insert and replays the cached response for an already-completed
 *   key, so a retry after a partial failure returns the SAME web id instead
 *   of inserting a second row. This is the export-side mirror of
 *   `upsertImportedMeal`'s (source, source_id) dedupe on the import side.
 * - The exported row is NOT rewritten as `source: 'web-import'`. Marking it
 *   would hide it from the candidate set of a later export, and the
 *   idempotency key already makes a repeat POST converge, so no local write
 *   is needed and none is made.
 * - A meal that cannot produce a valid `SavedMealSchema` body is skipped
 *   with a reason, never POSTed.
 *
 * Per-meal isolation: one failure is recorded and the loop continues. Only a
 * missing token or an unusable profile (i.e. "this export cannot run at
 * all") throws, because those cannot be attributed to any meal.
 */
export async function exportLocalMeals(profileId: string): Promise<ExportSummary> {
  const meals = await Db.listMealsByProfile(profileId);
  // A web-import row is already on the web; re-pushing it would fight the
  // import-side dedupe.
  const candidates = meals.filter((m) => m.source === 'local');

  // Nothing to send beats an early token prompt: the exchange is a browser
  // round-trip the user has to authorise.
  if (candidates.length === 0) return { exported: 0, skipped: 0, failures: [] };

  const baseUrl = config.webBaseUrl.replace(/\/$/, '');
  // Resolved once, up front: a missing/invalid token is a whole-export
  // failure, not a per-meal one, so it must not be retried per row.
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
      // A payload the web schema rejects would 400 on POST; catching it here
      // keeps the reason on the device and skips the round-trip.
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
      // Transport failure. The web claim (if any) expires on its own TTL, and
      // the local id stays the key, so the next attempt converges.
      summary.failures.push(`${label}: could not reach the web app.`);
      continue;
    }

    // Every response body is untrusted: parse defensively and validate shape
    // before use (same boundary rule as every other call in this file).
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

    // The route replies 200 with `{ success: true, data }` where `data` is
    // the raw row, and an idempotent replay returns that same body. So the
    // saved id is read off the payload rather than the status code, and
    // 200 and 201 are both success here.
    const savedId = savedTripId(parsed);
    if (savedId === null) {
      // The write may well have landed; without a returned id we cannot claim
      // success, and the idempotency key makes re-export safe.
      summary.failures.push(`${label}: the web reply did not include the saved meal.`);
      continue;
    }

    // 200 created, or any non-replay 2xx that still carries an id.
    summary.exported += 1;
  }

  return summary;
}

// ── Plan generation (Phase-2 gate — honest stub, not a mock) ─────────────────

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
 * The generator is the local llama.rn pipeline (`../llm/generateWithLlama`):
 * no cloud, no login, no 401/402 wall — a paid offline app cannot fall back
 * to a hosted call. Whatever the model returns is validated by the shared
 * Zod schema before it is persisted, and the write goes through `Db.createTrip`
 * with this file's payload shape (`{ formData, itineraryData }`) so the row
 * renders exactly like a web import.
 *
 * The throw contract is the caller's, not ours: Plan.tsx paints `e.message`
 * onto its pending card, so every failure path — missing model, empty engine,
 * validation — surfaces as a human-readable reason instead of a dead button.
 *
 * `onProgress` forwards the generator's per-slot message. One day at a time
 * on a phone runs tens of seconds; without it the CTA looks frozen, so the
 * screen is only honest if it can show the reason for the wait.
 */
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
