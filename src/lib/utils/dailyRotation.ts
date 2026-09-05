/**
 * Deterministic daily rotation over an accumulated candidate list.
 *
 * Spots parity: dashboard `rankSpots` rotates its pool by day before scoring
 * (`src/app/dashboard/utils.ts`). Gala's strict-city TomTom order is
 * query-bucket accumulation (same queries → same buckets → same head), so
 * without rotation every day serves identical picks.
 *
 * Pure + total: same (items, dayIndex) always yields the same order, and the
 * output is always a permutation of the input (no drops, no dupes).
 * UTC-day convention matches `rankSpots`.
 */
export function rotateByDay<T>(items: T[], dayIndex: number): T[] {
  if (!Array.isArray(items) || items.length <= 1) return [...items];
  const offset = Math.floor(dayIndex) % items.length;
  if (offset <= 0) return [...items];
  return [...items.slice(offset), ...items.slice(0, offset)];
}
