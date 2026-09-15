/**
 * Prove-it tests for the save/list cutover: the browser must never touch
 * Supabase directly (anon key + auth.uid() RLS always fails). jsdom provides
 * `window`, so these exercise the fetch branches: POST/PATCH/DELETE hit the
 * session-cookie API routes, GET maps server errors to the legacy [] shape.
 */
describe('savedItineraries browser cutover', () => {
  const validItinerary = {
    title: 'Your 1 Day Itinerary',
    date: 'June 13, 2026 - June 14, 2026',
    budget: 'Budget',
    image: '/images/burnham.jpg',
    tags: ['Nature & Scenery'],
    formData: {
      budget: 'Budget',
      pax: 'Solo',
      duration: '1 Day',
      dates: { start: '2026-06-13T00:00:00.000Z', end: '2026-06-14T00:00:00.000Z' },
      selectedInterests: ['Nature & Scenery'],
    },
    itineraryData: {
      title: 'Baguio Day',
      subtitle: 'One day highlights',
      items: [
        {
          period: 'Morning',
          activities: [
            { title: 'Burnham Park', time: '9:00 AM', desc: 'Boats', tags: ['Nature'], image: '/images/burnham.jpg' },
          ],
        },
      ],
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fetchMock = global.fetch as unknown as jest.Mock;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    fetchMock.mockReset();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('saveItinerary POSTs the generator payload to the API route, never Supabase', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 'itin-1', ...validItinerary } }),
    });
    const { saveItinerary } = await import('../savedItineraries');
    const saved = await saveItinerary(validItinerary);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/saved-itineraries');
    expect(init.method).toBe('POST');
    const sent = JSON.parse(init.body as string) as typeof validItinerary & { user_id?: string };
    expect(sent.title).toBe(validItinerary.title);
    expect(sent.user_id).toBeUndefined();
    expect(saved.id).toBe('itin-1');
  });

  it('saveItinerary surfaces API detail in the legacy failure message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Failed to save itinerary', details: 'db down' }),
    });
    const { saveItinerary } = await import('../savedItineraries');
    await expect(saveItinerary(validItinerary)).rejects.toThrow(
      'Failed to save itinerary. Details: db down'
    );
  });

  it('getSavedItineraries returns [] on API failure (legacy empty-state contract)', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });
    const { getSavedItineraries } = await import('../savedItineraries');
    await expect(getSavedItineraries()).resolves.toEqual([]);
  });

  it('deleteItinerary issues DELETE against the id route', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    const { deleteItinerary } = await import('../savedItineraries');
    await deleteItinerary('itin-1');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/saved-itineraries/itin-1');
    expect(init.method).toBe('DELETE');
  });

  it('updateItinerary PATCHes refresh metadata through the id route', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 'itin-1' } }),
    });
    const { updateItinerary } = await import('../savedItineraries');
    const updated = await updateItinerary('itin-1', {
      refreshMetadata: { refreshCount: 2 },
      trafficSnapshot: { incidentCount: 0 },
      activityCoordinates: [],
    } as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/saved-itineraries/itin-1');
    expect(init.method).toBe('PATCH');
    const sent = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(sent).toMatchObject({ refreshMetadata: { refreshCount: 2 } });
    expect(updated).toMatchObject({ id: 'itin-1' });
  });
});
