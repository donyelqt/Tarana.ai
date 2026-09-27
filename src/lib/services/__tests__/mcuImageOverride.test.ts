/**
 * Regression: Manila Central University card rendered Far Eastern
 * University's Nicanor Reyes Hall photo.
 *
 * Root cause: MCU's Wikipedia page exists but carries no pageimage
 * thumbnail, so Tier 2 reports a miss and Tier 2b Unsplash returns a
 * textually-near but wrong university photo. The override below pins the
 * verified MCU campus file; this suite fails if the override is removed.
 */

const MCU_OVERRIDE_URL =
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/08/Manila_Central_University%2C_Caloocan%2C_Mar_2024_%281%29.jpg/960px-Manila_Central_University%2C_Caloocan%2C_Mar_2024_%281%29.jpg';

describe('Manila Central University image override', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('serves the verified MCU campus photo without network', async () => {
    const wikiFetch = jest.fn();
    (global as unknown as { fetch: unknown }).fetch = wikiFetch;
    const { getAccurateImageForPlace } = await import('../imageService');

    const url = await getAccurateImageForPlace({ title: 'Manila Central University' });

    expect(url).toBe(MCU_OVERRIDE_URL);
    expect(wikiFetch).not.toHaveBeenCalled();
  });

  it('never serves the FEU Nicanor Reyes Hall photo for MCU', async () => {
    (global as unknown as { fetch: unknown }).fetch = jest.fn();
    const { getAccurateImageForPlace } = await import('../imageService');

    const url = await getAccurateImageForPlace({ title: 'Manila Central University' });

    expect(url).not.toContain('FEU_Nicanor_Reyes_Hall');
  });

  it('leaves other universities on the normal tier chain', async () => {
    const wikiFetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });
    (global as unknown as { fetch: unknown }).fetch = wikiFetch;
    const { getAccurateImageForPlace } = await import('../imageService');

    await getAccurateImageForPlace({ title: 'Far Eastern University', lat: 14.6, lon: 120.98 });

    expect(wikiFetch).toHaveBeenCalled();
  });
  it('never returns a keyed Google photo URL (server key must not leak)', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-places-key';
    const googleFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'OK', results: [{ place_id: 'p1', photos: [{ photo_reference: 'ref1' }] }] }),
    });
    const wikiFetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });
    const unsplashFetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });
    (global as unknown as { fetch: unknown }).fetch = jest.fn((url: unknown) => {
      const s = String(url);
      if (s.includes('maps.googleapis.com')) return googleFetch(s);
      if (s.includes('wikipedia.org')) return wikiFetch(s);
      return unsplashFetch(s);
    });
    const { getAccurateImageForPlace } = await import('../imageService');

    const url = await getAccurateImageForPlace({ title: 'Some Unknown Place XYZ', lat: 14.6, lon: 120.98 });

    expect(url === null || !String(url).includes('test-places-key')).toBe(true);
    if (url !== null) expect(url).not.toContain('maps.googleapis.com/maps/api/place/photo');
    delete process.env.GOOGLE_PLACES_API_KEY;
  });
});
