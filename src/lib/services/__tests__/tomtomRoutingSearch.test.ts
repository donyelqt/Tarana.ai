/**
 * Regression test: TomTom Search must pin `view=Unified` explicitly.
 *
 * Incident (2026-09-12 dev logs): every `searchLocations` call failed with
 * `400 BadRequest: 'PH' is not a valid view`. Root cause: we sent
 * `countrySet=PH` with no `view`, so TomTom derived view=PH from it — and
 * PH is a valid countrySet but not a valid view. Fix: always send
 * `view=Unified` (documented default for non-listed regions).
 * This test fails without the fix (asserts the outgoing query string).
 */

process.env.TOMTOM_API_KEY = 'test-key-for-view-param-test';

// Require (not import): the singleton reads env at module load, and
// ES imports hoist above the assignment above.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { tomtomRoutingService } = require('../tomtomRouting');

function cannedSearchResponse() {
  return {
    summary: {
      query: 'Burnham',
      queryType: 'NON_NEAR',
      queryTime: 12,
      numResults: 1,
      offset: 0,
      totalResults: 1,
      fuzzyLevel: 1,
    },
    results: [
      {
        type: 'POI',
        id: 'poi-burnham-1',
        score: 9.5,
        dist: 500,
        poi: { name: 'Burnham Park', categories: ['park'] },
        address: { freeformAddress: 'Baguio City, Philippines', countryCode: 'PH' },
        position: { lat: 16.4023, lon: 120.596 },
      },
    ],
  };
}

describe('tomtomRouting.searchLocations view param', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('sends view=Unified alongside countrySet=PH', async () => {
    const seenUrls: string[] = [];
    global.fetch = jest.fn(async (url: unknown) => {
      seenUrls.push(String(url));
      return {
        ok: true,
        json: async () => cannedSearchResponse(),
      };
    }) as unknown as typeof fetch;

    const results = await tomtomRoutingService.searchLocations('Burnham Park query');

    expect(seenUrls).toHaveLength(1);
    const url = new URL(seenUrls[0]);
    expect(url.searchParams.get('view')).toBe('Unified');
    expect(url.searchParams.get('countrySet')).toBe('PH');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Burnham Park');
  });

  it('keeps an explicit caller countrySet while still pinning view', async () => {
    const seenUrls: string[] = [];
    global.fetch = jest.fn(async (url: unknown) => {
      seenUrls.push(String(url));
      return {
        ok: true,
        json: async () => ({ ...cannedSearchResponse(), results: [] }),
      };
    }) as unknown as typeof fetch;

    await tomtomRoutingService.searchLocations('Ramen spot', undefined, undefined, {
      countrySet: 'PH',
      language: 'en-US',
    });

    expect(seenUrls).toHaveLength(1);
    const url = new URL(seenUrls[0]);
    expect(url.searchParams.get('view')).toBe('Unified');
  });
});
