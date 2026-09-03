import {
  buildInviteLink,
  estimateMinutes,
  fetchReferralCode,
  formatDistanceKm,
  getReferralDisplay,
  haversineKm,
  isFallbackWeather,
  mapReferralStatsResponse,
  mapTaranaStatsResponse,
  rankCafes,
  rankSpots,
  spotsSubtitle,
  tasteProfile,
  toCafeCard,
  toSpotCard,
  trafficForSpot,
  weatherQueryOptions,
  WEATHER_FALLBACK_RETRY_MS,
} from '../utils';
import type { WeatherData } from '@/lib/core/utils';
import type { Activity } from '@/app/itinerary-generator/data/itineraryData';

describe('mapTaranaStatsResponse', () => {
  it('maps a successful /api/stats payload', () => {
    expect(
      mapTaranaStatsResponse({
        success: true,
        stats: { itineraries: 12, cafes: 20, meals: 34, explorers: 56 },
      })
    ).toEqual({ itineraries: 12, cafes: 20, meals: 34, explorers: 56 });
  });

  it('returns null for failure shapes and garbage', () => {
    expect(mapTaranaStatsResponse({ success: false })).toBeNull();
    expect(mapTaranaStatsResponse({ success: true })).toBeNull();
    expect(mapTaranaStatsResponse(null)).toBeNull();
    expect(mapTaranaStatsResponse('nope')).toBeNull();
  });

  it('defaults missing/non-numeric counts to zero', () => {
    expect(mapTaranaStatsResponse({ success: true, stats: {} })).toEqual({
      itineraries: 0,
      cafes: 0,
      meals: 0,
      explorers: 0,
    });
    expect(
      mapTaranaStatsResponse({ success: true, stats: { itineraries: 'lots' } })
    ).toMatchObject({ itineraries: 0 });
  });
});

describe('mapReferralStatsResponse', () => {
  it('maps a successful /api/referrals/stats payload', () => {
    const result = mapReferralStatsResponse({
      success: true,
      stats: { activeReferrals: 2, currentTier: 'Explorer' },
      tierProgress: {
        nextTier: 'Smart Traveler',
        nextTierRequirement: 3,
        progress: 50,
      },
    });

    expect(result).toEqual({
      activeReferrals: 2,
      currentTier: 'Explorer',
      nextTier: 'Smart Traveler',
      nextTierRequirement: 3,
      progress: 50,
    });
  });

  it('returns null when success flag is falsy', () => {
    expect(
      mapReferralStatsResponse({ success: false, stats: null })
    ).toBeNull();
  });

  it('returns null when stats are missing', () => {
    expect(mapReferralStatsResponse({ success: true })).toBeNull();
  });

  it('returns null for garbage input', () => {
    expect(mapReferralStatsResponse(null)).toBeNull();
    expect(mapReferralStatsResponse(undefined)).toBeNull();
    expect(mapReferralStatsResponse('nope')).toBeNull();
  });

  it('defaults missing counts to zero and tier to Default', () => {
    expect(
      mapReferralStatsResponse({ success: true, stats: {} })
    ).toEqual({
      activeReferrals: 0,
      currentTier: 'Default',
      nextTier: null,
      nextTierRequirement: null,
      progress: null,
    });
  });
});

describe('getReferralDisplay', () => {
  it('shows 0/1 progress for a fresh Default user', () => {
    const display = getReferralDisplay({
      activeReferrals: 0,
      currentTier: 'Default',
      nextTier: 'Explorer',
      nextTierRequirement: 1,
      progress: 0,
    });

    expect(display.isMaxed).toBe(false);
    expect(display.label).toBe('0/1');
    expect(display.nextTierName).toBe('Explorer');
    expect(display.invitesNeeded).toBe(1);
    expect(display.progress).toBe(0);
  });

  it('uses server tierProgress instead of hardcoded thresholds', () => {
    const display = getReferralDisplay({
      activeReferrals: 1,
      currentTier: 'Explorer',
      nextTier: 'Smart Traveler',
      nextTierRequirement: 3,
      progress: 50,
    });

    expect(display.label).toBe('1/3');
    expect(display.nextTierName).toBe('Smart Traveler');
    expect(display.invitesNeeded).toBe(2);
  });

  it('caps at max tier for exactly 5 referrals', () => {
    const display = getReferralDisplay({
      activeReferrals: 5,
      currentTier: 'Voyager',
      nextTier: null,
      nextTierRequirement: null,
      progress: null,
    });

    expect(display.isMaxed).toBe(true);
    expect(display.invitesNeeded).toBe(0);
    expect(display.progress).toBe(100);
  });

  it('does not overflow the label past the target (10 referrals renders 10/10, not 10/5)', () => {
    const display = getReferralDisplay({
      activeReferrals: 10,
      currentTier: 'Voyager',
      nextTier: null,
      nextTierRequirement: null,
      progress: null,
    });

    expect(display.isMaxed).toBe(true);
    expect(display.label).toBe('10/10');
    expect(display.invitesNeeded).toBe(0);
  });

  it('derives the next-tier benefit from the tier config', () => {
    const display = getReferralDisplay({
      activeReferrals: 1,
      currentTier: 'Explorer',
      nextTier: 'Smart Traveler',
      nextTierRequirement: 3,
      progress: 50,
    });

    expect(display.nextBenefit).toContain('8');
  });
});

describe('isFallbackWeather', () => {
  it('returns true only for flagged fallback data', () => {
    expect(isFallbackWeather({ isFallback: true })).toBe(true);
    expect(isFallbackWeather({})).toBe(false);
    expect(isFallbackWeather(null)).toBe(false);
    expect(isFallbackWeather(undefined)).toBe(false);
  });
});

describe('recommendations engine', () => {
  const peak = (p: string) => p === 'PEAK';
  const offPeakAct = (title: string): Activity => ({
    image: '/images/x.jpg',
    title,
    time: '9 AM',
    desc: 'd',
    tags: [],
    peakHours: 'OFF',
  });
  const peakAct = (title: string): Activity => ({
    ...offPeakAct(title),
    peakHours: 'PEAK',
  });

  it('haversine: Baguio center to Burnham Park is ~0.5km', () => {
    const km = haversineKm(
      { lat: 16.4134, lon: 120.5934 },
      { lat: 16.4093, lon: 120.595 }
    );
    expect(km).toBeGreaterThan(0.3);
    expect(km).toBeLessThan(0.8);
    expect(formatDistanceKm(km)).toMatch(/^~0\.\dkm$/);
    expect(estimateMinutes(km)).toBe('~1 min');
  });

  it('trafficForSpot: peak → High, off-peak → Low, unknown → null (badge hidden)', () => {
    expect(trafficForSpot('PEAK', peak)).toBe('High');
    expect(trafficForSpot('OFF', peak)).toBe('Low');
    expect(trafficForSpot(undefined, peak)).toBeNull();
    expect(trafficForSpot(null, peak)).toBeNull();
  });

  it('rankSpots puts off-peak first and is deterministic per day', () => {
    const pool = [peakAct('A'), offPeakAct('B'), offPeakAct('C'), peakAct('D')];
    const day1 = new Date('2026-09-03T02:00:00+08:00');
    const first = rankSpots(pool, day1, 3, peak).map((a) => a.title);
    expect(rankSpots(pool, day1, 3, peak).map((a) => a.title)).toEqual(first);
    // Off-peak B, C outrank in-peak A, D regardless of rotation
    expect(first.slice(0, 2)).toEqual(expect.arrayContaining(['B', 'C']));
    // Rotation varies the order across days
    const day2 = new Date('2026-09-04T02:00:00+08:00');
    const orders = new Set(
      [0, 1, 2, 3, 4, 5, 6].map((d) =>
        rankSpots(pool, new Date(day1.getTime() + d * 86400000), 3, peak)
          .map((a) => a.title)
          .join(',')
      )
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it('tasteProfile collects cuisines/tags of saved spots only', () => {
    const { terms, savedNames } = tasteProfile([
      { cafeName: 'Itaewon Cafe' } as never,
      { cafeName: 'Somewhere Unknown' } as never,
    ]);
    expect(savedNames.has('itaewon cafe')).toBe(true);
    expect(savedNames.has('somewhere unknown')).toBe(true);
    expect(terms.has('korean')).toBe(true);
    expect(terms.size).toBeGreaterThan(0);
  });

  it('rankCafes matches taste, excludes saves, falls back without saves', () => {
    const ranked = rankCafes([{ cafeName: 'Itaewon Cafe' } as never]);
    expect(ranked.length).toBe(3);
    expect(ranked.map((r) => r.restaurant.name)).not.toContain('Itaewon Cafe');
    // Korean/cuisine overlap should surface another Korean-leaning spot first
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
    const fallback = rankCafes([]);
    expect(fallback).toHaveLength(3);
    expect(fallback[0].score).toBe(0);
  });

  it('toSpotCard returns null without coords', () => {
    expect(
      toSpotCard({ name: 'No Such Place Xyz', image: null, lat: null, lon: null, peakHours: null })
    ).toBeNull();
  });

  it('toSpotCard builds honest derived fields for Burnham Park', () => {
    const card = toSpotCard({ name: 'Burnham Park', image: '/images/burnham.png', lat: 16.4093, lon: 120.595, peakHours: 'OFF' });
    expect(card).not.toBeNull();
    expect(card?.distance).toMatch(/^~/);
    expect(card?.time).toMatch(/^~/);
    expect(['Low', 'Moderate', 'High']).toContain(card?.traffic);
    expect(card?.lat).toBeCloseTo(16.4093);
  });

  it('toSpotCard hides the badge and uses the placeholder honestly', () => {
    const card = toSpotCard({ name: 'Cebu Spot', image: null, lat: 10.3, lon: 123.9, peakHours: null });
    expect(card?.traffic).toBeUndefined();
    expect(card?.image).toBe('/images/comingsoon.png');
  });

  it('toSpotCard prefers measured flow traffic over the schedule signal', () => {
    const card = toSpotCard({ name: 'X', image: '/i.jpg', lat: 10.3, lon: 123.9, peakHours: 'OFF', traffic: 'High' });
    expect(card?.traffic).toBe('High');
  });

  it('fetchSpots sanitizes badge levels from the wire', async () => {
    const { fetchSpots } = await import('../utils');
    const fetcher = (async () => ({
      ok: true,
      json: async () => ({
        success: true,
        spots: [
          { name: 'A', image: null, lat: 1, lon: 2, peakHours: null, traffic: 'High' },
          { name: 'B', image: null, lat: 1, lon: 2, peakHours: null, traffic: 'SEVERE' },
        ],
      }),
    })) as unknown as typeof fetch;
    expect(await fetchSpots('cebu', fetcher)).toEqual([
      { name: 'A', image: null, lat: 1, lon: 2, peakHours: null, traffic: 'High' },
      { name: 'B', image: null, lat: 1, lon: 2, peakHours: null, traffic: undefined },
    ]);
  });

  it('toCafeCard uses city peak state for traffic', () => {
    const [first] = rankCafes([]);
    // isPeakHour reads LOCAL hours — construct locally so this holds in any TZ
    const lunchRush = new Date(2026, 8, 3, 12, 30);
    expect(toCafeCard(first, { lat: 16.4134, lon: 120.5934 }, lunchRush)?.traffic).toBe('High');
    const dawn = new Date(2026, 8, 3, 5, 0);
    expect(toCafeCard(first, { lat: 16.4134, lon: 120.5934 }, dawn)?.traffic).toBe('Low');
  });
});

describe('spotsSubtitle', () => {
  const peak = (p: string) => p === 'PEAK';
  const act = (title: string, peakHours?: string): Activity => ({
    image: '/images/x.jpg',
    title,
    time: '9 AM',
    desc: 'd',
    tags: [],
    peakHours,
  });

  it('says Quietest right now when the top pick is off-peak', () => {
    expect(spotsSubtitle([act('B', 'OFF')], peak)).toBe('Quietest right now');
  });

  it('says Best available now when everything is peaking', () => {
    expect(spotsSubtitle([act('A', 'PEAK')], peak)).toBe('Best available now');
  });

  it('falls back to the generic line with no peak data or empty list', () => {
    expect(spotsSubtitle([act('X')], peak)).toBe('Optimized for low traffic and crowd');
    expect(spotsSubtitle([], peak)).toBe('Optimized for low traffic and crowd');
  });
});

describe('weatherQueryOptions refetchInterval (outage self-healing)', () => {
  const { refetchInterval } = weatherQueryOptions(true, async () => null);
  const tick = (data: WeatherData | null | undefined) =>
    typeof refetchInterval === 'function'
      ? refetchInterval({ state: { data } } as never)
      : refetchInterval;

  it('polls while the cache holds fallback data', () => {
    expect(tick({ isFallback: true } as WeatherData)).toBe(WEATHER_FALLBACK_RETRY_MS);
  });

  it('disables polling for live data, null, and undefined', () => {
    expect(tick({} as WeatherData)).toBe(false);
    expect(tick(null)).toBe(false);
    expect(tick(undefined)).toBe(false);
  });
});

describe('invite link (real DB code only)', () => {
  it('builds the signup?ref= shape the tracker consumes', () => {
    expect(buildInviteLink('https://example.com', 'A3F9K2QZ')).toBe(
      'https://example.com/auth/signup?ref=A3F9K2QZ'
    );
  });

  it('fetchReferralCode returns the DB-issued code, null otherwise', async () => {
    const ok = (async () => ({
      ok: true,
      json: async () => ({ success: true, referralCode: 'A3F9K2QZ' }),
    })) as unknown as typeof fetch;
    expect(await fetchReferralCode(ok)).toBe('A3F9K2QZ');

    const bad = (async () => ({
      ok: true,
      json: async () => ({ success: false }),
    })) as unknown as typeof fetch;
    expect(await fetchReferralCode(bad)).toBeNull();
  });

  it('referralCodeQueryOptions gates on auth + id', async () => {
    const { referralCodeQueryOptions } = await import('../utils');
    const spy = jest.fn().mockResolvedValue('A3F9K2QZ');
    expect(referralCodeQueryOptions('authenticated', 'u1', spy).enabled).toBe(true);
    expect(referralCodeQueryOptions('unauthenticated', 'u1', spy).enabled).toBe(false);
    expect(referralCodeQueryOptions('authenticated', undefined, spy).enabled).toBe(false);
  });
});
