import nextConfig from '../../../../next.config';
import { RENDERABLE_IMAGE_HOSTS, isRenderableImageUrl } from '../imageService';

/**
 * Regression guard for the 2026-09-25 Dashboard crash:
 *
 *   Invalid src prop (https://thumb.wikimedia.org/...) on `next/image`,
 *   hostname "thumb.wikimedia.org" is not configured under images
 *
 * Wikimedia moved page-image thumbnails from upload.wikimedia.org to
 * thumb.wikimedia.org (Phabricator T427465). `onError` on the <Image> never
 * fires for this class of failure — `next/image` throws while resolving the
 * loader — so the only durable guard is keeping the service's renderable-host
 * allowlist and next.config's remotePatterns in lockstep.
 */

type RemotePattern = { protocol?: string; hostname?: string; pathname?: string };

function configuredHosts(): string[] {
  const patterns = (nextConfig.images?.remotePatterns ?? []) as Array<RemotePattern | URL>;
  return patterns
    .map((pattern) => {
      if (typeof pattern === 'string') return '';
      if (pattern instanceof URL) return pattern.hostname;
      return pattern.hostname ?? '';
    })
    .filter((hostname) => hostname.length > 0);
}

/** `**.example.com` style patterns match the bare domain and any subdomain. */
function patternMatchesHost(pattern: string, host: string): boolean {
  if (pattern === host) return true;
  if (pattern.startsWith('**.')) {
    const suffix = pattern.slice(3);
    return host === suffix || host.endsWith(`.${suffix}`);
  }
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(2);
    return host.endsWith(`.${suffix}`) && host !== suffix;
  }
  return false;
}

describe('next/image remote host configuration', () => {
  it('allows every host the image service can return', () => {
    const hosts = configuredHosts();

    for (const serviceHost of RENDERABLE_IMAGE_HOSTS) {
      const configured = hosts.some((pattern) => patternMatchesHost(pattern, serviceHost));
      expect({ serviceHost, configured }).toEqual({ serviceHost, configured: true });
    }
  });

  it('configures thumb.wikimedia.org explicitly (the reported crash)', () => {
    const url =
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/75/Rizal_Monument_at_Rizal_Park.jpg/960px-Rizal_Monument_at_Rizal_Park.jpg?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail';

    expect(isRenderableImageUrl(url)).toBe(true);
    expect(
      configuredHosts().some((pattern) => patternMatchesHost(pattern, 'thumb.wikimedia.org'))
    ).toBe(true);
  });

  it('rejects local paths only when they are remote-and-unconfigured', () => {
    expect(isRenderableImageUrl('/images/burnham.png')).toBe(true);
    expect(isRenderableImageUrl('https://evil.example.com/photo.jpg')).toBe(false);
    expect(isRenderableImageUrl('http://upload.wikimedia.org/insecure.jpg')).toBe(false);
    expect(isRenderableImageUrl(null)).toBe(false);
    expect(isRenderableImageUrl(undefined)).toBe(false);
    expect(isRenderableImageUrl('not a url')).toBe(false);
  });
});
