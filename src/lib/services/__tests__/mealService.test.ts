jest.mock('@/lib/data/supabaseAdmin', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

import { supabaseAdmin } from '@/lib/data/supabaseAdmin';
import { MealDbError, updateMealNotes } from '../mealService';

const fromMock = supabaseAdmin.from as unknown as jest.Mock;

function queryChain(result: { data: unknown; error: unknown }) {
  const chain: any = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.upsert = jest.fn(() => chain);
  chain.maybeSingle = jest.fn().mockResolvedValue(result);
  chain.single = jest.fn().mockResolvedValue(result);
  return chain;
}

beforeEach(() => {
  fromMock.mockReset();
});

describe('updateMealNotes — the meal must belong to the caller', () => {
  it('does not write a notes row when the meal is not owned by the caller', async () => {
    const ownership = queryChain({ data: null, error: null });
    fromMock.mockReturnValue(ownership);

    await expect(
      updateMealNotes('meal-1', 'user-1', { title: 'Favorite', notes: 'Best ramen' })
    ).resolves.toBeNull();

    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith('saved_meals');
    expect(fromMock).not.toHaveBeenCalledWith('saved_meal_notes');
    expect(ownership.eq).toHaveBeenNthCalledWith(1, 'id', 'meal-1');
    expect(ownership.eq).toHaveBeenNthCalledWith(2, 'user_id', 'user-1');
  });

  it('upserts the caller notes after the meal ownership check passes', async () => {
    const ownership = queryChain({ data: { id: 'meal-1' }, error: null });
    const notes = queryChain({ data: { id: 'note-1', title: 'Favorite' }, error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === 'saved_meals') return ownership;
      if (table === 'saved_meal_notes') return notes;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(
      updateMealNotes('meal-1', 'user-1', { title: 'Favorite', notes: 'Best ramen' })
    ).resolves.toEqual({ id: 'note-1', title: 'Favorite' });

    expect(notes.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        meal_id: 'meal-1',
        user_id: 'user-1',
        title: 'Favorite',
        notes: 'Best ramen',
      }),
      { onConflict: 'user_id,meal_id' }
    );
  });

  it('throws MealDbError if the ownership check fails', async () => {
    const ownership = queryChain({
      data: null,
      error: { message: 'database unavailable', hint: 'try again', code: 'PGRST999' },
    });
    fromMock.mockReturnValue(ownership);

    await expect(
      updateMealNotes('meal-1', 'user-1', { title: 'Favorite', notes: 'Best ramen' })
    ).rejects.toBeInstanceOf(MealDbError);
    expect(fromMock).not.toHaveBeenCalledWith('saved_meal_notes');
  });
});
