import {
  mergeRegionPools,
  dedupeByDisplayName,
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

  it('LUZON_MEMBERS pins baguio + manila (luzon is region-only, not a pill)', () => {
    expect([...LUZON_MEMBERS]).toEqual(['baguio', 'manila']);
    // Single-pill invariant: luzon renders once, from the region loop — never
    // from SPOT_SCOPES (that double-render was the two-Luzon-tabs bug).
    const pillIds: string[] = SPOT_SCOPES.map((s) => s.id);
    expect(pillIds).toEqual(['baguio', 'manila', 'davao']);
    expect(pillIds).not.toContain('luzon');
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

  it('collapses same-titled rows inside ONE pool to a single card', () => {
    // Reported: the Visayas tab rendered "Boracay Island" twice. TomTom really
    // does return that name ten times across the query buckets, at two
    // coordinates ~500m apart (11.941303 and 11.936777). Upstream keeps them
    // because they are different places, but as cards they are
    // indistinguishable — two identical titles and two identical photos.
    const dup = (name: string, lat: number, lon: number): SpotPayload => ({
      name,
      image: null,
      lat,
      lon,
      peakHours: null,
    });
    const out = mergeRegionPools([
      {
        city: 'boracay',
        spots: [
          dup('Boracay Island', 11.941303, 121.9248),
          dup('Boracay Island', 11.936777, 121.9248),
          dup("Mountain View Nature's Park", 10.370782, 123.9101),
          dup("Mountain View Nature's Park", 10.370782, 123.9101),
        ],
      },
      { city: 'cebu', spots: [dup('Cebu Spot', 10.3, 123.9)] },
    ]);

    expect(out.filter((s) => s.name === 'Boracay Island')).toHaveLength(1);
    expect(out.filter((s) => s.name === "Mountain View Nature's Park")).toHaveLength(1);
    // 5 rows in, 3 distinct names, cap 3 -> three distinct cards.
    expect(out.map((s) => s.name)).toEqual([
      'Boracay Island',
      'Cebu Spot',
      "Mountain View Nature's Park",
    ]);
  });

  it('still keeps a same-named row from a DIFFERENT pool', () => {
    // Two cities may legitimately both have an "SM City"; cross-pool identity
    // is the render key's job and must not be collapsed here.
    const dup = (name: string, lat: number, lon: number): SpotPayload => ({
      name,
      image: null,
      lat,
      lon,
      peakHours: null,
    });
    const out = mergeRegionPools([
      { city: 'boracay', spots: [dup('SM City', 11.9674, 121.9248)] },
      { city: 'cebu', spots: [dup('SM City', 10.3157, 123.8854)] },
    ]);

    expect(out.map((s) => s.poolCity)).toEqual(['boracay', 'cebu']);
  });
});

describe('dedupeByDisplayName', () => {
  const row = (name: string): SpotPayload => ({ name, image: null, lat: 1, lon: 1, peakHours: null });

  it('keeps the first row for a name and preserves input order', () => {
    const out = dedupeByDisplayName([row('Boracay Island'), row('White Beach'), row('Boracay Island')]);
    expect(out.map((s) => s.name)).toEqual(['Boracay Island', 'White Beach']);
  });

  it('treats case and whitespace runs as the same display identity', () => {
    const out = dedupeByDisplayName([row('Boracay  Island'), row('boracay island')]);
    expect(out).toHaveLength(1);
  });

  it('never empties a real pool', () => {
    expect(dedupeByDisplayName([row('A'), row('B')])).toHaveLength(2);
    expect(dedupeByDisplayName([])).toEqual([]);
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
