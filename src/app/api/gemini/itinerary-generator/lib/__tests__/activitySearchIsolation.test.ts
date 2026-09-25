import { findAndScoreActivities } from '../activitySearch';
import * as touristPoiService from '@/lib/services/touristPoiService';

jest.mock('@/lib/services/touristPoiService', () => ({
  getTouristPois: jest.fn(),
  getInterestPois: jest.fn(async () => []),
  INTEREST_QUERY_MAP: {
    'Food & Culinary': 'restaurants',
    'Nature & Scenery': 'park viewpoint',
    'Culture & Arts': 'museum landmark',
    'Shopping & Local Finds': 'shopping market',
    'Adventure': 'outdoor attraction',
  },
}));

jest.mock('@/lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/lib/search', () => ({
  IntelligentSearchEngine: class {
    async search() {
      return [];
    }
  },
}));

jest.mock('../../agent/agent', () => ({
  proposeSubqueries: jest.fn(async () => []),
}));

// getCityTime uses `new Date()`, NOT Date.now() — spying on Date.now cannot
// control the rotation day. Mock the source of the day index instead.
jest.mock('@/lib/traffic/peakHours', () => ({
  getCityTime: jest.fn(() => new Date('2026-09-01T04:00:00Z')),
}));

const touristPoiMock = touristPoiService.getTouristPois as unknown as jest.Mock;
const interestPoiMock = touristPoiService.getInterestPois as unknown as jest.Mock;

function poi(id: string, name: string, category: string, lat: number, lng: number, score = 9) {
  return {
    id,
    name,
    address: '',
    coordinates: { lat, lng },
    category,
    categories: [category],
    relevanceScore: score,
    popularityIndex: score * 10,
    placeType: 'POI',
  };
}

describe('findAndScoreActivities strict city isolation', () => {
  beforeEach(() => {
    touristPoiMock.mockReset();
    interestPoiMock.mockReset();
    interestPoiMock.mockResolvedValue([]);
  });

  it('returns no Baguio curated activities for a non-Baguio city with zero live POIs', async () => {
    touristPoiMock.mockResolvedValue([]);

    const result = await findAndScoreActivities(
      'A relaxing day in Cebu',
      [],
      'clear',
      1,
      null,
      false,
      'cebu',
    );

    const titles = (result?.items ?? []).flatMap((item) => item.activities.map((a) => a.title));
    const baguioOnly = ['Burnham Park', 'Mines View Park', 'Wright Park', 'Camp John Hay'];
    for (const title of baguioOnly) {
      expect(titles).not.toContain(title);
    }
    expect(result?.searchMetadata?.searchMethod).not.toBe('fallback_empty');
    expect(result?.searchMetadata?.searchMethod).not.toBe('fallback');
  });

  it('still maps live tourist POIs for a non-Baguio city', async () => {
    touristPoiMock.mockResolvedValue([
      {
        id: 'poi-1',
        name: 'Fort San Pedro',
        address: 'Cebu City',
        coordinates: { lat: 10.292, lng: 123.906 },
        category: 'important tourist attraction',
        categories: ['important tourist attraction'],
        relevanceScore: 9,
        popularityIndex: 90,
        placeType: 'POI',
      },
    ]);

    const result = await findAndScoreActivities(
      'A relaxing day in Cebu',
      [],
      'clear',
      1,
      null,
      false,
      'cebu',
    );

    const titles = (result?.items ?? []).flatMap((item) => item.activities.map((a) => a.title));
    expect(titles).toContain('Fort San Pedro');
  });

  it('does not fall back to Baguio curated activities when the POI service throws', async () => {
    touristPoiMock.mockRejectedValue(new Error('upstream down'));

    const result = await findAndScoreActivities(
      'A rainy day in Davao',
      [],
      'rainy',
      1,
      null,
      false,
      'davao',
    );

    const titles = (result?.items ?? []).flatMap((item) => item.activities.map((a) => a.title));
    const baguioOnly = ['Burnham Park', 'Mines View Park', 'Wright Park', 'Camp John Hay'];
    for (const title of baguioOnly) {
      expect(titles).not.toContain(title);
    }
    expect(result?.searchMetadata?.searchMethod).not.toBe('fallback');
    expect(result?.searchMetadata?.searchMethod).not.toBe('fallback_empty');
  });

  it('lets stated interests drive retrieval, and ranks them ahead of tourist POIs', async () => {
    // Interest layer returns a restaurant the tourist allowlist would reject.
    interestPoiMock.mockResolvedValue([
      poi('r1', 'Manila Bistro', 'restaurant', 14.59, 120.98, 1),
    ]);
    // Tourist layer returns a much higher-scoring landmark.
    touristPoiMock.mockResolvedValue([
      poi('t1', 'Rizal Monument', 'important tourist attraction', 14.58, 120.98, 99),
    ]);

    const result = await findAndScoreActivities(
      'A food trip in Manila',
      ['Food & Culinary'],
      'clear',
      1,
      null,
      false,
      'manila',
    );

    const titles = (result?.items ?? []).flatMap((item) => item.activities.map((a) => a.title));
    expect(titles).toContain('Manila Bistro');
    expect(titles).toContain('Rizal Monument');
    // Interest match must lead despite the tourist POI's far higher score.
    expect(titles.indexOf('Manila Bistro')).toBeLessThan(titles.indexOf('Rizal Monument'));
    expect(interestPoiMock).toHaveBeenCalledWith('manila', ['Food & Culinary'], 20);
  });

  it('keeps interest matches in the leading slots on every rotation day', async () => {
    const peakHours = jest.requireMock('@/lib/traffic/peakHours') as { getCityTime: jest.Mock };

    // 6 tourists so rotation genuinely moves the tail to the front.
    touristPoiMock.mockResolvedValue([
      poi('t1', 'Tourist A', 'park', 14.50, 120.90, 90),
      poi('t2', 'Tourist B', 'park', 14.51, 120.91, 89),
      poi('t3', 'Tourist C', 'park', 14.52, 120.92, 88),
      poi('t4', 'Tourist D', 'park', 14.53, 120.93, 87),
      poi('t5', 'Tourist E', 'park', 14.54, 120.94, 86),
      poi('t6', 'Tourist F', 'park', 14.55, 120.95, 85),
    ]);
    interestPoiMock.mockResolvedValue([
      poi('r1', 'Interest One', 'restaurant', 14.60, 120.98, 5),
      poi('r2', 'Interest Two', 'restaurant', 14.61, 120.99, 4),
    ]);

    const runForDay = async (dayOffset: number) => {
      peakHours.getCityTime.mockReturnValue(new Date(Date.UTC(2026, 8, 1 + dayOffset, 4, 0, 0)));
      const result = await findAndScoreActivities(
        'A food trip in Manila',
        ['Food & Culinary'],
        'clear',
        1,
        null,
        false,
        'manila',
      );
      return (result?.items ?? []).flatMap((item) => item.activities.map((a) => a.title));
    };

    // With the bug (rotate the MERGED list) the leading slots become tourist
    // rows on days where the offset is non-zero. Assert the real invariant:
    // both interest matches occupy the first two positions, every day.
    for (let day = 0; day < 4; day++) {
      const titles = await runForDay(day);
      expect(titles.slice(0, 2)).toEqual(['Interest One', 'Interest Two']);
      for (const name of ['Tourist A', 'Tourist B', 'Tourist C', 'Tourist D', 'Tourist E', 'Tourist F']) {
        expect(titles.indexOf(name)).toBeGreaterThan(1);
      }
    }
  });
});
