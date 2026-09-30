/**
 * Edge cases for the cross-city curated-image leak.
 *
 * The reported symptom was a Manila place rendering a Baguio place's photo
 * ("Poblacion Market" -> Baguio Night Market, "Robinsons Supermarket Tutuban"
 * -> Mines View Park). The curated catalog is keyed by bare title with no
 * city dimension, and its titles are ordinary venue names that also exist
 * outside Baguio, so a name collision silently produces a wrong-city photo.
 *
 * Every case below is a real collision or a real regression risk, not a
 * restatement of the same assertion.
 */

import { enrichActivitiesWithImages, getAccurateImageForPlace } from '../imageService';

// Titles that are genuinely in CURATED_IMAGE_MAP AND are ordinary venue
// names a non-Baguio city also has. These are the collision surface.
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
    // No Wikimedia thumb, no Unsplash hit: a collision must end with no
    // curated image rather than another city's one.
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
    // No cityId at all: the previous `= "baguio"` default answered here.
    expect(await getAccurateImageForPlace({ title: 'The Mansion' })).toBeNull();
  });

  it('the batch path does not leak either, for a colliding title', async () => {
    const out = await enrichActivitiesWithImages(
      [{ title: 'Botanical Garden', image: '', lat: 14.6, lon: 120.98 }],
      { city: 'Manila', cityId: 'manila' }
    );
    // Falsy, not null: an unresolvable chain preserves the incoming empty
    // string instead of overwriting it. Either way the card falls back —
    // what must never happen is a Baguio photo.
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
    // Tier 0 is documented as "fastest, most accurate for known titles", so
    // for Baguio the curated photo wins over a supplied one. In production
    // they agree — the server allowlist already carries the curated image.
    const out = await enrichActivitiesWithImages(
      [{ title: 'The Mansion', image: 'https://images.unsplash.com/photo-something-else' }],
      { cityId: 'baguio' }
    );
    expect(out[0].image).toBe('/images/the_mansion_baguio.jpg');
  });
});
