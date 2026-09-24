import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import RecommendedForYou from '../RecommendedForYou';
import { getSavedMeals } from '@/lib/data/supabaseMeals';
import type { SavedMeal } from '@/app/saved-meals/data';

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

jest.mock('@/lib/data/supabaseMeals', () => ({
  getSavedMeals: jest.fn(),
}));

const mockedGetSavedMeals = getSavedMeals as jest.MockedFunction<typeof getSavedMeals>;

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
    mockedGetSavedMeals.mockReset();
  });

  it('uses saved meals to label a real cafe recommendation and keeps the actions navigable', async () => {
    const savedMeal: SavedMeal = {
      id: 'meal-1',
      cafeName: 'Itaewon Cafe',
      mealType: 'Lunch',
      price: 300,
      goodFor: 2,
      location: 'Session Road',
      image: 'saved-meal.jpg',
    };
    mockedGetSavedMeals.mockResolvedValue([savedMeal]);

    renderWithQueryClient();

    expect(await screen.findByText('Taste match')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Explore cafe:/ })).toHaveAttribute('href', '/tarana-eats');
    expect(screen.getByRole('link', { name: /Explore spot:/ })).toHaveAttribute('href', '/tarana-explore');
  });

  it('keeps useful fallback recommendations visible when personalization fails', async () => {
    mockedGetSavedMeals.mockRejectedValue(new Error('network unavailable'));

    renderWithQueryClient();

    expect(await screen.findByRole('status')).toHaveTextContent('Personalization is temporarily unavailable.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Explore cafe:/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Explore spot:/ })).toBeInTheDocument();
  });
});
