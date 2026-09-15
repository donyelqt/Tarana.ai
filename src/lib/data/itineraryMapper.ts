import { z } from 'zod';
import { normalizeImagePath, getFallbackImage } from '@/lib/images/imageUtils';

/**
 * Single mapping from `itineraries` rows (snake_case, legacy JSON-text
 * tolerant) to the camelCase shape the saved-trips UI destructures.
 * Lives in lib so both API routes and the browser data layer share it —
 * list vs. detail can never drift, and lib never imports upward from app/.
 */
export function resolveItineraryImage(rawImage: unknown, tags: string[]): string {
  if (typeof rawImage !== "string" || rawImage.trim() === "") {
    return getFallbackImage(tags);
  }
  return normalizeImagePath(rawImage);
}

export interface ItineraryDbRow {
  id: string;
  title: string;
  date: string;
  budget: string;
  image: string | null;
  tags: string[];
  form_data: { budget: string; pax: string; duration: string; dates: { start: string; end: string }; selectedInterests: string[] };
  itinerary_data: { title: string; subtitle: string; items: Array<{ period: string; activities: unknown[] }> };
  weather_data: { name: string } | null;
  created_at: string;
  refresh_metadata: { refreshCount: number } | null;
  traffic_snapshot: { incidentCount: number } | null;
  activity_coordinates: Array<{ lat: number; lon: number; name: string }> | null;
}

export interface SavedItineraryDto {
  id: string;
  title: string;
  date: string;
  budget: string;
  image: string;
  tags: string[];
  formData: ItineraryDbRow["form_data"];
  itineraryData: ItineraryDbRow["itinerary_data"];
  weatherData?: ItineraryDbRow["weather_data"] | undefined;
  createdAt: string;
  refreshMetadata?: ItineraryDbRow["refresh_metadata"] | undefined;
  trafficSnapshot?: ItineraryDbRow["traffic_snapshot"] | undefined;
  activityCoordinates?: ItineraryDbRow["activity_coordinates"] | undefined;
}

type LegacyJsonRow = ItineraryDbRow & {
  form_data: ItineraryDbRow["form_data"] | string;
  itinerary_data: ItineraryDbRow["itinerary_data"] | string;
  weather_data: ItineraryDbRow["weather_data"] | string | undefined;
};

export function mapRowToSavedItinerary(row: LegacyJsonRow | Record<string, unknown>): SavedItineraryDto {
  const record = row as Record<string, unknown>;
  const formData =
    typeof record.form_data === 'string' ? JSON.parse(record.form_data) : record.form_data;
  const itineraryData =
    typeof record.itinerary_data === 'string'
      ? JSON.parse(record.itinerary_data)
      : record.itinerary_data;
  const weatherDataRaw = record.weather_data as ItineraryDbRow["weather_data"] | string | undefined;
  const weatherData =
    typeof weatherDataRaw === 'string' && weatherDataRaw
      ? JSON.parse(weatherDataRaw)
      : (weatherDataRaw ?? undefined);
  const rawTags: unknown = record.tags;
  const tags: string[] = Array.isArray(rawTags)
    ? rawTags.filter((tag): tag is string => typeof tag === "string")
    : [];
  return {
    id: record.id as string,
    title: record.title as string,
    date: record.date as string,
    budget: record.budget as string,
    image: resolveItineraryImage(record.image, tags),
    tags,
    formData: formData as ItineraryDbRow["form_data"],
    itineraryData: itineraryData as ItineraryDbRow["itinerary_data"],
    weatherData: weatherData as ItineraryDbRow["weather_data"] | undefined,
    createdAt: record.created_at as string,
    refreshMetadata: (record.refresh_metadata as ItineraryDbRow["refresh_metadata"]) ?? undefined,
    trafficSnapshot: (record.traffic_snapshot as ItineraryDbRow["traffic_snapshot"]) ?? undefined,
    activityCoordinates: (record.activity_coordinates as ItineraryDbRow["activity_coordinates"]) ?? undefined,
  };
}
// Validation mirrors the browser save payload in
// src/app/itinerary-generator/hooks/useItineraryGenerator.ts:123-142.
// Passthrough preserves traffic metadata / city scope fields the UI adds
// without requiring a schema change for every additive field.

export const ItineraryFormDataSchema = z
  .object({
    budget: z.string().max(100),
    pax: z.string().max(100),
    duration: z.string().max(100),
    dates: z.object({
      start: z.string().max(50),
      end: z.string().max(50),
    }),
    selectedInterests: z.array(z.string().max(100)).max(25),
  })
  .passthrough();

const ActivitySchema = z
  .object({
    title: z.string().min(1).max(200),
    time: z.string().max(100),
    desc: z.string().max(5000),
    tags: z.array(z.string().max(100)).max(25),
    image: z.union([z.string().max(2000), z.object({ src: z.string().max(2000) }).passthrough()]),
  })
  .passthrough();

export const ItineraryDataSchema = z
  .object({
    title: z.string().min(1).max(200),
    subtitle: z.string().max(500),
    items: z
      .array(
        z
          .object({
            period: z.string().max(100),
            activities: z.array(ActivitySchema).max(50),
            reason: z.string().max(1000).optional(),
          })
          .passthrough()
      )
      .min(1)
      .max(50),
  })
  .passthrough();

const ImageInputSchema = z.union([
  z.string().min(1).max(2000),
  z.object({ src: z.string().min(1).max(2000) }).passthrough(),
]);

export const SaveItinerarySchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  date: z.string().min(1, 'Date is required').max(100),
  budget: z.string().min(1, 'Budget is required').max(100),
  image: ImageInputSchema.optional(),
  tags: z.array(z.string().max(100)).max(50).optional().default([]),
  formData: ItineraryFormDataSchema,
  itineraryData: ItineraryDataSchema,
  weatherData: z.record(z.string(), z.unknown()).optional(),
});

// Partial update: every field optional. Refresh fields stay passthrough JSON
// so the refresh flow's Date instances serialize unchanged.
export const UpdateItinerarySchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    date: z.string().min(1).max(100).optional(),
    budget: z.string().min(1).max(100).optional(),
    image: ImageInputSchema.optional(),
    tags: z.array(z.string().max(100)).max(50).optional(),
    formData: ItineraryFormDataSchema.optional(),
    itineraryData: z.record(z.string(), z.unknown()).optional(),
    weatherData: z.record(z.string(), z.unknown()).nullable().optional(),
    refreshMetadata: z.record(z.string(), z.unknown()).nullable().optional(),
    trafficSnapshot: z.record(z.string(), z.unknown()).nullable().optional(),
    activityCoordinates: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
  })
  .strict();
