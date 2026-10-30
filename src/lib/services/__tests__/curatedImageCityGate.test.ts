
import { enrichActivitiesWithImages, getAccurateImageForPlace } from '../imageService';

const COLLIDING = [
  'The Mansion',
  'Botanical Garden',
  'Wright Park',
  'Baguio Cathedral',
] as const;

describe('curated catalog is Baguio-only', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.UNSPLASH_ACCESS_KEY;
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ query: { pages: {} }, results: [] }),
    });
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('fixtures are real: these titles really are curated', async () => {
    for (const title of COLLIDING) {
      const baguio = await getAccurateImageForPlace({ title, cityId: 'baguio' });
      expect(baguio).toMatch(/^\/images\//);
    }
  });

  for (const cityId of ['manila', 'cebu', 'davao', 'boracay', 'el_nido'] as const) {
    it(`a "${cityId}" place named like a Baguio one gets no Baguio photo`, async () => {
      for (const title of COLLIDING) {
        const url = await getAccurateImageForPlace({ title, cityId });
        expect(url).toBeNull();
      }
    });
  }

  it('an unknown city fails closed rather than open', async () => {
    expect(await getAccurateImageForPlace({ title: 'The Mansion' })).toBeNull();
  });

  it('the batch path does not leak either, for a colliding title', async () => {
    const out = await enrichActivitiesWithImages(
      [{ title: 'Botanical Garden', image: '', lat: 14.6, lon: 120.98 }],
      { city: 'Manila', cityId: 'manila' }
    );
    expect(out[0].image).toBeFalsy();
  });

  it('the batch path still serves Baguio (no over-correction)', async () => {
    const out = await enrichActivitiesWithImages(
      [{ title: 'Botanical Garden', image: '' }],
      { city: 'Baguio City', cityId: 'baguio' }
    );
    expect(out[0].image).toBe('/images/botanicalbaguio.jpg');
  });

  it('does not hit the network at all for a Baguio curated title', async () => {
    await enrichActivitiesWithImages([{ title: 'Wright Park', image: '' }], { cityId: 'baguio' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never overwrites a server-supplied image outside Baguio', async () => {
    const supplied = 'https://images.unsplash.com/photo-real-manila-mansion';
    for (const cityId of ['manila', 'cebu', 'davao', 'boracay', 'el_nido'] as const) {
      const out = await enrichActivitiesWithImages(
        [{ title: 'The Mansion', image: supplied }],
        { cityId }
      );
      expect(out[0].image).toBe(supplied);
    }
  });

  it('keeps the curated catalog authoritative for Baguio (by design)', async () => {
    const out = await enrichActivitiesWithImages(
      [{ title: 'The Mansion', image: 'https://images.unsplash.com/photo-something-else' }],
      { cityId: 'baguio' }
    );
    expect(out[0].image).toBe('/images/the_mansion_baguio.jpg');
  });
});
