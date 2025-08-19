import { z } from 'zod';

// Schema for a single activity
export const ActivitySchema = z.object({
  image: z.string().url().or(z.string().min(1)), // Accepts a URL or a non-empty string as a local key
  title: z.string().min(3, "Title must be at least 3 characters long"),
  time: z.string(),
  desc: z.string(),
  tags: z.array(z.string()),
  peakHours: z.string().optional(),
  relevanceScore: z.number().optional(),
  isCurrentlyPeak: z.boolean().optional(),
});

// Schema for a single period in the itinerary (e.g., Morning, Afternoon)
export const ItineraryItemSchema = z.object({
  period: z.string(),
  activities: z.array(ActivitySchema),
  reason: z.string().optional(), // For empty slots
});

// Schema for the entire itinerary
export const ItinerarySchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  items: z.array(ItineraryItemSchema),
});

// Type definitions inferred from schemas
export type Activity = z.infer<typeof ActivitySchema>;
export type ItineraryItem = z.infer<typeof ItineraryItemSchema>;
export type Itinerary = z.infer<typeof ItinerarySchema>;
