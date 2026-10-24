/**
 * Day prompt builder — pure, exported, unit-testable.
 *
 * The on-device generator runs one slot at a time, so it needs the same
 * constraints restated on every call: a 1.7B model attends to the tail of
 * its prompt, which means the period order and the do-not-reuse list have to
 * sit near the end, not at the top.
 *
 * Kept deliberately free of imports: no llama.rn, no expo-file-system, no
 * schema. It takes what the caller already has (PlanInput plus the titles
 * planned so far) and returns a string. That is the entire contract, which
 * is what makes it testable without a native module or a model.
 */
import type { PlanInput } from '../data';

/** Slots the generator fills, in render order. TripDetail groups on "morning". */
export const SLOTS = ['Morning', 'Afternoon', 'Evening'] as const;

export type Slot = (typeof SLOTS)[number];

/** Calendar date of `dayIndex` when the trip starts on `startDate`. */
export function dayWindow(startDate: string, dayIndex: number): string {
  const d = new Date(`${startDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dayIndex);
  return d.toISOString().slice(0, 10);
}

/**
 * Build the prompt for one `Slot` of one day.
 *
 * The returned text demands the three periods in order (Morning 8-12,
 * Afternoon 12-18, Evening 18+), injects the trip parameters verbatim, and
 * ends with the titles already planned so the model proposes somewhere new.
 * `priorTitles` is capped at the most recent 24 — beyond that the tail rule
 * buries the period order the model has to obey.
 */
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
