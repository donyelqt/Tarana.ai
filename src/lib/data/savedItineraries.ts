// Utility functions for managing saved itineraries
import type { StaticImageData } from "next/image";
import type { WeatherData } from "../core/utils";
import type { RefreshMetadata, TrafficSnapshot } from "../services/itineraryRefreshService";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mapRowToSavedItinerary as mapApiRow, resolveItineraryImage } from "./itineraryMapper";
import { getSafeErrorMetadata } from '@/lib/observability/safeErrorMetadata';

async function logServerError(message: string, error: unknown): Promise<void> {
  if (typeof window !== 'undefined') return;
  const { logger } = await import('@/lib/observability/logger');
  logger.error(message, { entryPoint: 'savedItineraries', ...getSafeErrorMetadata(error) });
}

export interface ItineraryActivity {
  image: string | StaticImageData;
  title: string;
  time: string;
  desc: string;
  tags: string[];
  // ✅ CRITICAL: Traffic metadata fields for smart refresh
  trafficAnalysis?: {
    realTimeTraffic?: {
      trafficLevel?: string;
      congestionScore?: number;
      recommendationScore?: number;
    };
    lat?: number;
    lon?: number;
  };
  trafficData?: unknown;
  trafficLevel?: string;
  trafficRecommendation?: string;
  lat?: number;
  lon?: number;
}

export interface ItineraryPeriod {
  period: string;
  activities: ItineraryActivity[];
}

export interface ItineraryData {
  title: string;
  subtitle: string;
  items: ItineraryPeriod[];
}

export interface SavedItinerary {
  id: string;
  title: string;
  date: string;
  budget: string;
  image: string | StaticImageData;
  tags: string[];
  formData: {
    budget: string;
    pax: string;
    duration: string;
    dates: { start: string; end: string };
    selectedInterests: string[];
  };
  itineraryData: ItineraryData;
  weatherData?: WeatherData; // Added optional weatherData property
  createdAt: string;
  // Enhanced refresh metadata
  refreshMetadata?: RefreshMetadata;
  trafficSnapshot?: TrafficSnapshot;
  activityCoordinates?: Array<{ lat: number; lon: number; name: string }>;
}

// Browser callers MUST go through /api/saved-itineraries: the app mints no
// Supabase JWT (NextAuth custom `users` table, so auth.uid() is always NULL)
// and the route authorizes via the session cookie with the admin client.
async function requestItinerariesApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(readApiErrorDetail(body, response.status));
  }
  if (body && typeof body === "object" && "data" in body) {
    const data: unknown = body.data;
    return data as T;
  }
  if (body && typeof body === "object" && "success" in body && body.success === true) {
    return undefined as T;
  }
  throw new Error(`Request failed with status ${response.status}`);
}
function readApiErrorDetail(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    if ("details" in body && typeof body.details === "string") {
      return body.details;
    }
    if ("error" in body && typeof body.error === "string") {
      return body.error;
    }
  }
  return `Request failed with status ${status}`;
}

async function getCurrentUserId(): Promise<string | null> {
  try {
    if (typeof window === 'undefined') {
      // Exception: the auth entry point is genuinely runtime-selected —
      // server uses next-auth + authOptions, browser uses next-auth/react.
      const { getServerSession } = await import('next-auth');
      const { authOptions } = await import('../auth/auth');

      const session = await getServerSession(authOptions);
      return session?.user?.id ?? null;
    }

    const { getSession } = await import('next-auth/react');
    const session = await getSession();
    return session?.user?.id ?? null;
  } catch (error) {
    await logServerError('Failed to resolve current user session', error);
    return null;
  }
}

async function getServerAdminClient(): Promise<SupabaseClient> {
  // Exception: supabaseAdmin throws on client-side import by design, so it
  // can only be loaded inside the server branch at runtime.
  const { supabaseAdmin } = await import('./supabaseAdmin');
  return supabaseAdmin;
}

function toSavedItinerary(row: Record<string, unknown>): SavedItinerary {
  // Boundary cast: columns are controlled by our own table + API mapper.
  return mapApiRow(row) as SavedItinerary;
}

export const getSavedItineraries = async (): Promise<SavedItinerary[]> => {
  if (typeof window === 'undefined') {
    const userId = await getCurrentUserId();
    if (!userId) {
      return [];
    }
    try {
      const { data, error } = await (await getServerAdminClient())
        .from('itineraries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) {
        await logServerError('Error loading saved itineraries from Supabase', error);
        return [];
      }
      return ((data ?? []) as Record<string, unknown>[]).map(toSavedItinerary);
    } catch (error) {
      await logServerError('Error loading saved itineraries', error);
      return [];
    }
  }
  try {
    return await requestItinerariesApi<SavedItinerary[]>('/api/saved-itineraries');
  } catch {
    return [];
  }
};

export const saveItinerary = async (itinerary: Omit<SavedItinerary, 'id' | 'createdAt'>): Promise<SavedItinerary> => {
  if (typeof window === 'undefined') {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('User must be logged in to save an itinerary');
    }
    const { data, error } = await (await getServerAdminClient())
      .from('itineraries')
      .insert({
        user_id: userId,
        title: itinerary.title,
        date: itinerary.date,
        budget: itinerary.budget,
        image: resolveItineraryImage(typeof itinerary.image === 'string' ? itinerary.image : itinerary.image.src, itinerary.tags),
        tags: itinerary.tags,
        form_data: itinerary.formData,
        itinerary_data: itinerary.itineraryData,
        weather_data: itinerary.weatherData,
      })
      .select()
      .single();
    if (error || !data) {
      await logServerError('Error saving itinerary to Supabase', error);
      throw new Error('Failed to save itinerary. Details: Unknown error');
    }
    return toSavedItinerary(data as Record<string, unknown>);
  }
  try {
    const imageSrc = typeof itinerary.image === 'string' ? itinerary.image : itinerary.image.src;
    return await requestItinerariesApi<SavedItinerary>('/api/saved-itineraries', {
      method: 'POST',
      body: JSON.stringify({
        title: itinerary.title,
        date: itinerary.date,
        budget: itinerary.budget,
        image: imageSrc,
        tags: itinerary.tags,
        formData: itinerary.formData,
        itineraryData: itinerary.itineraryData,
        weatherData: itinerary.weatherData,
      }),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to save itinerary. Details: ${message}`);
  }
};

export const deleteItinerary = async (id: string): Promise<void> => {
  if (typeof window === 'undefined') {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('User must be logged in to delete an itinerary');
    }
    try {
      const { error } = await (await getServerAdminClient())
        .from('itineraries')
        .delete()
        .eq('id', id)
        .eq('user_id', userId); // Ensure user can only delete their own itineraries
      if (error) {
        await logServerError('Error deleting itinerary from Supabase', error);
        throw new Error('Failed to delete itinerary');
      }
    } catch (error) {
      await logServerError('Error deleting itinerary', error);
      throw new Error('Failed to delete itinerary');
    }
    return;
  }
  try {
    await requestItinerariesApi<{ id: string }>(`/api/saved-itineraries/${id}`, {
      method: 'DELETE',
    });
  } catch {
    throw new Error('Failed to delete itinerary');
  }
};

// Single builder for partial updates; the [id] API takes these camelCase
// keys while the direct server path translates them to snake_case below.
function buildUpdatePayload(
  updatedData: Partial<Omit<SavedItinerary, 'id' | 'createdAt' | 'userId'>>
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (updatedData.title) payload.title = updatedData.title;
  if (updatedData.date) payload.date = updatedData.date;
  if (updatedData.budget) payload.budget = updatedData.budget;
  if (updatedData.image) {
    payload.image = typeof updatedData.image === 'string' ? updatedData.image : updatedData.image.src;
  }
  if (updatedData.tags) payload.tags = updatedData.tags;
  if (updatedData.formData) payload.formData = updatedData.formData;
  if (updatedData.itineraryData) payload.itineraryData = updatedData.itineraryData;
  if (updatedData.weatherData) payload.weatherData = updatedData.weatherData;
  // Explicit undefined checks: null/empty values must reach the database.
  if (updatedData.refreshMetadata !== undefined) payload.refreshMetadata = updatedData.refreshMetadata;
  if (updatedData.trafficSnapshot !== undefined) payload.trafficSnapshot = updatedData.trafficSnapshot;
  if (updatedData.activityCoordinates !== undefined) payload.activityCoordinates = updatedData.activityCoordinates;
  // Do not allow updating user_id or created_at directly
  return payload;
}

const UPDATE_DB_KEY_MAP: Record<string, string> = {
  formData: 'form_data',
  itineraryData: 'itinerary_data',
  weatherData: 'weather_data',
  refreshMetadata: 'refresh_metadata',
  trafficSnapshot: 'traffic_snapshot',
  activityCoordinates: 'activity_coordinates',
};

function toDbUpdatePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const dbPayload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    dbPayload[UPDATE_DB_KEY_MAP[key] ?? key] = value;
  }
  return dbPayload;
}

export const updateItinerary = async (id: string, updatedData: Partial<Omit<SavedItinerary, 'id' | 'createdAt' | 'userId'>>): Promise<SavedItinerary | null> => {
  const payload = buildUpdatePayload(updatedData);

  if (typeof window === 'undefined') {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('User must be logged in to update an itinerary');
    }
    const admin = await getServerAdminClient();
    if (Object.keys(payload).length === 0) {
      // Optionally, fetch and return the existing itinerary
      const { data, error } = await admin
        .from('itineraries')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();
      if (error || !data) return null;
      return toSavedItinerary(data as Record<string, unknown>);
    }
    const { data, error } = await admin
      .from('itineraries')
      .update(toDbUpdatePayload(payload))
      .eq('id', id)
      .eq('user_id', userId) // Ensure user can only update their own itineraries
      .select()
      .single();
    if (error || !data) return null;
    return toSavedItinerary(data as Record<string, unknown>);
  }

  try {
    if (Object.keys(payload).length === 0) {
      try {
        return await requestItinerariesApi<SavedItinerary>(`/api/saved-itineraries/${id}`);
      } catch {
        return null;
      }
    }
    return await requestItinerariesApi<SavedItinerary>(`/api/saved-itineraries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    // Preserve the null-on-missing contract the refresh flow relies on.
    if (message.toLowerCase().includes('not found')) return null;
    throw new Error('Failed to update itinerary');
  }
};

export const formatDateRange = (startDate: string, endDate: string): string => {
  if (!startDate || !endDate) return 'Date not specified';

  const start = new Date(startDate);
  const end = new Date(endDate);

  const options: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  };

  if (start.toDateString() === end.toDateString()) {
    return start.toLocaleDateString('en-US', options);
  }

  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
};
