/**
 * Tests for GET /api/spots?city= (dashboard Suggested Spots scope).
 * Baguio serves the curated pool (no enrichment); other cities serve live
 * TomTom search enriched with real photos + measured traffic.
 * Unknown cities 400; TomTom failures degrade to an empty pool (never 500).
 */
import { GET } from '../route';
import { tomtomRoutingService } from '@/lib/services/tomtomRouting';
import { tomtomTrafficService } from '@/lib/traffic/tomtomTraffic';
import { enrichActivitiesWithImages } from '@/lib/services/imageService';

jest.mock('@/lib/services/tomtomRouting', () => ({
  tomtomRoutingService: { searchLocations: jest.fn() },
}));

jest.mock('@/lib/traffic/tomtomTraffic', () => ({
  tomtomTrafficService: { getLocationTrafficData: jest.fn() },
}));

jest.mock('@/lib/services/imageService', () => ({
  enrichActivitiesWithImages: jest.fn(),
}));

// jest.setup.js replaces global Response with a minimal mock lacking the
// static json() NextResponse.json() delegates to. Restore just that static.
const MockedResponse = globalThis.Response as unknown as {
  new (body?: unknown, init?: { status?: number; headers?: Record<string, string> }): InstanceType<typeof globalThis.Response>;
  json(body: unknown, init?: { status?: number }): unknown;
};
if (typeof MockedResponse.json !== 'function') {
  MockedResponse.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponse(JSON.stringify(body), {
      status: init?.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
}

const searchMock = tomtomRoutingService.searchLocations as unknown as jest.Mock;
const trafficMock = tomtomTrafficService.getLocationTrafficData as unknown as jest.Mock;
const enrichMock = enrichActivitiesWithImages as unknown as jest.Mock;

function get(city: string | null) {
  const url =
    city === null
      ? 'http://localhost:3000/api/spots'
      : `http://localhost:3000/api/spots?city=${city}`;
  return GET(new Request(url) as unknown as Parameters<typeof GET>[0]);
}

describe('GET /api/spots', () => {
  beforeEach(() => {
    searchMock.mockReset();
    trafficMock.mockReset();
    // Passthrough by default: images stay null (placeholder path).
    enrichMock.mockImplementation(async (acts: unknown[]) => acts);
  });

  it('rejects unsupported cities with 400 without searching', async () => {
    const res = await get('paris');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'Unsupported city' });
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('serves the curated Baguio pool without TomTom', async () => {
    const res = await get('baguio');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.city).toBe('baguio');
    expect(body.spots.length).toBeGreaterThan(0);
    for (const s of body.spots) {
      expect(typeof s.name).toBe('string');
      expect(Number.isFinite(s.lat)).toBe(true);
      expect(Number.isFinite(s.lon)).toBe(true);
    }
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('skips enrichment entirely for the curated Baguio pool', async () => {
    await get('baguio');
    expect(enrichMock).not.toHaveBeenCalled();
    expect(trafficMock).not.toHaveBeenCalled();
  });

  it('defaults a missing city param to baguio', async () => {
    const res = await get(null);
    expect(res.status).toBe(200);
    expect((await res.json()).city).toBe('baguio');
  });

  it('maps TomTom results for other cities, dropping out-of-bounds', async () => {
    searchMock.mockResolvedValue([
      { name: 'Cebu Spot', coordinates: { lat: 10.3, lng: 123.9 } },
      { name: 'Manila Spot', coordinates: { lat: 14.6, lng: 121.0 } },
      { name: 'No Coords', coordinates: { lat: null, lng: null } },
    ]);
    trafficMock.mockResolvedValue({ congestionScore: 10 });
    const res = await get('cebu');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.spots).toEqual([
      { name: 'Cebu Spot', image: null, lat: 10.3, lon: 123.9, peakHours: null, traffic: 'Low' },
    ]);
  });

  it('enriches photos and maps high congestion to High', async () => {
    searchMock.mockResolvedValue([
      { name: 'Busy Spot', coordinates: { lat: 10.31, lng: 123.91 } },
    ]);
    enrichMock.mockImplementation(async (acts: { title: string }[]) =>
      acts.map((a) => ({ ...a, image: 'https://photos.example/busy.jpg' }))
    );
    trafficMock.mockResolvedValue({ congestionScore: 80 });
    const res = await get('cebu');
    const body = await res.json();
    expect(body.spots).toEqual([
      { name: 'Busy Spot', image: 'https://photos.example/busy.jpg', lat: 10.31, lon: 123.91, peakHours: null, traffic: 'High' },
    ]);
  });

  it('hides the badge when traffic lookup fails (measured or nothing)', async () => {
    searchMock.mockResolvedValue([
      { name: 'Cebu Spot', coordinates: { lat: 10.3, lng: 123.9 } },
    ]);
    trafficMock.mockRejectedValue(new Error('flow down'));
    const res = await get('cebu');
    const body = await res.json();
    expect(body.spots[0].traffic).toBeUndefined();
    expect(body.spots[0].image).toBeNull();
  });

  it('degrades to an empty pool when TomTom fails', async () => {
    searchMock.mockResolvedValue([]);
    const res = await get('davao');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, city: 'davao', spots: [] });
  });
});
