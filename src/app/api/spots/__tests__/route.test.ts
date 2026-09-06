/**
 * Tests for GET /api/spots?city= (dashboard Suggested Spots scope).
 * Baguio serves the FULL mixed pool — curated entries (zero enrichment) in
 * catalog order plus up to 8 TomTom extras — rotated by day via rotateByDay.
 * Full-pool rotation replaced curated-first because the display slices 3:
 * curated-first pinned extras at indices 37+ where they never rendered.
 * Extras are enriched and only photo-verified extras (real http photo, never
 * TomTom-map-only) join. Other cities serve live TomTom search enriched with
 * real photos + measured traffic. Unknown cities 400; TomTom failures
 * degrade (Baguio → curated-only rotation, others → empty pool, never 500).
 */
import { GET } from '../route';
import { tomtomRoutingService } from '@/lib/services/tomtomRouting';
import { tomtomTrafficService } from '@/lib/traffic/tomtomTraffic';
import { enrichActivitiesWithImages } from '@/lib/services/imageService';
import { activityToPayload, spotPool } from '@/app/dashboard/utils';

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
    // Default: no TomTom results (Baguio → curated-only, others → empty).
    searchMock.mockResolvedValue([]);
    trafficMock.mockResolvedValue({ congestionScore: 10 });
    // Passthrough by default: images stay undefined (map-guard drops extras).
    enrichMock.mockImplementation(async (acts: unknown[]) => acts);
  });

  it('rejects unsupported cities with 400 without searching', async () => {
    const res = await get('paris');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'Unsupported city' });
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('serves the full Baguio pool with daily rotation (curated-only when zero extras survive)', async () => {
    const curated = spotPool().map(activityToPayload);
    searchMock.mockResolvedValue([]);
    const day1 = Date.UTC(2026, 7, 4);
    const nowSpy = jest.spyOn(Date, 'now');
    try {
      // Same-day deterministic on the curated-only pool.
      nowSpy.mockReturnValue(day1);
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
      const first = body.spots;
      nowSpy.mockReturnValue(day1);
      const repeat = (await (await get('baguio')).json()).spots;
      expect(repeat).toEqual(first);
      // Curated-only pool is still a rotation: consecutive days differ, same set.
      nowSpy.mockReturnValue(day1 + 86400000);
      const next = (await (await get('baguio')).json()).spots;
      expect(next).not.toEqual(first);
      expect([...next.map((s: { name: string }) => s.name)].sort()).toEqual(
        [...first.map((s: { name: string }) => s.name)].sort()
      );
      expect(next).toHaveLength(curated.length);
      // On the aligned day (offset 0) the curated-only pool returns catalog order.
      const dayIndex1 = Math.floor(day1 / 86400000);
      const alignedDayIndex =
        dayIndex1 - (dayIndex1 % curated.length);
      nowSpy.mockReturnValue(alignedDayIndex * 86400000);
      const aligned = (await (await get('baguio')).json()).spots;
      expect(aligned).toEqual(curated);
    } finally {
      nowSpy.mockRestore();
    }
    // ONE TomTom supplement with the Baguio bounds/countrySet/language.
    expect(searchMock).toHaveBeenCalledTimes(4);
    expect(searchMock).toHaveBeenCalledWith(
      'tourist attractions Baguio City',
      {
        topLeft: { lat: 16.47, lng: 120.55 },
        bottomRight: { lat: 16.35, lng: 120.65 },
      },
      undefined,
      { countrySet: 'PH', language: 'en-US' }
    );
  });

  it('keeps curated entries unenriched while enriching extras only', async () => {
    const curated = spotPool().map(activityToPayload);
    searchMock.mockResolvedValue([
      { name: 'Extra Viewpoint', coordinates: { lat: 16.442, lng: 120.642 } },
    ]);
    enrichMock.mockImplementation(async (acts: { title: string; lat?: number; lon?: number }[]) =>
      acts.map((a) => ({
        ...a,
        image: `https://photos.example/${encodeURIComponent(a.title)}.jpg`,
      }))
    );
    trafficMock.mockResolvedValue({ congestionScore: 10 });
    const res = await get('baguio');
    const body = await res.json();
    expect(body.spots).toHaveLength(curated.length + 1);
    // Mixed pool: same set as curated + extra, in rotated order.
    expect(
      [...(body.spots as { name: string }[]).map((s) => s.name)].sort()
    ).toEqual([...curated.map((c) => c.name), 'Extra Viewpoint'].sort());
    // Curated entries untouched by enrichment: original images, no measured traffic.
    const byName = new Map(
      (body.spots as { name: string }[]).map((s) => [s.name, s])
    );
    for (const c of curated) {
      expect(byName.get(c.name)).toEqual(c);
      expect((byName.get(c.name) as { traffic?: unknown }).traffic).toBeUndefined();
    }
    // Extra enriched (photo + traffic), found by name (rotation may move it).
    const extra = byName.get('Extra Viewpoint') as unknown as {
      name: string;
      image: string;
      traffic: string;
    };
    expect(extra.name).toBe('Extra Viewpoint');
    expect(extra.image).toBe('https://photos.example/Extra%20Viewpoint.jpg');
    expect(extra.traffic).toBe('Low');
    // Enrich ran for the extra only — never for the 37 curated titles.
    expect(enrichMock).toHaveBeenCalledTimes(1);
    const enrichArg = enrichMock.mock.calls[0][0] as { title: string }[];
    expect(enrichArg.map((a) => a.title)).toEqual(['Extra Viewpoint']);
    expect(enrichMock.mock.calls[0][1]).toMatchObject({ city: 'Baguio City' });
    expect(trafficMock).toHaveBeenCalledTimes(1);
  });

  it('drops TomTom-static-map-only extras so filler never displaces curated cards', async () => {
    const curated = spotPool().map(activityToPayload);
    const curatedLen = curated.length;
    searchMock.mockResolvedValue([
      { name: 'Real Photo Spot', coordinates: { lat: 16.442, lng: 120.642 } },
      { name: 'Map Only Spot', coordinates: { lat: 16.445, lng: 120.645 } },
    ]);
    enrichMock.mockImplementation(async (acts: { title: string }[]) =>
      acts.map((a) => ({
        ...a,
        image:
          a.title === 'Real Photo Spot'
            ? 'https://upload.wikimedia.org/real.jpg'
            : 'https://api.tomtom.com/map/1/staticimage?key=K&center=120.645,16.445&zoom=15',
      }))
    );
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    try {
      const res = await get('baguio');
      const body = await res.json();
      const names = (body.spots as { name: string }[]).map((s) => s.name);
      expect(names).toContain('Real Photo Spot');
      expect(names).not.toContain('Map Only Spot');
      expect(body.spots).toHaveLength(curatedLen + 1);
      expect([...names].sort()).toEqual(
        [...curated.map((c) => c.name), 'Real Photo Spot'].sort()
      );
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('dropped 1/2 map-only extras')
      );
    } finally {
      debugSpy.mockRestore();
    }
  });

  it('dedupes TomTom extras against curated coords (toFixed(3)) and bounds', async () => {
    const curated = spotPool().map(activityToPayload);
    const first = curated[0];
    expect(first.lat).not.toBeNull();
    searchMock.mockResolvedValue([
      // Exact curated coords → dupe.
      { name: 'Dupe Exact', coordinates: { lat: first.lat, lng: first.lon } },
      // Same toFixed(3) bucket → dupe.
      {
        name: 'Dupe Bucket',
        coordinates: {
          lat: Number((first.lat as number).toFixed(3)) + 0.0004,
          lng: Number((first.lon as number).toFixed(3)) + 0.0004,
        },
      },
      // Out of Baguio bounds → dropped.
      { name: 'Cebu Far', coordinates: { lat: 10.3, lng: 123.9 } },
      // Genuine extra.
      { name: 'Genuine Extra', coordinates: { lat: 16.442, lng: 120.642 } },
    ]);
    enrichMock.mockImplementation(async (acts: { title: string }[]) =>
      acts.map((a) => ({
        ...a,
        image: `https://images.unsplash.com/${encodeURIComponent(a.title)}`,
      }))
    );
    const res = await get('baguio');
    const body = await res.json();
    const names = (body.spots as { name: string }[]).map((s) => s.name);
    expect(names).not.toContain('Dupe Exact');
    expect(names).not.toContain('Dupe Bucket');
    expect(names).not.toContain('Cebu Far');
    expect(names).toContain('Genuine Extra');
    expect(body.spots).toHaveLength(curated.length + 1);
  });

  it('caps extras at 8 within the mixed rotating pool', async () => {
    const curated = spotPool().map(activityToPayload);
    searchMock.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => ({
        name: `Extra ${i}`,
        coordinates: { lat: 16.438 + i * 0.001, lng: 120.638 + i * 0.001 },
      }))
    );
    enrichMock.mockImplementation(async (acts: { title: string }[]) =>
      acts.map((a) => ({
        ...a,
        image: `https://maps.googleapis.com/photo/${encodeURIComponent(a.title)}`,
      }))
    );
    const res = await get('baguio');
    const body = await res.json();
    // Enrich saw at most 8 candidates (extras only).
    const enrichArg = enrichMock.mock.calls[0][0] as unknown[];
    expect(enrichArg).toHaveLength(8);
    // Mixed pool: curated + 8 extras as one rotating set.
    expect(body.spots).toHaveLength(curated.length + 8);
    expect(
      [...(body.spots as { name: string }[]).map((s) => s.name)].sort()
    ).toEqual(
      [...curated.map((c) => c.name), ...Array.from({ length: 8 }, (_, i) => `Extra ${i}`)].sort()
    );
  });

  it('rotates the full mixed Baguio pool across days so extras surface in the head', async () => {
    const curated = spotPool().map(activityToPayload);
    searchMock.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        name: `RotExtra ${i}`,
        coordinates: { lat: 16.44 + i * 0.002, lng: 120.64 + i * 0.001 },
      }))
    );
    enrichMock.mockImplementation(async (acts: { title: string }[]) =>
      acts.map((a) => ({
        ...a,
        image: `https://upload.wikimedia.org/${encodeURIComponent(a.title)}.jpg`,
      }))
    );
    const names = async () =>
      (((await (await get('baguio')).json()).spots as { name: string }[]).map(
        (s) => s.name
      ));
    const day1 = Date.UTC(2026, 7, 4);
    const nowSpy = jest.spyOn(Date, 'now');
    try {
      nowSpy.mockReturnValue(day1);
      const first = await names();
      expect(first).toHaveLength(curated.length + 5);
      // Same-day deterministic over the mixed pool.
      nowSpy.mockReturnValue(day1);
      expect(await names()).toEqual(first);
      nowSpy.mockReturnValue(day1 + 86400000);
      const next = await names();
      // Full-pool rotation: the whole order shifts (head included), same set.
      expect(next).not.toEqual(first);
      expect(next.slice(0, 3)).not.toEqual(first.slice(0, 3));
      expect([...next].sort()).toEqual([...first].sort());
      // Extras are mixed into the pool — visible within a slice-3 head on some day.
      const seenHeads = new Set<string>();
      for (let d = 0; d < 7; d++) {
        nowSpy.mockReturnValue(day1 + d * 86400000);
        const dayNames = await names();
        dayNames.slice(0, 3).forEach((n) => seenHeads.add(n));
      }
      expect([...seenHeads].some((n) => n.startsWith('RotExtra'))).toBe(true);
    } finally {
      nowSpy.mockRestore();
    }
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

  it('rotates the non-Baguio head daily so the first 3 differ across days', async () => {
    searchMock.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => ({
        name: `S${i}`,
        coordinates: { lat: 10.2 + i * 0.01, lng: 123.8 + i * 0.01 },
      }))
    );
    trafficMock.mockResolvedValue({ congestionScore: 10 });
    const names = async () =>
      (((await (await get('cebu')).json()).spots as { name: string }[]).map((s) => s.name));
    const day1 = Date.UTC(2026, 7, 4); // two consecutive UTC days
    const nowSpy = jest.spyOn(Date, 'now');
    try {
      nowSpy.mockReturnValue(day1);
      const first = await names();
      expect(first).toHaveLength(12);
      nowSpy.mockReturnValue(day1);
      expect(await names()).toEqual(first);
      nowSpy.mockReturnValue(day1 + 86400000);
      const next = await names();
      expect(next.slice(0, 3)).not.toEqual(first.slice(0, 3));
      expect([...next].sort()).toEqual([...first].sort());
    } finally {
      nowSpy.mockRestore();
    }
  });
});
