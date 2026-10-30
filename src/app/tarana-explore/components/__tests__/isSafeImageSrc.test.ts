
import { isSafeImageSrc } from '../ExploreMapView'

describe('isSafeImageSrc', () => {
  describe('accepts the shapes that legitimately cross the link', () => {
    it.each([
      ['a Baguio curated photo', '/images/great_wall_of_baguio.jpg'],
      ['a cafe registry photo', '/images/comingsoon.png'],
      ['a nested path', '/images/places/sm-seaside.jpg'],
      ['a hyphenated and underscored name', '/images/sm_city_baguio-2.jpg'],
      ['a provider https photo', 'https://images.unsplash.com/photo-abc123?w=400'],
      ['a Wikimedia https photo', 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Foo.jpg'],
    ])('%s', (_label, src) => {
      expect(isSafeImageSrc(src)).toBe(true)
    })
  })

  describe('rejects everything else', () => {
    it.each([
      ['javascript: URI', 'javascript:alert(1)'],
      ['uppercase javascript: URI', 'JavaScript:alert(1)'],
      ['data: URI', 'data:image/svg+xml;base64,PHN2Zz4='],
      ['protocol-relative host', '//evil.example.com/x.png'],
      ['plaintext http', 'http://evil.example.com/x.png'],
      ['traversal out of the image root', '/images/../../etc/passwd'],
      ['a path outside the image root', '/uploads/secret.png'],
      ['an absolute filesystem path', '/etc/passwd'],
      ['a query string on a local path', '/images/x.png?a=1'],
      ['whitespace injection', '/images/x.png onerror=alert(1)'],
    ])('%s', (_label, src) => {
      expect(isSafeImageSrc(src)).toBe(false)
    })
  })
})