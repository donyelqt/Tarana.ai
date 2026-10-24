import { z } from 'zod';

/**
 * Shared Gala itinerary schema — the single contract between the web
 * itinerary generator, the mobile local generator, and the mobile SQLite
 * payload.
 *
 * Why a schema module and not types: the mobile local LLM must *validate*
 * its own output (grammar-constrained sampling guarantees syntax, not
 * semantics), and the web import path must shape-validate every row it
 * stores (`tarana-mobile/src/data/index.ts` boundary rule). Zod gives both
 * sides one definition; drift between web types and mobile parsers becomes a
 * test failure instead of a runtime surprise.
 *
 * Metro-safe: pure TS, no react import. `tarana-web/*` resolves here for the
 * mobile app via metro.config.js extraNodeModules (documented there).
 *
 * Field parity with the web writer (`src/lib/data/itineraryMapper.ts`
 * ItineraryDbRow) and the mobile renderer (`tarana-mobile/src/screens/
 * TripDetail.tsx` Payload). Optional fields are optional because old rows
 * and the mobile rule-based fallback may omit them.
 */

export const activitySchema = z.object({
  title: z.string().min(1).max(200),
  time: z.string().max(100).default(''),
  desc: z.string().max(2000).default(''),
  image: z.string().nullable().optional(),
  tags: z.array(z.string().max(50)).max(12).default([]),
  // Web-side scoring extras; mobile generators omit them.
  peakHours: z.string().max(100).optional(),
  relevanceScore: z.number().optional(),
  isCurrentlyPeak: z.boolean().optional(),
  // Mobile activity pins carry coordinates; web rows keep them in
  // activity_coordinates instead.
  lat: z.number().optional(),
  lon: z.number().optional(),
});

export const itinerarySectionSchema = z.object({
  period: z.string().min(1).max(120),
  activities: z.array(activitySchema).default([]),
  reason: z.string().max(500).optional(),
});

export const itineraryDataSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).default(''),
  items: z.array(itinerarySectionSchema).min(1),
});

export const itineraryFormDataSchema = z.object({
  budget: z.string().max(100).default(''),
  pax: z.string().max(50).default(''),
  duration: z.string().max(100).default(''),
  dates: z
    .object({
      start: z.string().max(40).default(''),
      end: z.string().max(40).default(''),
    })
    .default({ start: '', end: '' }),
  selectedInterests: z.array(z.string().max(50)).max(25).default([]),
});

export const itineraryPayloadSchema = z.object({
  formData: itineraryFormDataSchema.nullable().default(null),
  itineraryData: itineraryDataSchema.nullable().default(null),
  // Stored on web rows and imported payloads; TripDetail ignores it.
  weatherData: z.unknown().nullable().optional(),
});

export type Activity = z.infer<typeof activitySchema>;
export type ItinerarySection = z.infer<typeof itinerarySectionSchema>;
export type ItineraryData = z.infer<typeof itineraryDataSchema>;
export type ItineraryFormData = z.infer<typeof itineraryFormDataSchema>;
export type ItineraryPayload = z.infer<typeof itineraryPayloadSchema>;

/**
 * The output contract every Gala generator must satisfy — the web Gemini
 * pipeline and the mobile local model alike. A generator returns one of
 * these; the caller persists it via createTrip payload.
 */
export function validateItineraryData(value: unknown): ItineraryData | null {
  const result = itineraryDataSchema.safeParse(value);
  return result.success ? result.data : null;
}

/**
 * The mobile Plan screen input (`tarana-mobile/src/screens/Plan.tsx`
 * PlanInput) and the web form fields, in one shape. `city` uses the web
 * cityId vocabulary; mobile pills map their display names onto it.
 */
export const planRequestSchema = z.object({
  city: z.enum(['baguio', 'cebu', 'manila', 'davao', 'boracay', 'el_nido', 'ph-wide', 'world']),
  budget: z.number().positive().nullable(),
  pax: z.number().int().positive().max(50),
  days: z.number().int().positive().max(14),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  interests: z.array(z.string().min(1).max(50)).max(25),
});

export type PlanRequest = z.infer<typeof planRequestSchema>;
