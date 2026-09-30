import {
  mergeRegionPools,
  REGION_MEMBERS,
  type RegionSpotPool,
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
  it('REGION_MEMBERS pins exactly the two Visayas scopes (el_nido excluded)', () => {
    // El Nido is Palawan (Mimaropa) with its own city pill — a "Visayas" tab
    // containing Luzon would be a mislabel, not a region.
    expect([...REGION_MEMBERS]).toEqual(['boracay', 'cebu']);
  });
});
