import { lookup as defaultLookup } from 'node:dns/promises';
import { BlockList } from 'node:net';

export interface DnsLookupResult {
  address: string;
  family: number;
}

export interface SafeUrlOptions {
  allowedHosts?: readonly string[];
  lookup?: (hostname: string) => Promise<DnsLookupResult[]>;
}

const blockList = new BlockList();
blockList.addSubnet('0.0.0.0', 8, 'ipv4');
blockList.addSubnet('10.0.0.0', 8, 'ipv4');
blockList.addSubnet('100.64.0.0', 10, 'ipv4');
blockList.addSubnet('127.0.0.0', 8, 'ipv4');
blockList.addSubnet('169.254.0.0', 16, 'ipv4');
blockList.addSubnet('172.16.0.0', 12, 'ipv4');
blockList.addSubnet('192.0.0.0', 24, 'ipv4');
blockList.addSubnet('192.0.2.0', 24, 'ipv4');
blockList.addSubnet('192.168.0.0', 16, 'ipv4');
blockList.addSubnet('198.18.0.0', 15, 'ipv4');
blockList.addSubnet('198.51.100.0', 24, 'ipv4');
blockList.addSubnet('203.0.113.0', 24, 'ipv4');
blockList.addSubnet('224.0.0.0', 4, 'ipv4');
blockList.addSubnet('240.0.0.0', 4, 'ipv4');
blockList.addSubnet('::', 128, 'ipv6');
blockList.addSubnet('::1', 128, 'ipv6');
blockList.addSubnet('fc00::', 7, 'ipv6');
blockList.addSubnet('fe80::', 10, 'ipv6');
blockList.addSubnet('ff00::', 8, 'ipv6');

const ALWAYS_BLOCKED_HOSTNAMES: Record<string, true> = {
  localhost: true,
};

function toIPv4Tuple(address: string): [number, number, number, number] | null {
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(address)) {
    const octets = address.split('.').map(Number);
    if (octets.every((octet) => octet >= 0 && octet <= 255)) {
      return octets as [number, number, number, number];
    }
    return null;
  }
  if (/^\d{1,10}$/.test(address)) {
    const value = Number(address);
    if (value < 0 || value > 4294967295) return null;
    return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
  }
  const hex = address.toLowerCase().replace(/^0x/, '');
  if (/^[0-9a-f]{1,8}$/.test(hex)) {
    const value = parseInt(hex, 16);
    if (value < 0 || value > 4294967295) return null;
    return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
  }
  return null;
}

function normalizeCandidateAddress(candidate: string): string {
  const normalized = candidate.trim().toLowerCase();
  const bracketed = normalized.match(/^\[(.*)\]$/);
  const unbracketed = bracketed ? bracketed[1] : normalized;
  const tuple = toIPv4Tuple(unbracketed);
  if (tuple) return tuple.join('.');
  const fullHex = unbracketed.match(/^0x([0-9a-f]{1,8})$/);
  if (fullHex) return toIPv4Tuple(unbracketed)?.join('.') ?? unbracketed;
  return unbracketed;
}

function isSensitiveAddress(candidate: string): boolean {
  const normalized = normalizeCandidateAddress(candidate);
  return (
    blockList.check(normalized, 'ipv4') ||
    blockList.check(normalized, 'ipv6') ||
    ALWAYS_BLOCKED_HOSTNAMES[normalized] === true
  );
}

function isAllowedHostname(hostname: string, allowedHosts: readonly string[] | undefined): boolean {
  if (!allowedHosts || allowedHosts.length === 0) return true;
  return allowedHosts.some((allowed) => hostname === allowed.toLowerCase());
}

/**
 * SSRF URL guard.
 *
 * Predicate only: it never fetches. Resolve every hostname and reject if any
 * resolved address is internal/sensitive. Allowlisted hosts bypass the
 * general allowlist rule, but never the loopback/unspecified/link-local
 * sensitive-address rules. DNS validation is point-in-time; callers that
 * fetch must revalidate or pin the resolved address because of DNS TOCTOU.
 */
export async function isSafeUrl(raw: string, options: SafeUrlOptions = {}): Promise<boolean> {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) return false;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.username !== '' || url.password !== '') return false;

  const hostname = url.hostname.toLowerCase();
  if (hostname === '' || hostname.length > 253) return false;
  if (!isAllowedHostname(hostname, options.allowedHosts)) return false;
  if (isSensitiveAddress(hostname)) return false;

  const lookup = options.lookup ?? (async (name: string) => defaultLookup(name, { all: true }));
  let addresses: DnsLookupResult[];
  try {
    addresses = await lookup(hostname);
  } catch {
    return false;
  }

  if (!Array.isArray(addresses) || addresses.length === 0) return false;
  return !addresses.some((record) => isSensitiveAddress(record.address));
}
