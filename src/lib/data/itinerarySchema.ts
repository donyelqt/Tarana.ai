import { z } from 'zod';


export const activitySchema = z.object({
  title: z.string().min(1).max(200),
  time: z.string().max(100).default(''),
  desc: z.string().max(2000).default(''),
  image: z.string().nullable().optional(),
  tags: z.array(z.string().max(50)).max(12).default([]),
  peakHours: z.string().max(100).optional(),
  relevanceScore: z.number().optional(),
  isCurrentlyPeak: z.boolean().optional(),
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
  weatherData: z.unknown().nullable().optional(),
});

export type Activity = z.infer<typeof activitySchema>;
export type ItinerarySection = z.infer<typeof itinerarySectionSchema>;
export type ItineraryData = z.infer<typeof itineraryDataSchema>;
export type ItineraryFormData = z.infer<typeof itineraryFormDataSchema>;
export type ItineraryPayload = z.infer<typeof itineraryPayloadSchema>;

export function validateItineraryData(value: unknown): ItineraryData | null {
  const result = itineraryDataSchema.safeParse(value);
  return result.success ? result.data : null;
}

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
