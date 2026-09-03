/**
 * End-to-end-of-component network counts for the dashboard TanStack Query
 * migration (XYZ metric, measured — not derived).
 *
 * Renders the REAL page.tsx three times against ONE real QueryClient (mirrors
 * the app layout where QueryProvider outlives page remounts), with auth mocked
 * as authenticated and fetch routed by URL. Counts /api/weather and
 * /api/referrals/stats calls per mount.
 *
 * What this is: full component + real React Query cache behavior.
 * What this is not: a real browser (jsdom, no paint) — see XYZ doc.
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/use-toast';
import Dashboard from '../page';

jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'user-1',
        email: 'tester@example.com',
        name: 'Tester',
        image: null,
      },
    },
    status: 'authenticated',
  }),
  signOut: jest.fn(),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

jest.mock('framer-motion', () => ({
  motion: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    span: (props: any) => <span {...props} />,
  },
  useReducedMotion: () => true,
}));

jest.mock(
  'public',
  () => ({ noProfile: '/stub-profile.png' }),
  { virtual: true }
);

jest.mock(
  '../../../../public/images/taranaai2.png',
  () => '/stub-taranaai2.png',
  { virtual: true }
);

const weatherPayload = {
  main: { temp: 17, feels_like: 15, humidity: 99 },
  weather: [{ id: 500, main: 'Rain', description: 'heavy intensity rain', icon: '10d' }],
  name: 'Baguio',
  sys: { country: 'PH' },
  dt: 1756800000,
};

const referralPayload = {
  success: true,
  stats: { activeReferrals: 2, currentTier: 'Explorer' },
  tierProgress: {
    currentTier: 'Explorer',
    currentReferrals: 2,
    nextTier: 'Smart Traveler',
    nextTierRequirement: 3,
    progress: 50,
  },
};

const taranaPayload = {
  success: true,
  stats: { itineraries: 12, cafes: 20, meals: 34, explorers: 56 },
};

const weatherCalls: string[] = [];
const statsCalls: string[] = [];
const taranaCalls: string[] = [];
const weatherCoords: { lat: number; lon: number }[] = [];

function routeFetch(url: unknown) {
  const u = String(url);
  if (u.includes('/api/weather')) {
    weatherCalls.push(u);
    // Regression pin for the 2026-09-03 [object Object] incident: TanStack
    // invokes queryFn with a context argument, so a bare function reference
    // as queryFn serialises lat as "[object Object]". Every call must carry
    // real numeric coordinates.
    const parsed = new URL(u, 'http://localhost:3000');
    weatherCoords.push({
      lat: parseFloat(parsed.searchParams.get('lat') ?? 'NaN'),
      lon: parseFloat(parsed.searchParams.get('lon') ?? 'NaN'),
    });
    return { ok: true, json: async () => weatherPayload };
  }
  if (u.includes('/api/referrals/stats')) {
    statsCalls.push(u);
    return { ok: true, json: async () => referralPayload };
  }
  if (u.includes('/api/stats')) {
    taranaCalls.push(u);
    return { ok: true, json: async () => taranaPayload };
  }
  return { ok: true, json: async () => ({}) };
}

describe('dashboard network counts across 3 mounts (one shared client)', () => {
  it('fetches weather once and referral stats once, then serves cache', async () => {
    global.fetch = jest.fn(routeFetch) as unknown as typeof fetch;
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const ui = (
      <QueryClientProvider client={client}>
        <ToastProvider>
          <Dashboard />
        </ToastProvider>
      </QueryClientProvider>
    );

    for (let mount = 1; mount <= 3; mount++) {
      const { unmount } = render(ui);
      await waitFor(() => expect(screen.getByText(/Baguio Weather/)).toBeInTheDocument());
      await waitFor(() => expect(screen.getByText('17°C')).toBeInTheDocument());
      await waitFor(() =>
        expect(screen.getByText('2/3 referrals - Explorer Tier')).toBeInTheDocument()
      );
      await waitFor(() => expect(screen.getByText('MEALS SAVED')).toBeInTheDocument());
      await waitFor(() => expect(screen.getByText('34')).toBeInTheDocument());
      await waitFor(() => expect(screen.getByText('EXPLORERS')).toBeInTheDocument());
      unmount();
    }

    expect(weatherCalls).toHaveLength(1);
    expect(statsCalls).toHaveLength(1);
    expect(taranaCalls).toHaveLength(1);
    expect(weatherCoords).toHaveLength(1);
    for (const { lat, lon } of weatherCoords) {
      expect(Number.isFinite(lat)).toBe(true);
      expect(Number.isFinite(lon)).toBe(true);
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThanOrEqual(180);
    }
  });
});
