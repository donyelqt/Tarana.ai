import { z } from 'zod';

export const ActivitySchema = z.object({
  image: z.string().url().or(z.string().min(1)), 
  title: z.string().min(3, "Title must be at least 3 characters long"),
  time: z.string(),
  desc: z.string(),
  tags: z.array(z.string()),
  peakHours: z.string().optional(),
  relevanceScore: z.number().optional(),
  isCurrentlyPeak: z.boolean().optional(),
});

export const ItineraryItemSchema = z.object({
  period: z.string(),
  activities: z.array(ActivitySchema),
  reason: z.string().optional(), 
});

export const ItinerarySchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  items: z.array(ItineraryItemSchema),
});

export type Activity = z.infer<typeof ActivitySchema>;
export type ItineraryItem = z.infer<typeof ItineraryItemSchema>;
export type Itinerary = z.infer<typeof ItinerarySchema>;
