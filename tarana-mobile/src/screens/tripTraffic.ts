/**
 * Per-stop traffic, as both mobile and web store it.
 *
 * The same stop carries its traffic in one of two shapes depending on
 * where it was saved:
 * - a structured `trafficLevel` field (`'LOW' | 'MODERATE' | ...`), set by
 *   the mobile-side enrichment and mapped to the five-level web vocabulary.
 * - a tag string ('low-traffic' | 'moderate-traffic'), which is all a stop
 *   imported from the web has: `src/app/saved-trips/[id]/page.tsx:602-603`
 *   reads traffic off `activity.tags` and never off a level field, so the
 *   structured field is simply absent on those rows.
 *
 * Both sources describe the same fact, so this module is the one place
 * that knows either spelling. It has no rendering and no I/O.
 */
import type { SpotTraffic } from '../data';

/** The two traffic tags web writes; anything else is a normal interest tag. */
export function isTrafficTag(tag: string): boolean {
  return tag === 'low-traffic' || tag === 'moderate-traffic';
}

/**
 * Badge level for one stop.
 *
 * The explicit `trafficLevel` wins when it is present — it carries all
 * five levels, not just the two the tags can express, so preferring it is
 * what keeps a saved `SEVERE` row rendering `SEVERE`. The tag is the
 * fallback that keeps every web-saved row rendering a badge at all:
 * without it a row saved on the web (traffic known only as a tag) shows no
 * traffic and the most decision-relevant per-stop fact disappears.
 *
 * A row with neither source has no traffic to state, which is `null` — not
 * a guess at a level.
 */
export function activityTrafficLevel(level: string | undefined, tags?: string[]): SpotTraffic | null {
  const v = (level ?? '').toUpperCase();
  if (v === 'VERY_LOW' || v === 'LOW') return 'LOW';
  if (v === 'MODERATE' || v === 'HIGH' || v === 'SEVERE') return v;
  for (const tag of tags ?? []) {
    if (!isTrafficTag(tag)) continue;
    return tag === 'low-traffic' ? 'LOW' : 'MODERATE';
  }
  return null;
}
