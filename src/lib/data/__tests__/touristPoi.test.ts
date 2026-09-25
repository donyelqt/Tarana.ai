import { isTouristPoi, selectTouristPois, mergeInterestFirst } from '../touristPoi';
import type { SearchResult } from '@/types/route-optimization';

const base = (overrides: Partial<SearchResult> = {}): SearchResult => ({
  id: 'poi-1',
  name: 'Burnham Park',
  address: 'Baguio',
  coordinates: { lat: 10.3157, lng: 123.8854 },
  category: 'park',
  categories: ['park'],
  categorySet: [123],
  relevanceScore: 9,
  popularityIndex: 90,
  placeType: 'POI',
  ...overrides,
});

describe('touristPoi', () => {
  it('accepts an in-bounds tourist POI', () => {
    expect(isTouristPoi(base(), 'cebu')).toBe(true);
  });

  it('rejects a non-POI address result', () => {
    expect(isTouristPoi(base({ placeType: 'Street' }), 'cebu')).toBe(false);
  });

  it('rejects a POI outside the target city bounds', () => {
    expect(isTouristPoi(base({ coordinates: { lat: 16.4, lng: 120.6 } }), 'cebu')).toBe(false);
  });

  it('rejects a generic business category', () => {
    expect(isTouristPoi(base({ category: 'office', categories: ['office'] }), 'cebu')).toBe(false);
    expect(isTouristPoi(base({ category: 'restaurant', categories: ['restaurant'] }), 'cebu')).toBe(false);
  });

  it('rejects unknown categories instead of padding the target count', () => {
    expect(isTouristPoi(base({ category: 'unknown', categories: ['unknown'] }), 'cebu')).toBe(false);
  });

  it('keeps distinct venues that share coordinates', () => {
    const first = base({ id: 'a', name: 'Manila City Hall', coordinates: { lat: 14.59, lng: 120.98 } });
    const second = base({ id: 'b', name: 'Manila City Hall Annex', coordinates: { lat: 14.59, lng: 120.98 } });
    expect(selectTouristPois([first, second], 'manila')).toHaveLength(2);
  });

  it('collapses provider duplicates by id', () => {
    const first = base({ id: 'same', relevanceScore: 9 });
    const second = base({ id: 'same', relevanceScore: 7 });
    expect(selectTouristPois([first, second], 'cebu')).toHaveLength(1);
  });

  it('collapses name-plus-coordinate duplicates and keeps the best score', () => {
    const first = base({ id: 'a', relevanceScore: 5 });
    const second = base({ id: 'b', relevanceScore: 9 });
    const selected = selectTouristPois([first, second], 'cebu');
    expect(selected).toHaveLength(1);
    expect(selected[0].id).toBe('b');
  });

  it('caps the accepted pool at the requested limit', () => {
    const rows = Array.from({ length: 60 }, (_, i) =>
      base({
        id: `poi-${i}`,
        name: `Tourist Spot ${i}`,
        coordinates: { lat: 10.2 + i * 0.001, lng: 123.8 + i * 0.001 },
      })
    );
    expect(selectTouristPois(rows, 'cebu', 50)).toHaveLength(50);
  });

  it('accepts historical/historical-site categories as whole words', () => {
    expect(isTouristPoi(base({ category: 'historical', categories: ['historical'] }), 'cebu')).toBe(true);
    expect(isTouristPoi(base({ category: 'historical site', categories: ['historical site'] }), 'cebu')).toBe(true);
  });

  it('does not false-accept short terms inside unrelated words', () => {
    expect(isTouristPoi(base({ category: 'churchill', categories: ['churchill'] }), 'cebu')).toBe(false);
    expect(isTouristPoi(base({ category: 'lakeland', categories: ['lakeland'] }), 'cebu')).toBe(false);
    expect(isTouristPoi(base({ category: 'trailers', categories: ['trailers'] }), 'cebu')).toBe(false);
  });

  it('normalizes placeType case and whitespace', () => {
    expect(isTouristPoi(base({ placeType: 'POI' }), 'cebu')).toBe(true);
    expect(isTouristPoi(base({ placeType: ' poi ' }), 'cebu')).toBe(true);
    expect(isTouristPoi(base({ placeType: 'Point of Interest' }), 'cebu')).toBe(false);
  });

  it('rejects missing id, missing name, and non-finite coordinates', () => {
    expect(isTouristPoi(base({ id: '' }), 'cebu')).toBe(false);
    expect(isTouristPoi(base({ name: '' }), 'cebu')).toBe(false);
    expect(isTouristPoi(base({ coordinates: { lat: Number.NaN, lng: 123.9 } }), 'cebu')).toBe(false);
  });

  it('returns an empty array for empty input', () => {
    expect(selectTouristPois([], 'cebu')).toEqual([]);
  });
});

describe('mergeInterestFirst', () => {
  it('ranks an interest match above a higher-scoring tourist POI', () => {
    const restaurant = {
      id: 'r1', name: 'Manila Bistro', address: 'Manila',
      coordinates: { lat: 14.59, lng: 120.98 },
      category: 'restaurant', categories: ['restaurant'],
      relevanceScore: 1, popularityIndex: 10, placeType: 'POI',
    } as SearchResult;
    const landmark = {
      id: 't1', name: 'Rizal Monument', address: 'Manila',
      coordinates: { lat: 14.58, lng: 120.98 },
      category: 'tourist attraction', categories: ['tourist attraction'],
      relevanceScore: 99, popularityIndex: 100, placeType: 'POI',
    } as SearchResult;

    const merged = mergeInterestFirst([restaurant], [landmark], 'manila', 50);

    expect(merged.map((r) => r.id)).toEqual(['r1', 't1']);
  });

  it('fills remaining slots from the tourist layer and dedupes across layers', () => {
    const shared = {
      id: 'dup', name: 'Shared Spot', address: 'Manila',
      coordinates: { lat: 14.59, lng: 120.98 },
      category: 'tourist attraction', categories: ['tourist attraction'],
      relevanceScore: 5, popularityIndex: 50, placeType: 'POI',
    } as SearchResult;
    const extra = {
      id: 't2', name: 'Extra Spot', address: 'Manila',
      coordinates: { lat: 14.6, lng: 120.99 },
      category: 'park', categories: ['park'],
      relevanceScore: 5, popularityIndex: 50, placeType: 'POI',
    } as SearchResult;

    const merged = mergeInterestFirst([shared], [shared, extra], 'manila', 50);

    expect(merged.map((r) => r.id)).toEqual(['dup', 't2']);
  });

  it('drops out-of-city rows from both layers', () => {
    const out = {
      id: 'out', name: 'Out', address: '',
      coordinates: { lat: 16.4, lng: 120.6 },
      category: 'restaurant', categories: ['restaurant'],
      relevanceScore: 9, popularityIndex: 90, placeType: 'POI',
    } as SearchResult;

    expect(mergeInterestFirst([out], [out], 'manila', 50)).toEqual([]);
  });
});
