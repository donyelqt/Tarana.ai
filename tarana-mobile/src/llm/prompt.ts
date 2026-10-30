import type { PlanInput } from '../data';

export const SLOTS = ['Morning', 'Afternoon', 'Evening'] as const;

export type Slot = (typeof SLOTS)[number];

export function dayWindow(startDate: string, dayIndex: number): string {
  const d = new Date(`${startDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dayIndex);
  return d.toISOString().slice(0, 10);
}

export function buildDayPrompt(input: PlanInput, dayIndex: number, priorTitles: string[]): string {
  const interests = input.interests.join(', ');
  const avoid =
    priorTitles.length > 0
      ? `\nDo not reuse these previously planned stops: ${priorTitles.slice(-24).join('; ')}.`
      : '';
  return (
    `Plan day ${dayIndex + 1} of ${input.days} for a trip to ${input.city}. ` +
    `Budget PHP ${input.budget} total for ${input.pax} people. Interests: ${interests}. ` +
    `Date: ${dayWindow(input.startDate, dayIndex)}.${avoid}\n` +
    `Return JSON with keys "period" (a string containing "Morning", "Afternoon", or "Evening"), ` +
    `"activities" (array of objects with string fields "title", "time", "desc", "tags" as a string array, ` +
    `"image" null or a URL string), and optional "reason" (a short string). ` +
    `Give exactly three periods in order: Morning (8-12), Afternoon (12-18), Evening (18+). ` +
    `Use real places that fit the interests. Output JSON only.`
  );
}
