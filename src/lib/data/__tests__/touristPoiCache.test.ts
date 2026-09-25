import { readFreshPlaces, upsertTouristPlaces, isTouristPoiCacheEnabled } from '../touristPoiCache';
import { supabaseAdmin } from '@/lib/data/supabaseAdmin';
import { logger } from '@/lib/observability/logger';
import type { SearchResult } from '@/types/route-optimization';

jest.mock('@/lib/data/supabaseAdmin', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

jest.mock('@/lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const fromMock = supabaseAdmin.from as unknown as jest.Mock;

const poi: SearchResult = {
  id: 'poi-1',
  name: 'Fort San Pedro',
  address: 'Cebu City',
  coordinates: { lat: 10.292, lng: 123.906 },
  category: 'important tourist attraction',
  categories: ['important tourist attraction'],
  categorySet: [1234],
  relevanceScore: 9,
  popularityIndex: 90,
  placeType: 'POI',
};

function chain(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  for (const method of ['select', 'eq', 'or', 'order', 'limit', 'upsert']) {
    builder[method] = jest.fn(() => builder);
  }
  builder.limit = jest.fn(async () => result);
  builder.upsert = jest.fn(async () => result);
  return builder;
}

describe('touristPoiCache', () => {
  const originalFlag = process.env.TOURIST_POI_CACHE_ENABLED;

  beforeEach(() => {
    fromMock.mockReset();
    jest.clearAllMocks();
    delete process.env.TOURIST_POI_CACHE_ENABLED;
  });

  afterAll(() => {
    if (originalFlag === undefined) delete process.env.TOURIST_POI_CACHE_ENABLED;
    else process.env.TOURIST_POI_CACHE_ENABLED = originalFlag;
  });

  it('is enabled by default and disabled only by the literal "false"', () => {
    expect(isTouristPoiCacheEnabled()).toBe(true);
    process.env.TOURIST_POI_CACHE_ENABLED = 'false';
    expect(isTouristPoiCacheEnabled()).toBe(false);
  });

  it('normalizes cached rows back to the raw provider id', async () => {
    fromMock.mockReturnValue(chain({
      data: [{
        id: 'cebu:poi-1',
        city_id: 'cebu',
        title: 'Fort San Pedro',
        lat: 10.292,
        lon: 123.906,
        category: 'important tourist attraction',
        metadata: {
          tomtomId: 'poi-1',
          score: 9,
          categories: ['important tourist attraction'],
          categorySet: [1234],
          address: 'Cebu City',
        },
      }],
      error: null,
    }));

    const rows = await readFreshPlaces('cebu', 50);

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('poi-1');
    expect(rows[0].name).toBe('Fort San Pedro');
    expect(rows[0].placeType).toBe('POI');
  });

  it('degrades to an empty result on database error', async () => {
    fromMock.mockReturnValue(chain({ data: null, error: { message: 'denied' } }));

    expect(await readFreshPlaces('manila', 50)).toEqual([]);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('returns an empty result when the cache is disabled without querying', async () => {
    process.env.TOURIST_POI_CACHE_ENABLED = 'false';

    expect(await readFreshPlaces('davao', 50)).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('writes provider-prefixed ids with provenance and expiry', async () => {
    const builder = chain({ data: null, error: null });
    fromMock.mockReturnValue(builder);

    await upsertTouristPlaces('cebu', [poi]);

    const rows = builder.upsert.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows[0]).toMatchObject({
      id: 'cebu:poi-1',
      city_id: 'cebu',
      title: 'Fort San Pedro',
      source: 'tomtom',
    });
    expect(typeof rows[0].valid_until).toBe('string');
    expect((rows[0].metadata as Record<string, unknown>).tomtomId).toBe('poi-1');
  });

  it('never throws when the write fails', async () => {
    const builder = chain({ data: null, error: { message: 'denied' } });
    fromMock.mockReturnValue(builder);

    await expect(upsertTouristPlaces('cebu', [poi])).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('skips the write entirely for an empty result set', async () => {
    const builder = chain({ data: null, error: null });
    fromMock.mockReturnValue(builder);

    await upsertTouristPlaces('cebu', []);

    expect(builder.upsert).not.toHaveBeenCalled();
  });
});
