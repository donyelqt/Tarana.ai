import { getAccurateImageForPlace, enrichActivitiesWithImages } from '../imageService'

describe('curated image alias match (TomTom ", City" suffix)', () => {
  let fetchMock: jest.Mock

  beforeEach(async () => {
    jest.resetModules()
    fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 404 })
    ;(global as unknown as { fetch: unknown }).fetch = fetchMock
  })

  it('resolves a suffixed title to the bare catalogue photo', async () => {
    const url = await getAccurateImageForPlace({
      title: 'Mines View Park, Baguio City',
      cityId: 'baguio',
    })
    expect(url).toBe('/images/viewspark.png')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('resolves a suffixed title through the batch path too', async () => {
    const out = await enrichActivitiesWithImages(
      [{ title: 'Mines View Park, Baguio City', image: '' }],
      { city: 'Baguio City', cityId: 'baguio' },
    )
    expect(out[0].image).toBe('/images/viewspark.png')
  })

  it('still prefers the exact title when both forms exist', async () => {
    const url = await getAccurateImageForPlace({ title: 'Mines View Park', cityId: 'baguio' })
    expect(url).toBe('/images/viewspark.png')
  })

  it('does not strip into a different venue', async () => {
    const url = await getAccurateImageForPlace({
      title: 'Nonexistent Place XYZ, Baguio City',
      cityId: 'baguio',
      lat: 16.4,
      lon: 120.6,
    })
    expect(url ?? '').not.toContain('viewspark')
  })

  it('never answers a suffixed title outside Baguio', async () => {
    const url = await getAccurateImageForPlace({ title: 'Mines View Park, Baguio City', cityId: 'manila' })
    expect(url).toBeNull()
  })
})
