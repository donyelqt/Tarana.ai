
import { parseDeepLink } from '../ExploreMapView'

const params = (q: string) => new URLSearchParams(q)

describe('parseDeepLink', () => {
  it('reads a well-formed link into a destination and a preview', () => {
    const { destination, preview } = parseDeepLink(
      params('to=SM%20Seaside%20City%20Cebu&toLat=10.281732&toLon=123.880608&traffic=Moderate&img=https%3A%2F%2Fimages.unsplash.com%2Fphoto-a'),
    )

    expect(destination).toEqual({
      id: 'spot:10.281732,123.880608',
      name: 'SM Seaside City Cebu',
      address: 'SM Seaside City Cebu',
      lat: 10.281732,
      lng: 123.880608,
      category: 'Spot',
    })
    expect(preview).toEqual({
      traffic: 'Moderate',
      image: 'https://images.unsplash.com/photo-a',
    })
  })

  it('carries a site-relative image through', () => {
    const { preview } = parseDeepLink(
      params('to=Great%20wall%20of%20Baguio&toLat=16.3698&toLon=120.6116&traffic=Low&img=%2Fimages%2Fgreat_wall_of_baguio.jpg'),
    )
    expect(preview?.image).toBe('/images/great_wall_of_baguio.jpg')
  })

  it('returns nothing for a link with no destination', () => {
    expect(parseDeepLink(params(''))).toEqual({ destination: null, preview: null })
  })

  it('never lands on Null Island when the coordinates are missing', () => {
    expect(parseDeepLink(params('to=Boracay%20Island')).destination).toBeNull()
    expect(parseDeepLink(params('to=Boracay%20Island&toLat=11.9674')).destination).toBeNull()
  });

  it('hides an unrecognised traffic level instead of guessing one', () => {
    const { preview } = parseDeepLink(
      params('to=X&toLat=1&toLon=2&traffic=Catastrophic'),
    )
    expect(preview?.traffic).toBeNull()
    expect(preview).not.toBeNull()
  })

  it('drops an unsafe image but still seeds the destination', () => {
    const { destination, preview } = parseDeepLink(
      params('to=X&toLat=1&toLon=2&img=javascript%3Aalert(1)'),
    )
    expect(destination).not.toBeNull()
    expect(preview?.image).toBeNull()
  })

  it('yields a null preview when the link carries no optional params', () => {
    const { destination, preview } = parseDeepLink(params('to=Burnham%20Park&toLat=16.41&toLon=120.59'))
    expect(destination).not.toBeNull()
    expect(preview).toEqual({ traffic: null, image: null })
  })
})