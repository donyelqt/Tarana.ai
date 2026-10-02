import {
  resolveStopCoordinates,
  __resetStopCoordinateCache,
  type CoordinateSources,
} from '../resolveStopCoordinates'

const baguio = { lat: 16.4134, lon: 120.5934 }
const manila = { lat: 14.5995, lon: 120.9842 }

function sources(overrides: Partial<CoordinateSources> = {}): CoordinateSources {
  return {
    registry: jest.fn(() => null),
    scopedSearch: jest.fn(async () => null),
    ...overrides,
  }
}

const opts = (cityId: string, s: CoordinateSources) => ({
  cityId,
  cityCenter: cityId === 'manila' ? manila : baguio,
  sources: s,
})

describe('resolveStopCoordinates', () => {
  beforeEach(() => __resetStopCoordinateCache())

  it('prefers the registry and never calls the provider when it answers', async () => {
    const s = sources({
      registry: () => ({ lat: 16.4093, lon: 120.595 }),
      scopedSearch: jest.fn(async () => ({ lat: 1, lon: 1 })),
    })

    const result = await resolveStopCoordinates('Burnham Park', opts('baguio', s))

    expect(result).toEqual({ lat: 16.4093, lon: 120.595 })
    expect(s.scopedSearch).not.toHaveBeenCalled()
  })

  it('falls back to the scoped provider when the registry misses', async () => {
    const s = sources({
      registry: () => null,
      scopedSearch: jest.fn(async () => ({ lat: 14.5995, lon: 120.9842 })),
    })

    const result = await resolveStopCoordinates('Rizal Park', opts('manila', s))

    expect(result).toEqual({ lat: 14.5995, lon: 120.9842 })
    expect(s.scopedSearch).toHaveBeenCalledWith('Rizal Park', 'manila')
  })

  it('returns null when neither source answers', async () => {
    const s = sources()

    expect(await resolveStopCoordinates('Nowhere At All', opts('baguio', s))).toBeNull()
  })

  it('passes the city id to the provider so a lookup cannot cross cities', async () => {
    const s = sources({ scopedSearch: jest.fn(async () => null) })

    await resolveStopCoordinates('Some Place', opts('cebu', s))

    expect(s.scopedSearch).toHaveBeenCalledWith('Some Place', 'cebu')
  })

  it('rejects Null Island', async () => {
    const s = sources({ scopedSearch: jest.fn(async () => ({ lat: 0, lon: 0 })) })

    expect(await resolveStopCoordinates('Sentinel', opts('baguio', s))).toBeNull()
  })

  it('rejects non-finite and out-of-range coordinates', async () => {
    const nan = sources({ scopedSearch: jest.fn(async () => ({ lat: NaN, lon: 120 })) })
    expect(await resolveStopCoordinates('Bad NaN', opts('baguio', nan))).toBeNull()

    __resetStopCoordinateCache()
    const swapped = sources({ scopedSearch: jest.fn(async () => ({ lat: 16.4, lon: 200 })) })
    expect(await resolveStopCoordinates('Bad Range', opts('baguio', swapped))).toBeNull()
  })

  it('returns null for an empty title without touching any source', async () => {
    const s = sources()

    expect(await resolveStopCoordinates('   ', opts('baguio', s))).toBeNull()
    expect(s.registry).not.toHaveBeenCalled()
    expect(s.scopedSearch).not.toHaveBeenCalled()
  })

  it('caches a hit per city so a re-render does not re-query', async () => {
    const s = sources({ scopedSearch: jest.fn(async () => ({ lat: 16.4, lon: 120.6 })) })

    await resolveStopCoordinates('Cached Place', opts('baguio', s))
    await resolveStopCoordinates('cached place', opts('baguio', s))

    expect(s.scopedSearch).toHaveBeenCalledTimes(1)
  })

  it('caches a miss too — a title that did not resolve will not on a retry', async () => {
    const s = sources({ scopedSearch: jest.fn(async () => null) })

    await resolveStopCoordinates('Missing Place', opts('baguio', s))
    await resolveStopCoordinates('Missing Place', opts('baguio', s))

    expect(s.scopedSearch).toHaveBeenCalledTimes(1)
  })

  it('keeps cache entries separate per city', async () => {
    const s = sources({ scopedSearch: jest.fn(async (_t, cityId) => (cityId === 'manila' ? manila : baguio)) })

    const inManila = await resolveStopCoordinates('Same Name', opts('manila', s))
    const inBaguio = await resolveStopCoordinates('Same Name', opts('baguio', s))

    expect(inManila).toEqual(manila)
    expect(inBaguio).toEqual(baguio)
  })
})