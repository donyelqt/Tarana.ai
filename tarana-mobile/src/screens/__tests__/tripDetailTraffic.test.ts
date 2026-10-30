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

describe('ActivitySheet — the badge site resolves from both sources', () => {
  it('renders the same badge when the field and its tag agree', () => {
    expect(activityTrafficLevel('LOW', ['low-traffic'])).toBe('LOW');
  });

  it('renders a badge for a row carrying only the tag', () => {
    expect(activityTrafficLevel(undefined, ['moderate-traffic'])).toBe('MODERATE');
  });

  it('renders no badge when neither source is present', () => {
    expect(activityTrafficLevel(undefined, ['food', 'outdoors'])).toBe(null);
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
