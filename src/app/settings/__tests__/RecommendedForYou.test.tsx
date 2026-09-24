import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import RecommendedForYou from '../RecommendedForYou';
import type { SettingsRecommendation, SettingsRecommendationsResponse } from '@/types/settings-recommendations';

jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'user-1' } },
    status: 'authenticated',
  }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ fill: _fill, ...props }: Record<string, unknown>) => <img {...props} />,
}));

const mockedFetch = jest.fn();
global.fetch = mockedFetch as unknown as typeof fetch;

const recommendations: SettingsRecommendation[] = [
  {
    kind: 'cafe',
    card: { name: 'Itaewon Cafe', image: null, distance: '~1.0km', time: '~3 min', traffic: 'Low' },
    href: '/tarana-eats',
    action: 'Explore cafe',
    context: 'Taste match',
  },
  {
    kind: 'spot',
    card: { name: 'Baguio Public Market', image: null, distance: '~0.3km', time: '~1 min', traffic: 'Low' },
    href: '/tarana-explore',
    action: 'Explore spot',
    context: 'Good timing',
  },
];

function response(overrides: Partial<SettingsRecommendationsResponse> = {}): SettingsRecommendationsResponse {
  return {
    success: true,
    personalized: false,
    recommendations,
    ...overrides,
  };
}

function renderWithQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RecommendedForYou />
    </QueryClientProvider>
  );
}

describe('RecommendedForYou', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('uses the server recommendation response and keeps the actions navigable', async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => response({ personalized: true }),
    });

    renderWithQueryClient();

    expect(await screen.findByText('Taste match')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Explore cafe:/ })).toHaveAttribute('href', '/tarana-eats');
    expect(screen.getByRole('link', { name: /Explore spot:/ })).toHaveAttribute('href', '/tarana-explore');
    expect(mockedFetch).toHaveBeenCalledWith('/api/recommendations/settings', {
      headers: { Accept: 'application/json' },
    });
  });

  it('keeps fallback recommendations visible when the server reports a personalization failure', async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => response({ personalizationError: true }),
    });

    renderWithQueryClient();

    expect(await screen.findByRole('status')).toHaveTextContent('Personalization is temporarily unavailable.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Explore cafe:/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Explore spot:/ })).toBeInTheDocument();
  });

  it('shows the empty state when the recommendations endpoint itself fails', async () => {
    mockedFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'network unavailable' }),
    });

    renderWithQueryClient();

    expect(await screen.findByText('No recommendations yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Build an itinerary' })).toHaveAttribute('href', '/itinerary-generator');
  });
});
