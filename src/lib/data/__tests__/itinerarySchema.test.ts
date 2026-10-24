import {
  activitySchema,
  itineraryDataSchema,
  itineraryPayloadSchema,
  planRequestSchema,
  validateItineraryData,
} from '../itinerarySchema';

/**
 * The schema is the single contract between the web generator, the mobile
 * local generator, and the SQLite payload. These tests pin the two shapes the
 * renderer actually consumes (TripDetail's Payload and the web row) so drift
 * between the three surfaces becomes a test failure, not a runtime surprise.
 */
describe('itinerarySchema', () => {
  describe('itineraryDataSchema', () => {
    it('accepts the web generator output shape', () => {
      const data = {
        title: 'Three Days in Baguio',
        subtitle: 'Cool weather, warm food',
        items: [
          {
            period: 'Day 1 Morning',
            activities: [
              {
                title: 'Burnham Park',
                time: '8:00 AM',
                desc: 'Lakeside walk',
                tags: ['Park'],
                image: 'https://example.com/burnham.jpg',
              },
            ],
          },
        ],
      };
      expect(validateItineraryData(data)).toEqual(data);
    });

    it('rejects an itinerary with no periods', () => {
      expect(validateItineraryData({ title: 'x', subtitle: '', items: [] })).toBeNull();
    });

    it('rejects an activity without a title', () => {
      const bad = {
        title: 'x',
        subtitle: '',
        items: [{ period: 'Day 1 Morning', activities: [{ time: '8:00 AM' }] }],
      };
      expect(validateItineraryData(bad)).toBeNull();
    });

    it('applies defaults for optional activity fields', () => {
      const parsed = itineraryDataSchema.parse({
        title: 'x',
        items: [{ period: 'Day 1 Morning', activities: [{ title: 'Burnham Park' }] }],
      });
      expect(parsed.items[0].activities[0]).toMatchObject({ time: '', desc: '', tags: [] });
    });
  });

  describe('itineraryPayloadSchema (SQLite trips.payload contract)', () => {
    it('accepts the web-import payload shape', () => {
      const payload = {
        formData: {
          budget: '3000',
          pax: '2',
          duration: '3',
          dates: { start: '2026-10-03', end: '2026-10-05' },
          selectedInterests: ['Food', 'Nature'],
        },
        itineraryData: {
          title: 'Baguio Trip',
          subtitle: '',
          items: [{ period: 'Day 1 Morning', activities: [{ title: 'Session Road' }] }],
        },
        weatherData: { name: 'Baguio' },
      };
      expect(itineraryPayloadSchema.safeParse(payload).success).toBe(true);
    });

    it('accepts a minimal local fallback payload', () => {
      expect(itineraryPayloadSchema.safeParse({ formData: null, itineraryData: null }).success).toBe(true);
    });
  });

  describe('planRequestSchema', () => {
    it('accepts the mobile Plan screen input', () => {
      expect(
        planRequestSchema.safeParse({
          city: 'baguio',
          budget: 3000,
          pax: 2,
          days: 3,
          startDate: '2026-10-03',
          endDate: '2026-10-05',
          interests: ['Food'],
        }).success
      ).toBe(true);
    });

    it('rejects a zero-day or zero-pax request', () => {
      const base = {
        city: 'baguio',
        budget: 3000,
        pax: 2,
        days: 3,
        startDate: '2026-10-03',
        endDate: '2026-10-05',
        interests: ['Food'],
      };
      expect(planRequestSchema.safeParse({ ...base, days: 0 }).success).toBe(false);
      expect(planRequestSchema.safeParse({ ...base, pax: 0 }).success).toBe(false);
    });
  });

  it('exports the web Activity extras as optional so both surfaces satisfy it', () => {
    const withExtras = activitySchema.safeParse({
      title: 'x',
      time: '',
      desc: '',
      tags: [],
      peakHours: '9AM-11AM',
      relevanceScore: 0.9,
      isCurrentlyPeak: false,
    });
    expect(withExtras.success).toBe(true);
  });
});
