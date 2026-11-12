describe('savedMeals notes contract', () => {
  const fetchMock = global.fetch as unknown as jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    fetchMock.mockReset();
  });

  it('maps list notes into the returned SavedMeal', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [{
          id: 'meal-1',
          cafe_name: 'Cafe Baguio',
          meal_type: 'Lunch',
          price: 150,
          good_for: 2,
          location: 'Baguio City',
          image: '/assets/images/placeholder.png',
          menu_items: [],
          notes: { title: 'Evening ramen', notes: 'No MSG' },
        }],
      }),
    });

    const { getSavedMeals } = await import('../supabaseMeals');
    const meals = await getSavedMeals();

    expect(meals).toHaveLength(1);
    expect(meals[0].notes).toEqual({ title: 'Evening ramen', notes: 'No MSG' });
  });

  it('reads the top-level notes field from the detail response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { id: 'meal-1', cafe_name: 'Cafe Baguio' },
        notes: { title: 'Evening ramen', notes: 'No MSG' },
      }),
    });

    const { getMealNotes } = await import('../supabaseMeals');

    await expect(getMealNotes('meal-1')).resolves.toEqual({
      title: 'Evening ramen',
      notes: 'No MSG',
    });
  });

  it('returns null when the detail response has no notes', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { id: 'meal-1', cafe_name: 'Cafe Baguio' },
        notes: null,
      }),
    });

    const { getMealNotes } = await import('../supabaseMeals');

    await expect(getMealNotes('meal-1')).resolves.toBeNull();
  });
});
