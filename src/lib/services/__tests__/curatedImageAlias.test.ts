/**
 * Regression: a curated Baguio venue rendered the logo fallback because the
 * live row carried TomTom's display name, not the catalogue title.
 *
 * "Mines View Park" keys "/images/viewspark.png" in CURATED_IMAGE_MAP, but
 * the TomTom supplement row is titled "Mines View Park, Baguio City". Tier 0
 * looked that exact string up, missed, and the request fell through to the
 * live fetch tiers — which search Wikimedia by the suffixed title and also
 * miss — so the empty string survived to the client fallback.
 */
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
    // No such collision exists today; this pins the precedence so a future
    // suffixed-only entry can never shadow an exact one.
    const url = await getAccurateImageForPlace({ title: 'Mines View Park', cityId: 'baguio' })
    expect(url).toBe('/images/viewspark.png')
  })

  it('does not strip into a different venue', async () => {
    // One trailing ", <city>" segment only. A title whose stripped form is
    // not a catalogue key must fall through to the live tiers untouched.
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
