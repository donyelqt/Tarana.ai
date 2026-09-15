import { normalizeImagePath, getFallbackImage } from '@/lib/images/imageUtils';
import { mapRowToSavedItinerary } from '@/lib/data/itineraryMapper';

/**
 * The collection/[id] routes must serve the exact shape the saved-trips UI
 * destructures (camelCase + normalized image). These tests pin that contract
 * against raw DB rows, including legacy JSON-text columns.
 */
describe('saved-itineraries mapper', () => {
  const row = {
    id: 'itin-1',
    title: 'Your 1 Day Itinerary',
    date: 'June 13, 2026 - June 14, 2026',
    budget: 'Budget',
    image: 'images/burnham.jpg',
    tags: ['Nature & Scenery'],
    form_data: {
      budget: 'Budget',
      pax: 'Solo',
      duration: '1 Day',
      dates: { start: '2026-06-13T00:00:00.000Z', end: '2026-06-14T00:00:00.000Z' },
      selectedInterests: ['Nature & Scenery'],
    },
    itinerary_data: {
      title: 'Baguio Day',
      subtitle: 'One day highlights',
      items: [{ period: 'Morning', activities: [] }],
    },
    weather_data: { name: 'Baguio' },
    created_at: '2026-09-15T00:00:00.000Z',
    refresh_metadata: { refreshCount: 2 },
    traffic_snapshot: { incidentCount: 0 },
    activity_coordinates: [{ lat: 16.4023, lon: 120.596, name: 'Burnham Park' }],
  };

  it('maps snake_case rows to the UI shape with a normalized image', () => {
    const mapped = mapRowToSavedItinerary(row);
    expect(mapped.image).toBe(normalizeImagePath('images/burnham.jpg'));
    expect(mapped.createdAt).toBe(row.created_at);
    expect(mapped.formData.budget).toBe('Budget');
    expect(mapped.itineraryData.items).toHaveLength(1);
    expect(mapped.weatherData?.name).toBe('Baguio');
    expect(mapped.refreshMetadata?.refreshCount).toBe(2);
    expect(mapped.trafficSnapshot?.incidentCount).toBe(0);
    expect(mapped.activityCoordinates?.[0]?.name).toBe('Burnham Park');
  });

  it('parses legacy JSON-text columns to objects', () => {
    const mapped = mapRowToSavedItinerary({
      ...row,
      form_data: JSON.stringify(row.form_data),
      itinerary_data: JSON.stringify(row.itinerary_data),
    });
    expect(mapped.formData.pax).toBe('Solo');
    expect(mapped.itineraryData.title).toBe('Baguio Day');
  });

  it('falls back to a tag-based image when the stored path is empty', () => {
    const mapped = mapRowToSavedItinerary({ ...row, image: '' });
    expect(mapped.image).toBe(getFallbackImage(row.tags));
  });

  it('preserves explicit null refresh columns as undefined rather than crashing', () => {
    const mapped = mapRowToSavedItinerary({
      ...row,
      refresh_metadata: null,
      traffic_snapshot: null,
      activity_coordinates: null,
      weather_data: null,
    });
    expect(mapped.refreshMetadata).toBeUndefined();
    expect(mapped.trafficSnapshot).toBeUndefined();
    expect(mapped.activityCoordinates).toBeUndefined();
    expect(mapped.weatherData).toBeUndefined();
  });
});
