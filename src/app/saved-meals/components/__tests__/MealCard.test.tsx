import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'user-1' } } }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }),
}));

jest.mock('@/lib/data/supabaseMeals', () => ({
  deleteMeal: jest.fn(),
  saveMeal: jest.fn(),
  getMealNotes: jest.fn(),
  updateMealNotes: jest.fn(),
}));

import { ToastProvider } from '@/components/ui/use-toast';
import { getMealNotes, updateMealNotes } from '@/lib/data/supabaseMeals';
import MealCard from '../MealCard';
import type { SavedMeal } from '@/app/saved-meals/data';

const meal: SavedMeal = {
  id: 'meal-1',
  cafeName: 'Cafe Baguio',
  mealType: 'Lunch',
  price: 150,
  goodFor: 2,
  location: 'Baguio City',
  image: '/assets/images/placeholder.png',
  notes: { title: 'Evening ramen', notes: 'No MSG' },
};

const mockedGetMealNotes = getMealNotes as jest.Mock;
const mockedUpdateMealNotes = updateMealNotes as jest.Mock;

let invalidateQueries: jest.SpyInstance;
let queryClient: QueryClient;

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  invalidateQueries = jest
    .spyOn(queryClient, 'invalidateQueries')
    .mockResolvedValue(undefined);
});

function renderCard(overrides: SavedMeal = meal) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MealCard meal={overrides} />
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe('MealCard — the saved nickname is visible before the detail page', () => {
  it('shows the nickname as the card heading and keeps the cafe name as a subheading', () => {
    renderCard();

    expect(screen.getByRole('heading', { name: 'Evening ramen' })).toBeTruthy();
    expect(screen.getByText('Cafe Baguio')).toBeTruthy();
  });

  it('falls back to the cafe name when no nickname is saved', () => {
    renderCard({ ...meal, notes: null });

    expect(screen.getByRole('heading', { name: 'Cafe Baguio' })).toBeTruthy();
  });
});
describe('MealCard — the note body is visible on the card', () => {
  it('shows the saved note text with a notes label for assistive tech', () => {
    renderCard();

    expect(screen.getByText('No MSG')).toBeTruthy();
    expect(screen.getByText('Your notes:')).toBeTruthy();
  });

  it('renders no notes row when the note body is blank', () => {
    renderCard({ ...meal, notes: { title: 'Evening ramen', notes: '   ' } });

    expect(screen.queryByText('Your notes:')).toBeNull();
  });
});


describe('MealCard — saving notes refreshes both saved-meals queries', () => {
  it('invalidates the list and notes caches after a successful save', async () => {
    mockedGetMealNotes.mockResolvedValue({ title: 'Old title', notes: 'Old notes' });
    mockedUpdateMealNotes.mockResolvedValue(true);

    renderCard();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Edit notes' }));
    });

    expect((screen.getByPlaceholderText('Nickname for this meal') as HTMLInputElement).value).toBe('Old title');

    fireEvent.change(screen.getByPlaceholderText('Nickname for this meal'), {
      target: { value: 'Dinner ramen' },
    });
    fireEvent.change(screen.getByPlaceholderText('What did you think? Any dietary notes?'), {
      target: { value: 'No MSG' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    await waitFor(() =>
      expect(mockedUpdateMealNotes).toHaveBeenCalledWith('meal-1', {
        title: 'Dinner ramen',
        notes: 'No MSG',
      })
    );
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['saved-meals'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['saved-meal-notes', 'meal-1'] });
  });
});
