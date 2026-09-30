import {
  mergeRegionPools,
  regionCardKey,
  withSpotOverlays,
  SPOT_OVERLAYS,
  SPOT_SCOPES,
  REGION_MEMBERS,
  LUZON_MEMBERS,
  type RegionSpotPool,
  type SpotPayload,
} from '../../utils';

const pool = (city: string, names: string[]): RegionSpotPool => ({
  city,
  spots: names.map((name, i) => ({
    name,
    image: null,
    lat: 10 + i * 0.01,
    lon: 120 + i * 0.01,
    peakHours: null,
  })),
});

describe('mergeRegionPools', () => {
  it('round-robins top-1 per pool then fills, capped at 3', () => {
    const out = mergeRegionPools([
      pool('boracay', ['B1', 'B2']),
      pool('cebu', ['C1', 'C2']),
    ]);
    expect(out.map((s) => s.name)).toEqual(['B1', 'C1', 'B2']);
  });

  it('a member with 0 rows contributes 0 without breaking the order', () => {
    const out = mergeRegionPools([
      pool('boracay', []),
      pool('cebu', ['C1', 'C2']),
    ]);
    expect(out.map((s) => s.name)).toEqual(['C1', 'C2']);
  });

  it('all-empty pools produce an empty region', () => {
    expect(
      mergeRegionPools([pool('boracay', []), pool('cebu', [])])
    ).toEqual([]);
  });

  it('drops rows without finite coordinates', () => {
    const bad: RegionSpotPool = {
      city: 'boracay',
      spots: [
        { name: 'No Coords', image: null, lat: null, lon: null, peakHours: null },
      ],
    };
    expect(mergeRegionPools([bad, pool('cebu', ['C1'])])).toEqual([
      expect.objectContaining({ name: 'C1' }),
    ]);
  });

  it('REGION_MEMBERS pins exactly the two Visayas scopes', () => {
    expect([...REGION_MEMBERS]).toEqual(['boracay', 'cebu']);
  });

  it('LUZON_MEMBERS pins baguio + manila (el_nido gone, no Luzon mislabel)', () => {
    expect([...LUZON_MEMBERS]).toEqual(['baguio', 'manila']);
    expect(SPOT_SCOPES.map((s) => s.id)).toEqual(['baguio', 'manila', 'davao', 'luzon']);
  });

  it('keys same-title rows from different pools distinctly (Boracay Island dup)', () => {
    // Regression: two TomTom results named "Boracay Island" in one 0.01° cell
    // rendered under key={spot.name} and React dropped one. The render key
    // must carry the owning city, so identical titles stay distinct rows.
    const island = { name: 'Boracay Island', image: null, peakHours: null };
    const a = { ...island, lat: 11.9674, lon: 121.9248 };
    const b = { ...island, lat: 11.9674, lon: 121.9248 };
    expect(regionCardKey('boracay', a)).not.toBe(regionCardKey('cebu', b));
    expect(regionCardKey('boracay', a)).toBe(regionCardKey('boracay', { ...b }));
  });
});

describe('withSpotOverlays', () => {
  const row = (name: string): SpotPayload => ({ name, image: null, lat: 1, lon: 1, peakHours: null });

  it('prepends provider-pinned mall rows to the member pool', () => {
    const out = withSpotOverlays('cebu', [row('Live Spot')]);
    expect(out[0]).toMatchObject({ name: 'SM Seaside City Cebu', lat: 10.281732, lon: 123.880608 });
    const manila = withSpotOverlays('manila', [row('Live Spot')]);
    expect(manila.slice(0, 2).map((s) => s.name)).toEqual(['SM Mall of Asia', 'Bonifacio High Street']);
  });

  it('yields to live rows on title collision (no duplicates)', () => {
    const out = withSpotOverlays('manila', [row('SM Mall of Asia'), row('Live')]);
    expect(out.filter((s) => s.name === 'SM Mall of Asia')).toHaveLength(1);
    expect(out).toHaveLength(3);
  });

  it('leaves cities without overlays untouched', () => {
    const pool = [row('A')];
    expect(withSpotOverlays('davao', pool)).toBe(pool);
  });

  it('pins exactly the three reviewed overlays', () => {
    expect(SPOT_OVERLAYS).toHaveLength(3);
  });
});
