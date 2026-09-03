import React from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import {
  referralQueryOptions,
  weatherQueryOptions,
  type ReferralStatsView,
} from '../utils';
import type { WeatherData } from '@/lib/core/utils';

const fakeWeather: WeatherData = {
  main: { temp: 17, feels_like: 15, humidity: 99 },
  weather: [{ id: 500, main: 'Rain', description: 'heavy intensity rain', icon: '10d' }],
  name: 'Baguio',
  sys: { country: 'PH' },
  dt: 1234567890,
};

const fakeReferral: ReferralStatsView = {
  activeReferrals: 2,
  currentTier: 'Explorer',
  nextTier: 'Smart Traveler',
  nextTierRequirement: 3,
  progress: 50,
};

function createTestClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('weather query cache (shipped config)', () => {
  it('serves the second mount from cache: 2 mounts, 1 fetch', async () => {
    const client = createTestClient();
    const queryFn = jest.fn().mockResolvedValue(fakeWeather);

    const first = renderHook(
      () => useQuery(weatherQueryOptions(true, queryFn)),
      { wrapper: wrapper(client) }
    );
    await waitFor(() =>
      expect(first.result.current.data).toEqual(fakeWeather)
    );
    first.unmount();

    const second = renderHook(
      () => useQuery(weatherQueryOptions(true, queryFn)),
      { wrapper: wrapper(client) }
    );
    await waitFor(() =>
      expect(second.result.current.data).toEqual(fakeWeather)
    );
    second.unmount();

    expect(queryFn).toHaveBeenCalledTimes(1);
  });
});

describe('referral query cache (shipped config)', () => {
  it('fetches once per mount and refetches exactly once on invalidate', async () => {
    const client = createTestClient();
    const queryFn = jest.fn().mockResolvedValue(fakeReferral);

    const { result, unmount } = renderHook(
      () => useQuery(referralQueryOptions('authenticated', 'user-1', queryFn)),
      { wrapper: wrapper(client) }
    );
    await waitFor(() => expect(result.current.data).toEqual(fakeReferral));
    expect(queryFn).toHaveBeenCalledTimes(1);

    await client.invalidateQueries({ queryKey: ['referral-stats', 'user-1'] });
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    unmount();
  });

  it('does not fetch when unauthenticated or id-less', () => {
    const queryFn = jest.fn();
    expect(
      referralQueryOptions('unauthenticated', 'user-1', queryFn).enabled
    ).toBe(false);
    expect(
      referralQueryOptions('authenticated', undefined, queryFn).enabled
    ).toBe(false);
    expect(
      referralQueryOptions('authenticated', 'user-1', queryFn).enabled
    ).toBe(true);
    expect(queryFn).not.toHaveBeenCalled();
  });
});
