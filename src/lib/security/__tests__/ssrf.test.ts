import { isSafeUrl, type DnsLookupResult } from '../ssrf';

type Lookup = (hostname: string) => Promise<DnsLookupResult[]>;

function lookupFor(records: Record<string, DnsLookupResult[]>): Lookup {
  return async (hostname: string) => records[hostname] ?? [];
}

const PUBLIC_IPV4: DnsLookupResult[] = [{ address: '93.184.216.34', family: 4 }];
const PUBLIC_IPV6: DnsLookupResult[] = [{ address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 }];

describe('isSafeUrl SSRF guard', () => {
  it('rejects the cloud metadata link-local address', async () => {
    const lookup = lookupFor({ '169.254.169.254': [{ address: '169.254.169.254', family: 4 }] });
    await expect(
      isSafeUrl('http://169.254.169.254/latest/meta-data/', { lookup })
    ).resolves.toBe(false);
  });

  it('rejects localhost and IPv6 loopback literals', async () => {
    const lookup = lookupFor({ localhost: [{ address: '127.0.0.1', family: 4 }] });
    await expect(isSafeUrl('http://localhost/', { lookup })).resolves.toBe(false);
    await expect(isSafeUrl('http://[::1]/', { lookup })).resolves.toBe(false);
  });

  it('rejects encoded and mapped loopback forms', async () => {
    const lookup = lookupFor({});
    await expect(isSafeUrl('http://[0:0:0:0:0:ffff:127.0.0.1]/', { lookup })).resolves.toBe(false);
    await expect(isSafeUrl('http://[::ffff:127.0.0.1]/', { lookup })).resolves.toBe(false);
    await expect(isSafeUrl('http://[::ffff:7f00:1]/', { lookup })).resolves.toBe(false);
    await expect(isSafeUrl('http://2130706433/', { lookup })).resolves.toBe(false);
    await expect(isSafeUrl('http://0x7f000001/', { lookup })).resolves.toBe(false);
  });

  it('rejects unique-local and link-local IPv6 ranges', async () => {
    const lookup = lookupFor({});
    await expect(isSafeUrl('http://[fc00::1]/', { lookup })).resolves.toBe(false);
    await expect(isSafeUrl('http://[fe80::1]/', { lookup })).resolves.toBe(false);
  });

  it('rejects non-HTTP(S) URLs before DNS', async () => {
    const lookup = jest.fn(async () => PUBLIC_IPV4);
    await expect(isSafeUrl('ftp://example.com/file', { lookup })).resolves.toBe(false);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('rejects URLs containing credentials', async () => {
    const lookup = lookupFor({ 'example.com': PUBLIC_IPV4 });
    await expect(isSafeUrl('https://user:pass@example.com/', { lookup })).resolves.toBe(false);
  });

  it('rejects reserved documentation and unspecified addresses', async () => {
    const lookup = lookupFor({});
    await expect(isSafeUrl('http://192.0.2.1/', { lookup })).resolves.toBe(false);
    await expect(isSafeUrl('http://0.0.0.0/', { lookup })).resolves.toBe(false);
  });

  it('allows a public host without an allowlist', async () => {
    const lookup = lookupFor({ 'example.com': [...PUBLIC_IPV4, ...PUBLIC_IPV6] });
    await expect(isSafeUrl('https://example.com/docs', { lookup })).resolves.toBe(true);
  });

  it('rejects a hostname when any resolved address is private', async () => {
    const lookup = lookupFor({
      'mixed.example.com': [...PUBLIC_IPV4, { address: '10.0.0.8', family: 4 }],
    });
    await expect(isSafeUrl('https://mixed.example.com/', { lookup })).resolves.toBe(false);
  });

  it('allows only the caller-selected allowlisted public host', async () => {
    const lookup = lookupFor({ 'images.example.com': PUBLIC_IPV4 });
    const options = { allowedHosts: ['images.example.com'], lookup };
    await expect(isSafeUrl('https://images.example.com/photo.jpg', options)).resolves.toBe(true);
    await expect(
      isSafeUrl('https://example.com/photo.jpg', { allowedHosts: ['images.example.com'], lookup })
    ).resolves.toBe(false);
  });

  it('still rejects an allowlisted host resolving to a sensitive internal address', async () => {
    const lookup = lookupFor({
      'images.example.com': [{ address: '169.254.169.254', family: 4 }],
    });
    await expect(
      isSafeUrl('https://images.example.com/photo.jpg', {
        allowedHosts: ['images.example.com'],
        lookup,
      })
    ).resolves.toBe(false);
  });

  it('rejects safely when DNS lookup throws', async () => {
    const lookup = async () => {
      throw new Error('ENOTFOUND');
    };
    await expect(isSafeUrl('https://example.com/', { lookup })).resolves.toBe(false);
  });
});
