import {
  getTouristPois,
  getInterestPois,
  TOURIST_QUERY_BUCKETS,
  INTEREST_QUERY_LIMIT,
  INTEREST_RAW_LIMIT,
  type TouristPoiDeps,
} from '../touristPoiService';
import type { SearchResult } from '@/types/route-optimization';

const poi = (overrides: Partial<SearchResult> = {}): SearchResult => ({
  id: 'poi-1',
  name: 'Tourist Spot',
  address: 'Cebu',
  coordinates: { lat: 10.3157, lng: 123.8854 },
  category: 'tourist attraction',
  categories: ['tourist attraction'],
  categorySet: [1],
  relevanceScore: 9,
  popularityIndex: 90,
  placeType: 'POI',
  ...overrides,
});

function deps(overrides: Partial<TouristPoiDeps> = {}): TouristPoiDeps & {
  searchPois: jest.Mock;
  readFresh: jest.Mock;
  writeFresh: jest.Mock;
} {
  return {
    searchPois: jest.fn().mockResolvedValue([]),
    readFresh: jest.fn().mockResolvedValue([]),
    writeFresh: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as never;
}

describe('touristPoiService.getTouristPois', () => {
  it('returns [] for a non-target city and never calls upstream', async () => {
    const d = deps();
    expect(await getTouristPois('baguio', 50, d)).toEqual([]);
    expect(d.searchPois).not.toHaveBeenCalled();
    expect(d.readFresh).not.toHaveBeenCalled();
  });

  it('serves fresh cache rows without calling TomTom when coverage is sufficient', async () => {
    const rows = Array.from({ length: 50 }, (_, i) =>
      poi({ id: `poi-${i}`, name: `Cached Spot ${i}`, coordinates: { lat: 10.2 + i * 0.001, lng: 123.8 + i * 0.001 } })
    );
    const d = deps({ readFresh: jest.fn().mockResolvedValue(rows) });

    const result = await getTouristPois('cebu', 50, d);

    expect(result).toHaveLength(50);
    expect(d.searchPois).not.toHaveBeenCalled();
    expect(d.writeFresh).not.toHaveBeenCalled();
  });

  it('backfills through TomTom when fresh cache coverage is insufficient', async () => {
    const d = deps({ searchPois: jest.fn().mockResolvedValue([poi()]) });

    const result = await getTouristPois('cebu', 50, d);

    expect(result).toHaveLength(1);
    expect(d.searchPois).toHaveBeenCalledTimes(TOURIST_QUERY_BUCKETS.length);
    expect(d.writeFresh).toHaveBeenCalledWith('cebu', expect.arrayContaining([expect.objectContaining({ id: 'poi-1' })]));
  });

  it('does not write cached rows back as if they were new', async () => {
    const cached = poi({ id: 'cached-1', name: 'Cached Spot' });
    const fresh = poi({ id: 'fresh-1', name: 'Fresh Spot', coordinates: { lat: 10.32, lng: 123.9 } });
    const d = deps({
      readFresh: jest.fn().mockResolvedValue([cached]),
      searchPois: jest.fn().mockResolvedValue([cached, fresh]),
    });

    await getTouristPois('cebu', 50, d);

    const written = d.writeFresh.mock.calls[0][1] as SearchResult[];
    expect(written.map((r) => r.id)).toEqual(['fresh-1']);
  });

  it('returns an honest empty result when upstream yields nothing', async () => {
    const d = deps();
    expect(await getTouristPois('davao', 50, d)).toEqual([]);
    expect(d.writeFresh).not.toHaveBeenCalled();
  });

  it('clamps the requested limit to the reviewed 50 cap', async () => {
    const rows = Array.from({ length: 60 }, (_, i) =>
      poi({ id: `poi-${i}`, name: `Cached Spot ${i}`, coordinates: { lat: 10.2 + i * 0.001, lng: 123.8 + i * 0.001 } })
    );
    const d = deps({ readFresh: jest.fn().mockResolvedValue(rows) });

    const result = await getTouristPois('cebu', 500, d);

    expect(result).toHaveLength(50);
  });

  it('continues buckets until the accepted target is reached', async () => {
    // Every bucket returns one in-bounds tourist POI; the loop must not stop
    // after the first bucket just because it returned a full raw batch.
    const d = deps({
      searchPois: jest.fn(async (query: string) => [
        poi({
          id: query,
          name: query,
          coordinates: { lat: 10.3, lng: 123.9 },
        }),
      ]),
    });

    const result = await getTouristPois('cebu', 3, d);

    expect(result.length).toBe(3);
    expect(d.searchPois).toHaveBeenCalledTimes(3);
  });

  it('does not rewrite cached rows whose provider id is already present', async () => {
    const cached = poi({ id: 'poi-1', name: 'Cached Spot' });
    const fresh = poi({ id: 'poi-new', name: 'Fresh Spot', coordinates: { lat: 10.32, lng: 123.9 } });
    const d = deps({
      readFresh: jest.fn().mockResolvedValue([cached]),
      searchPois: jest.fn().mockResolvedValue([cached, fresh]),
    });

    await getTouristPois('cebu', 50, d);

    const written = d.writeFresh.mock.calls[0]?.[1] as SearchResult[] | undefined;
    expect(written?.map((r) => r.id)).toEqual(['poi-new']);
  });

  it('serves fresh cache rows instead of failing when upstream throws', async () => {
    const cached = poi({ id: 'cached-1', name: 'Cached Spot' });
    const d = deps({
      readFresh: jest.fn().mockResolvedValue([cached]),
      searchPois: jest.fn().mockRejectedValue(new Error('upstream down')),
    });

    const result = await getTouristPois('cebu', 50, d);

    expect(result.map((r) => r.id)).toEqual(['cached-1']);
    expect(d.writeFresh).not.toHaveBeenCalled();
  });

  it('returns an empty array rather than throwing when upstream fails with no cache', async () => {
    const d = deps({ searchPois: jest.fn().mockRejectedValue(new Error('upstream down')) });

    await expect(getTouristPois('davao', 50, d)).resolves.toEqual([]);
  });
});

describe('touristPoiService.getInterestPois', () => {
  it('queries the interest term and returns non-tourist POIs the allowlist would reject', async () => {
    const d = deps({
      searchPois: jest.fn().mockResolvedValue([
        // A restaurant: rejected by isTouristPoi, allowed by the interest layer.
        poi({
          id: 'r1',
          name: 'Manila Bistro',
          category: 'restaurant',
          categories: ['restaurant'],
          coordinates: { lat: 14.59, lng: 120.98 },
        }),
      ]),
    });

    const result = await getInterestPois('manila', ['Food & Culinary'], 20, d);

    expect(d.searchPois).toHaveBeenCalledWith(
      'restaurants Manila',
      expect.anything(),
      expect.objectContaining({ limit: INTEREST_RAW_LIMIT })
    );
    expect(result.map((r) => r.id)).toEqual(['r1']);
  });

  it('is bounded to the configured number of interest queries', async () => {
    const d = deps({ searchPois: jest.fn().mockResolvedValue([]) });

    await getInterestPois(
      'cebu',
      ['Food & Culinary', 'Nature & Scenery', 'Culture & Arts', 'Adventure'],
      20,
      d
    );

    expect(d.searchPois).toHaveBeenCalledTimes(INTEREST_QUERY_LIMIT);
  });

  it('ignores Random and empty labels without calling upstream', async () => {
    const d = deps();

    expect(await getInterestPois('cebu', ['Random', ''], 20, d)).toEqual([]);
    expect(d.searchPois).not.toHaveBeenCalled();
  });

  it('returns nothing for a non-target scope', async () => {
    const d = deps();

    expect(await getInterestPois('baguio', ['Food & Culinary'], 20, d)).toEqual([]);
    expect(d.searchPois).not.toHaveBeenCalled();
  });

  it('still returns structural in-city results and drops out-of-bounds ones', async () => {
    const d = deps({
      searchPois: jest.fn().mockResolvedValue([
        poi({ id: 'in', name: 'In City', category: 'restaurant', categories: ['restaurant'], coordinates: { lat: 14.59, lng: 120.98 } }),
        poi({ id: 'out', name: 'Out City', category: 'restaurant', categories: ['restaurant'], coordinates: { lat: 16.4, lng: 120.6 } }),
      ]),
    });

    const result = await getInterestPois('manila', ['Food & Culinary'], 20, d);

    expect(result.map((r) => r.id)).toEqual(['in']);
  });
});
