import { authOptions } from '../auth';
import { supabaseAdmin } from '@/lib/data/supabaseAdmin';
import { logger } from '@/lib/observability/logger';
import {
  PASSWORD_CHANGED_CLAIM,
  isSessionTokenCurrent,
  resolveTokenUserId,
} from '../sessionValidity';

jest.mock('@/lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/lib/data/supabaseAdmin', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

const mockLogger = logger as jest.Mocked<typeof logger>;
const mockedFrom = supabaseAdmin.from as unknown as jest.Mock;

function mockUserReads(reads: Array<{ data: unknown; error: unknown }>) {
  const single = jest.fn();
  for (const read of reads) single.mockResolvedValueOnce(read);
  mockedFrom.mockReturnValue({ select: jest.fn(() => ({ eq: jest.fn(() => ({ single })) })) });
  return { single };
}

const LIVE_CHANGED_AT = '2026-09-20T12:00:00.000Z';
const STALE_CHANGED_AT = '2026-09-01T00:00:00.000Z';

describe('isSessionTokenCurrent', () => {
  test('accepts a token stamped with the account’s current value', () => {
    expect(isSessionTokenCurrent({ id: 'u1', pwdChangedAt: LIVE_CHANGED_AT }, LIVE_CHANGED_AT)).toBe(
      true
    );
  });

  test('rejects a token stamped before the credential changed', () => {
    expect(
      isSessionTokenCurrent({ id: 'u1', pwdChangedAt: STALE_CHANGED_AT }, LIVE_CHANGED_AT)
    ).toBe(false);
  });

  test('a never-changed account matches an absent stamp', () => {
    expect(isSessionTokenCurrent({ id: 'u1' }, null)).toBe(true);
  });

  test('a token with no stamp is rejected once the credential changed', () => {
    expect(isSessionTokenCurrent({ id: 'u1' }, LIVE_CHANGED_AT)).toBe(false);
  });

  test('an unreadable current value fails open rather than signing the site out', () => {
    expect(
      isSessionTokenCurrent({ id: 'u1', pwdChangedAt: STALE_CHANGED_AT }, undefined)
    ).toBe(true);
  });

  test('a token with no account id is accepted (nothing to scope the check to)', () => {
    expect(isSessionTokenCurrent({}, LIVE_CHANGED_AT)).toBe(true);
  });
});

describe('resolveTokenUserId', () => {
  test('returns the account id written at sign-in', () => {
    expect(resolveTokenUserId({ id: 'uuid-1', sub: 'uuid-1' })).toBe('uuid-1');
  });

  test('returns undefined even when a foreign sub is present', () => {
    expect(resolveTokenUserId({ sub: 'uuid-2' })).toBeUndefined();
  });

  test('returns undefined when neither claim is a usable id', () => {
    expect(resolveTokenUserId({})).toBeUndefined();
    expect(resolveTokenUserId({ id: '', sub: '' })).toBeUndefined();
  });
});

const sessionCallback = authOptions.callbacks?.session as unknown as (
  args: Record<string, unknown>
) => Promise<Record<string, unknown>>;

function resolveSession(token: Record<string, unknown>) {
  const full = {
    user: { name: 'Test User', email: 'u@example.com' },
    expires: new Date(Date.now() + 3600_000).toISOString(),
    ...token,
  };
  return sessionCallback({ session: full, token: full });
}

function isDiscarded(body: Record<string, unknown>): boolean {
  return Object.keys(body).length === 0;
}

describe('session() credential-change gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('accepts a web session whose stamp still matches', async () => {
    mockUserReads([{ data: { password_changed_at: LIVE_CHANGED_AT }, error: null }]);

    const body = await resolveSession({ id: 'uuid-1', [PASSWORD_CHANGED_CLAIM]: LIVE_CHANGED_AT });

    expect(isDiscarded(body)).toBe(false);
    expect((body.user as { id: string }).id).toBe('uuid-1');
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  test('discards a web session whose stamp predates the password change', async () => {
    mockUserReads([{ data: { password_changed_at: LIVE_CHANGED_AT }, error: null }]);

    const body = await resolveSession({ id: 'uuid-1', [PASSWORD_CHANGED_CLAIM]: STALE_CHANGED_AT });

    expect(isDiscarded(body)).toBe(true);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Session rejected: token predates the password change',
      expect.objectContaining({ entryPoint: 'auth' })
    );
  });

  test('discards a mobile credential whose stamp predates the password change', async () => {
    mockUserReads([{ data: { password_changed_at: LIVE_CHANGED_AT }, error: null }]);

    const body = await resolveSession({
      id: 'uuid-mobile',
      sub: 'uuid-mobile',
      mobile: true,
      tosAccepted: true,
      [PASSWORD_CHANGED_CLAIM]: STALE_CHANGED_AT,
    });

    expect(isDiscarded(body)).toBe(true);
  });

  test('accepts a mobile credential whose stamp still matches', async () => {
    mockUserReads([{ data: { password_changed_at: LIVE_CHANGED_AT }, error: null }]);

    const body = await resolveSession({
      id: 'uuid-mobile',
      sub: 'uuid-mobile',
      mobile: true,
      tosAccepted: true,
      [PASSWORD_CHANGED_CLAIM]: LIVE_CHANGED_AT,
    });

    expect(isDiscarded(body)).toBe(false);
    expect((body.user as { id: string }).id).toBe('uuid-mobile');
  });

  test('a foreign-subject mobile-style token skips the gate and stays intact', async () => {
    const body = await resolveSession({
      id: undefined,
      sub: 'subject-without-id-claim',
      mobile: true,
      tosAccepted: true,
      [PASSWORD_CHANGED_CLAIM]: STALE_CHANGED_AT,
    });

    expect(isDiscarded(body)).toBe(false);
    expect((body.user as { name?: string }).name).toBe('Test User');
    expect(mockedFrom).not.toHaveBeenCalled();
  });
  test('a mobile credential with no stamp is rejected once the credential changed', async () => {
    mockUserReads([{ data: { password_changed_at: LIVE_CHANGED_AT }, error: null }]);

    const body = await resolveSession({
      id: 'uuid-mobile',
      sub: 'uuid-mobile',
      mobile: true,
      tosAccepted: true,
    });

    expect(isDiscarded(body)).toBe(true);
  });

  test('fails open when the credential-change value cannot be read', async () => {
    mockUserReads([{ data: null, error: { code: 'PGRST116', message: 'no rows' } }]);

    const body = await resolveSession({ id: 'uuid-1', [PASSWORD_CHANGED_CLAIM]: STALE_CHANGED_AT });

    expect(isDiscarded(body)).toBe(false);
    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      'Session rejected: token predates the password change',
      expect.anything()
    );
  });

  test('a never-changed account accepts a session with no stamp', async () => {
    mockUserReads([{ data: { password_changed_at: null }, error: null }]);

    const body = await resolveSession({ id: 'uuid-1' });

    expect(isDiscarded(body)).toBe(false);
  });

  test('a token with no account identity is not gated', async () => {
    const body = await resolveSession({ id: undefined, sub: undefined });

    expect(isDiscarded(body)).toBe(false);
    expect(mockedFrom).not.toHaveBeenCalled();
  });
});
