import {
  getReferralDisplay,
  isFallbackWeather,
  mapReferralStatsResponse,
  weatherQueryOptions,
  WEATHER_FALLBACK_RETRY_MS,
} from '../utils';
import type { WeatherData } from '@/lib/core/utils';

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
