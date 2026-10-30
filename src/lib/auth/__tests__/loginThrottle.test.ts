import {
  __resetLoginAttemptsForTests,
  getClientIdentifier,
  getLoginBlockStatus,
  registerFailedLogin,
  resetLoginAttempts,
  resolveClientIp,
  LOGIN_RATE_LIMIT_CONFIG,
} from '../loginThrottle';


const request = (headers: Record<string, string> = {}, ip?: string) =>
  ({ headers, ip } as unknown as { headers: Record<string, string>; ip?: string });

describe('login throttle identity', () => {
  beforeEach(() => {
    __resetLoginAttemptsForTests();
  });

  test('rotating x-forwarded-for no longer yields a fresh bucket per attempt', () => {
    const email = 'victim@example.com';
    let blocked = false;
    for (let i = 0; i < LOGIN_RATE_LIMIT_CONFIG.maxAttempts + 1; i++) {
      const identity = getClientIdentifier(
        email,
        request({ 'x-forwarded-for': `10.0.0.${i}, 203.0.113.7` })
      );
      blocked = registerFailedLogin(identity).blocked || blocked;
    }
    expect(blocked).toBe(true);
  });

  test('prefers x-real-ip over a spoofed x-forwarded-for', () => {
    const spoofed = request({ 'x-forwarded-for': '10.0.0.99', 'x-real-ip': '203.0.113.7' });
    expect(resolveClientIp(spoofed)).toBe('203.0.113.7');
  });

  test('uses the last forwarded hop, never the caller-supplied first entry', () => {
    expect(resolveClientIp(request({ 'x-forwarded-for': '10.0.0.99, 203.0.113.7' }))).toBe(
      '203.0.113.7'
    );
  });

  test('falls back to the platform ip, then to a sentinel', () => {
    expect(resolveClientIp(request({}, '198.51.100.4'))).toBe('198.51.100.4');
    expect(resolveClientIp(request())).toBe('unknown_ip');
  });

  test('locks out after maxAttempts and reports a retry window', () => {
    const identity = getClientIdentifier('a@example.com', request({}, '203.0.113.7'));
    const now = 1_000_000;

    for (let i = 0; i < LOGIN_RATE_LIMIT_CONFIG.maxAttempts - 1; i++) {
      expect(registerFailedLogin(identity, now).blocked).toBe(false);
    }

    const blocked = registerFailedLogin(identity, now);
    expect(blocked.blocked).toBe(true);
    expect(blocked.retryAfter).toBe(LOGIN_RATE_LIMIT_CONFIG.blockDurationMs / 1000);

    expect(getLoginBlockStatus(identity, now + 1000).blocked).toBe(true);
    expect(
      getLoginBlockStatus(identity, now + LOGIN_RATE_LIMIT_CONFIG.blockDurationMs + 1).blocked
    ).toBe(false);
  });

  test('a successful login clears the counter', () => {
    const identity = getClientIdentifier('a@example.com', request({}, '203.0.113.7'));
    registerFailedLogin(identity);
    registerFailedLogin(identity);
    resetLoginAttempts(identity);
    expect(getLoginBlockStatus(identity).blocked).toBe(false);
  });

  test('tracks addresses independently', () => {
    const a = getClientIdentifier('a@example.com', request({}, '203.0.113.7'));
    const b = getClientIdentifier('a@example.com', request({}, '198.51.100.4'));
    for (let i = 0; i < LOGIN_RATE_LIMIT_CONFIG.maxAttempts; i++) registerFailedLogin(a);
    expect(getLoginBlockStatus(a).blocked).toBe(true);
    expect(getLoginBlockStatus(b).blocked).toBe(false);
  });
});
