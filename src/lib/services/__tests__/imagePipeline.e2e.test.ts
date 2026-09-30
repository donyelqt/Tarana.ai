/**
 * End-to-end image pipeline, network boundary mocked.
 *
 * The reported symptom was a split verdict: the log said
 * `Image for "Luneta Park": tier=unsplash` and the card still rendered the
 * logo. A unit test on `getAccurateImageForPlace` cannot see that — the
 * image can be resolved correctly and then destroyed further downstream.
 *
 * So this drives the REAL pipeline end to end and only stubs `fetch` at the
 * process boundary:
 *
 *   findAndScoreActivities-shaped enriched activities (image: "")
 *     -> enrichActivitiesWithImages        (real tier chain, real curated map)
 *     -> server allowlist                  (real searchMetadata shape)
 *     -> Gemini-shaped model output        (NO searchMetadata - it never has one)
 *     -> handleItineraryProcessing(allowlist)
 *     -> the response the browser receives
 *
 * The assertion is on the final object: the URL the tier chain resolved must
 * be the URL in the response. If any step in between substitutes a
 * placeholder, this fails.
 */

import { enrichActivitiesWithImages } from '../imageService';
import { handleItineraryProcessing } from '@/app/api/gemini/itinerary-generator/lib/responseHandler';

jest.mock('@/lib/observability/httpMetrics', () => ({
  timedHttp: (_route: string, _m: string, fn: () => Promise<unknown>) => fn(),
  observeHttp: jest.fn(),
  snapshotHttpMetrics: () => [],
  renderPrometheusExposition: () => '',
  toStatusClass: (s: number) => (s < 300 ? '2xx' : s < 500 ? '4xx' : '5xx'),
  resetHttpMetrics: jest.fn(),
  DURATION_BUCKETS: [],
}));

const UNSPLASH_URL = 'https://images.unsplash.com/photo-luneta-park-abc?w=1200';

function unsplashHit() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ results: [{ urls: { regular: UNSPLASH_URL } }] }),
  };
}

describe('resolved images survive to the response', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    process.env.UNSPLASH_ACCESS_KEY = 'test-unsplash-key';
    fetchMock = jest.fn(async (url: unknown) => {
      const s = String(url);
      // Wikimedia: no pageimage thumbnail for these titles (the real miss).
      if (s.includes('wikipedia.org')) {
        return { ok: true, status: 200, json: async () => ({ query: { pages: {} } }) };
      }
      if (s.includes('api.unsplash.com')) return unsplashHit();
      return { ok: false, status: 404, json: async () => ({}) };
    });
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
  });

  afterEach(() => {
    delete process.env.UNSPLASH_ACCESS_KEY;
  });

  it('hands the browser the Unsplash URL the tier chain resolved', async () => {
    const { enrichActivitiesWithImages: enrich } = await import('../imageService');
    const { handleItineraryProcessing: handle } = await import(
      '@/app/api/gemini/itinerary-generator/lib/responseHandler'
    );

    // Manila path: not curated, arrives with an empty image.
    const candidates = [{ title: 'Luneta Park', lat: 14.6, lon: 120.98, image: '' }];

    const enriched = await enrich(candidates, { city: 'Manila' });
    const resolved = enriched[0].image;
    expect(resolved).toBe(UNSPLASH_URL);

    // searchMetadata as findAndScoreActivities actually builds it.
    const allowlist = enriched.map((a) => ({
      image: a.image,
      title: a.title,
      time: '9:00-11:00AM',
      desc: 'Canonical desc.',
      tags: ['Nature & Scenery'],
    }));

    // Model output: schema-valid, and — as GuaranteedJsonEngine returns it —
    // carries no searchMetadata at all.
    const modelOutput = {
      title: 'Manila Itinerary',
      subtitle: 'One day',
      items: [
        {
          period: 'Day 1 - Morning',
          activities: [
            { title: 'Luneta Park', image: UNSPLASH_URL, time: '9:00-11:00AM', desc: 'Model desc.', tags: ['Nature & Scenery'] },
          ],
        },
        { period: 'Day 1 - Afternoon', activities: [], reason: 'rest' },
        { period: 'Day 1 - Evening', activities: [], reason: 'rest' },
      ],
    };

    const response = await handle(modelOutput, 'plan', 1, 'peak', allowlist);

    const activity = (response.items[0].activities as Array<{ title: string; image: unknown }>)[0];
    expect(activity.title).toBe('Luneta Park');
    expect(activity.image).toBe(UNSPLASH_URL);
  });

  it('still degrades an unresolvable place to the logo, not a phantom 404 path', async () => {
    const { enrichActivitiesWithImages: enrich } = await import('../imageService');
    const { handleItineraryProcessing: handle } = await import(
      '@/app/api/gemini/itinerary-generator/lib/responseHandler'
    );

    // No Wikipedia thumb, no Unsplash hit -> tier chain returns null.
    fetchMock.mockImplementation(async (url: unknown) => {
      const s = String(url);
      if (s.includes('api.unsplash.com')) {
        return { ok: true, status: 200, json: async () => ({ results: [] }) };
      }
      return { ok: true, status: 200, json: async () => ({ query: { pages: {} } }) };
    });

    const enriched = await enrich([{ title: 'Arroceros Forest Park', lat: 14.6, lon: 120.98, image: '' }], {
      city: 'Manila',
    });
    // Preserved-as-empty rather than null; both fall back downstream.
    expect(enriched[0].image).toBeFalsy();

    const allowlist = [
      {
        image: null,
        title: 'Arroceros Forest Park',
        time: '2:00-4:00PM',
        desc: 'Canonical desc.',
        tags: ['Nature & Scenery'],
      },
    ];
    const response = await handle(
      {
        title: 'Manila Itinerary',
        subtitle: 'One day',
        items: [
          {
            period: 'Day 1 - Morning',
            activities: [
              { title: 'Arroceros Forest Park', image: UNSPLASH_URL, time: '2:00-4:00PM', desc: 'Model desc.', tags: ['Nature & Scenery'] },
            ],
          },
          { period: 'Day 1 - Afternoon', activities: [], reason: 'rest' },
          { period: 'Day 1 - Evening', activities: [], reason: 'rest' },
        ],
      },
      'plan',
      1,
      'peak',
      allowlist
    );

    const activity = (response.items[0].activities as Array<{ image: unknown }>)[0];
    // A real asset the browser can load, so onError never fires.
    expect(activity.image).toBe('/images/taranaai.png');
  });
});
