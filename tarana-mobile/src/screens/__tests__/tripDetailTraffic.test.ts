/**
 * Per-stop traffic resolution — the observable contract of which source
 * wins, per saved row.
 *
 * A stop's traffic is stored in one of two shapes depending on where it was
 * saved: a structured `trafficLevel` (mobile enrichment, five levels) or a
 * tag string 'low-traffic' / 'moderate-traffic' (every web-saved row —
 * `src/app/saved-trips/[id]/page.tsx:602-603` reads traffic off
 * `activity.tags` only). The mobile detail screen used to read
 * `trafficLevel` alone, so a stop saved on the web had known traffic that
 * rendered as nothing at all: the single most decision-relevant per-stop
 * fact vanished for every web-saved stop.
 *
 * This module is pure, so these tests need no navigation stack, no SQLite,
 * and no React Native render — the same seam `../savedMeals` takes.
 *
 * What is pinned here, and why each is a contract rather than a detail:
 * 1. `trafficLevel` wins when present. It carries all five levels; the two
 *    tags can express only two, so preferring the field is what keeps a
 *    saved `SEVERE` rendering `SEVERE` rather than collapsing to a tag.
 * 2. A web-saved row (tag only) renders its badge. The bug itself: the tag
 *    is the only traffic those rows have.
 * 3. A row with neither source renders no badge. No traffic is a claim of
 *    ignorance, not a blank level to default into.
 * 4. A row carrying both agrees with itself. "LOW" plus 'low-traffic' must
 *    not become two different answers depending on which field is read
 *    first.
 * 5. Tag casing is not guessed at — the exact web spellings are the only
 *    ones that count, and a near-miss tag is not a traffic tag.
 */
import { describe, expect, it } from '@jest/globals';
import { activityTrafficLevel, isTrafficTag } from '../tripTraffic';

describe('activityTrafficLevel — the structured field is preferred', () => {
  it('reads a structured trafficLevel on its own', () => {
    expect(activityTrafficLevel('LOW')).toBe('LOW');
    expect(activityTrafficLevel('MODERATE')).toBe('MODERATE');
    expect(activityTrafficLevel('SEVERE')).toBe('SEVERE');
  });

  it('collapses VERY_LOW to the LOW badge, as the badge table does', () => {
    expect(activityTrafficLevel('VERY_LOW')).toBe('LOW');
  });

  it('accepts lowercase levels, like an untrimmed API field', () => {
    expect(activityTrafficLevel('moderate')).toBe('MODERATE');
  });

  it('an unknown level is not traffic, not a default', () => {
    expect(activityTrafficLevel('UNKNOWN')).toBe(null);
    expect(activityTrafficLevel('')).toBe(null);
    expect(activityTrafficLevel(undefined)).toBe(null);
  });

  it('prefers the field even when a tag disagrees with it', () => {
    // The field carries five levels; the tag can only say LOW/MODERATE.
    expect(activityTrafficLevel('SEVERE', ['moderate-traffic'])).toBe('SEVERE');
  });
});

describe('activityTrafficLevel — the tag fallback (the web parity gap)', () => {
  it('renders a badge for a web-saved row that has only a tag', () => {
    expect(activityTrafficLevel(undefined, ['low-traffic'])).toBe('LOW');
    expect(activityTrafficLevel(undefined, ['moderate-traffic'])).toBe('MODERATE');
  });

  it('finds the traffic tag among ordinary interest tags', () => {
    expect(activityTrafficLevel(undefined, ['food', 'low-traffic', 'outdoors'])).toBe('LOW');
  });

  it('agrees with the explicit field when both are present', () => {
    expect(activityTrafficLevel('LOW', ['low-traffic'])).toBe('LOW');
    expect(activityTrafficLevel('MODERATE', ['moderate-traffic'])).toBe('MODERATE');
  });

  it('renders no badge when neither source is present', () => {
    expect(activityTrafficLevel(undefined, [])).toBe(null);
    expect(activityTrafficLevel(undefined, ['food', 'outdoors'])).toBe(null);
    expect(activityTrafficLevel(undefined, undefined)).toBe(null);
  });
});

describe('isTrafficTag — the tag filter is independent of the badge', () => {
  it('recognises exactly the two web traffic tags', () => {
    expect(isTrafficTag('low-traffic')).toBe(true);
    expect(isTrafficTag('moderate-traffic')).toBe(true);
  });

  it('does not treat interest tags, or near misses, as traffic', () => {
    expect(isTrafficTag('food')).toBe(false);
    expect(isTrafficTag('low-traffic-')).toBe(false);
    expect(isTrafficTag('high-traffic')).toBe(false);
    expect(isTrafficTag('severe-traffic')).toBe(false);
  });
});
