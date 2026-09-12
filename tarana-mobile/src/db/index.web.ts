/**
 * Web stub for the local store (`index.ts` is the native implementation).
 *
 * Metro platform resolution picks this file for `-p web` bundles, so the
 * expo-sqlite wasm graph (`wa-sqlite.wasm`, web-alpha, needs bundler +
 * COEP/COOP plumbing per the SDK 57 docs) never enters the web bundle.
 * The app ships native (iOS/Android); web is a bundling smoke gate only.
 *
 * Same exported API, in-memory backing. Active-profile id reuses the
 * platform-aware TokenStorage (localStorage on web) so that half behaves
 * identically. Data does not survive reload — acceptable for smoke.
 */
import * as TokenStorage from '../tokenStorage';
import type { LocalProfile, LocalTrip, LocalMeal } from './index';

const ACTIVE_PROFILE_KEY = 'tarana.activeProfileId';

const profiles = new Map<string, LocalProfile>();
const trips = new Map<string, LocalTrip>();
const meals = new Map<string, LocalMeal>();

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffff).toString(36)}`;
}

const MAX_DISPLAY_NAME = 60;

export async function getDb(): Promise<null> {
  return null;
}

export async function createProfile(displayName: string): Promise<LocalProfile> {
  const name = displayName.trim().replace(/\s+/g, ' ');
  if (!name) throw new Error('Please enter a display name.');
  if (name.length > MAX_DISPLAY_NAME) {
    throw new Error(`Display name must be ${MAX_DISPLAY_NAME} characters or fewer.`);
  }
  const profile: LocalProfile = {
    id: newId('p'),
    display_name: name,
    created_at: new Date().toISOString(),
  };
  profiles.set(profile.id, profile);
  await TokenStorage.setItemAsync(ACTIVE_PROFILE_KEY, profile.id);
  return profile;
}

export async function getActiveProfileId(): Promise<string | null> {
  return TokenStorage.getItemAsync(ACTIVE_PROFILE_KEY);
}

export async function getActiveProfile(): Promise<LocalProfile | null> {
  const id = await getActiveProfileId();
  if (!id) return null;
  return profiles.get(id) ?? null;
}

export async function clearActiveProfile(): Promise<void> {
  await TokenStorage.deleteItemAsync(ACTIVE_PROFILE_KEY);
}

export async function createTrip(input: {
  profileId: string;
  title?: string | null;
  date?: string | null;
  budget?: string | null;
  tags?: string[];
  payload?: string | null;
}): Promise<LocalTrip> {
  const trip: LocalTrip = {
    id: newId('t'),
    profile_id: input.profileId,
    title: input.title ?? null,
    date: input.date ?? null,
    budget: input.budget ?? null,
    tags: input.tags ?? [],
    payload: input.payload ?? null,
    source: 'local',
    source_id: null,
    imported_at: null,
    created_at: new Date().toISOString(),
  };
  trips.set(trip.id, trip);
  return trip;
}

export async function listTripsByProfile(profileId: string): Promise<LocalTrip[]> {
  return [...trips.values()]
    .filter((t) => t.profile_id === profileId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function upsertImportedTrip(input: {
  profileId: string;
  sourceId: string;
  title?: string | null;
  date?: string | null;
  budget?: string | null;
  tags?: string[];
  payload?: string | null;
}): Promise<LocalTrip> {
  if (!input.sourceId) throw new Error('Import requires a source id.');
  const existing = [...trips.values()].find(
    (t) => t.source === 'web-import' && t.source_id === input.sourceId
  );
  const now = new Date().toISOString();
  if (existing) {
    existing.title = input.title ?? null;
    existing.date = input.date ?? null;
    existing.budget = input.budget ?? null;
    existing.tags = input.tags ?? [];
    existing.payload = input.payload ?? null;
    existing.imported_at = now;
    return existing;
  }
  const trip: LocalTrip = {
    id: newId('t'),
    profile_id: input.profileId,
    title: input.title ?? null,
    date: input.date ?? null,
    budget: input.budget ?? null,
    tags: input.tags ?? [],
    payload: input.payload ?? null,
    source: 'web-import',
    source_id: input.sourceId,
    imported_at: now,
    created_at: now,
  };
  trips.set(trip.id, trip);
  return trip;
}

export async function deleteTrip(id: string, profileId: string): Promise<void> {
  const trip = trips.get(id);
  if (trip && trip.profile_id === profileId) trips.delete(id);
}

export async function createMeal(input: {
  profileId: string;
  cafeName: string;
  mealType?: string | null;
  price?: number | null;
  goodFor?: string[];
  location?: string | null;
  items?: string | null;
}): Promise<LocalMeal> {
  const name = input.cafeName.trim();
  if (!name) throw new Error('Meal needs a cafe name.');
  const meal: LocalMeal = {
    id: newId('m'),
    profile_id: input.profileId,
    cafe_name: name,
    meal_type: input.mealType ?? null,
    price: input.price ?? null,
    good_for: input.goodFor ?? [],
    location: input.location ?? null,
    items: input.items ?? null,
    source: 'local',
    source_id: null,
    imported_at: null,
    created_at: new Date().toISOString(),
  };
  meals.set(meal.id, meal);
  return meal;
}

export async function listMealsByProfile(profileId: string): Promise<LocalMeal[]> {
  return [...meals.values()]
    .filter((m) => m.profile_id === profileId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function deleteMeal(id: string, profileId: string): Promise<void> {
  const meal = meals.get(id);
  if (meal && meal.profile_id === profileId) meals.delete(id);
}
