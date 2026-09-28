import { authOptions } from '../auth';
import { supabaseAdmin } from '@/lib/data/supabaseAdmin';
import { logger } from '@/lib/observability/logger';

jest.mock('@/lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockLogger = logger as jest.Mocked<typeof logger>;

jest.mock('@/lib/data/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

const mockedFrom = supabaseAdmin.from as unknown as jest.Mock;

function mockUsersSelectSequence(
  singleImpls: Array<{ data: unknown; error: unknown }>
) {
  const mockSingle = jest.fn();
  for (const impl of singleImpls) {
    mockSingle.mockResolvedValueOnce(impl);
  }
  const mockUpdateEq = jest.fn().mockResolvedValue({ error: null });
  const mockUpdate = jest.fn(() => ({ eq: mockUpdateEq }));
  const mockInsert = jest.fn().mockResolvedValue({ error: null });
  const mockEq = jest.fn(() => ({ single: mockSingle }));
  const mockSelect = jest.fn(() => ({ eq: mockEq }));
  mockedFrom.mockReturnValue({ select: mockSelect, update: mockUpdate, insert: mockInsert });
  return { mockSingle, mockEq, mockSelect, mockUpdate, mockInsert };
}

function googleJwtArgs(email = 'Someone@Example.com') {
  return {
    token: {},
    user: {
      id: 'google-sub-123',
      name: 'Google User',
      email,
      image: 'https://example.com/avatar.png',
    },
    account: {
      provider: 'google',
      type: 'oauth',
      providerAccountId: 'google-sub-123',
    },
  } as any;
}

function googleSignInArgs(email = 'Someone@Example.com', emailVerified = true) {
  return {
    user: {
      id: 'google-sub-123',
      name: 'Google User',
      email,
      image: 'https://example.com/avatar.png',
    },
    account: {
      provider: 'google',
      type: 'oauth',
      providerAccountId: 'google-sub-123',
    },
    profile: { email_verified: emailVerified },
  } as any;
}

describe('auth jwt() Google branch — no id-less sessions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-google-id';
    process.env.GOOGLE_CLIENT_SECRET =
      process.env.GOOGLE_CLIENT_SECRET || 'test-google-secret';
  });

  test('(a) users-select returning null twice → rejects with auth_user_row_missing', async () => {
    const { mockSingle } = mockUsersSelectSequence([
      { data: null, error: { code: 'PGRST116' } },
      { data: null, error: { code: 'PGRST116' } },
    ]);
    const jwt = authOptions.callbacks?.jwt as unknown as (args: any) => Promise<any>;

    await expect(jwt(googleJwtArgs())).rejects.toThrow('auth_user_row_missing');

    // One initial read + exactly one retry.
    expect(mockSingle).toHaveBeenCalledTimes(2);
    expect(mockedFrom).toHaveBeenCalledTimes(2);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Google sign-in failed: no users row exists post-provisioning',
      expect.objectContaining({ entryPoint: 'auth' })
    );
    const serialized = JSON.stringify(mockLogger.error.mock.calls);
    expect(serialized).toMatch(/google/i);
    expect(serialized).not.toContain('Example.com');
    expect(serialized).not.toContain('Someone@Example.com');
  });

  test('(b) users-select returning a row → token.id set (existing behavior)', async () => {
    mockUsersSelectSequence([
      {
        data: {
          id: 'uuid-123',
          full_name: 'Test User',
          tos_accepted_at: '2026-01-01T00:00:00.000Z',
        },
        error: null,
      },
    ]);
    const jwt = authOptions.callbacks?.jwt as unknown as (args: any) => Promise<any>;

    const token = await jwt(googleJwtArgs());

    expect(token.id).toBe('uuid-123');
    // Never falls back to the Google sub.
    expect(token.id).not.toBe('google-sub-123');
    expect(token.name).toBe('Test User');
    expect((token as any).tosAccepted).toBe(true);
  });

  test('(c) re-read succeeds on second attempt → proceeds (covers the retry)', async () => {
    const { mockSingle } = mockUsersSelectSequence([
      { data: null, error: { code: 'PGRST116' } },
      {
        data: {
          id: 'uuid-retry-456',
          full_name: 'Retry User',
          tos_accepted_at: null,
        },
        error: null,
      },
      // Sign-in also pins the credential-change instant onto the session.
      { data: { password_changed_at: null }, error: null },
    ]);
    const jwt = authOptions.callbacks?.jwt as unknown as (args: any) => Promise<any>;

    const token = await jwt(googleJwtArgs());

    // Two user-row reads (initial + exactly one retry) plus the credential
    // stamp read: the retry stays bounded at one.
    expect(mockSingle).toHaveBeenCalledTimes(3);
    expect(token.id).toBe('uuid-retry-456');
    expect(token.id).not.toBe('google-sub-123');
    expect(token.name).toBe('Retry User');
    // The sign-in path stamps the credential instant it read.
    expect(token.pwdChangedAt).toBeNull();
    // NULL tos_accepted_at (first-time OAuth) stays falsy for the consent gate.
    expect((token as any).tosAccepted).toBe(false);
  });
});

describe('auth signIn() Google branch — verified email gates account linking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-google-id';
    process.env.GOOGLE_CLIENT_SECRET =
      process.env.GOOGLE_CLIENT_SECRET || 'test-google-secret';
  });

  const signIn = () =>
    authOptions.callbacks?.signIn as unknown as (args: any) => Promise<boolean>;

  test('Google identity with no usable email -> denied, no lookup', async () => {
    // `email_verified` cannot redeem a missing address: there is nothing to
    // match, link, or provision.
    const { mockSingle } = mockUsersSelectSequence([]);

    const allowed = await signIn()({
      user: { id: 'google-sub-123', name: 'No Email', email: undefined },
      account: { provider: 'google', type: 'oauth', providerAccountId: 'google-sub-123' },
      profile: { email_verified: true },
    });

    expect(allowed).toBe(false);
    expect(mockSingle).toHaveBeenCalledTimes(0);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Google sign-in refused: missing email',
      expect.objectContaining({ entryPoint: 'auth' })
    );
  });

  test('unverified Google email over an existing password row -> denied, no write', async () => {
    // No email_verified anywhere in the Google handshake below the raw
    // userinfo profile, so the check must live in this callback and run
    // BEFORE any row lookup, insert, or update. A Google identity can assert
    // any address; linking without proof of ownership hands an attacker the
    // account the row belongs to.
    const { mockSingle } = mockUsersSelectSequence([
      { data: { id: 'uuid-victim', image: null }, error: null },
    ]);

    const allowed = await signIn()(googleSignInArgs('victim@example.com', false));

    expect(allowed).toBe(false);
    // Refused before touching the database: zero reads, zero writes.
    expect(mockSingle).toHaveBeenCalledTimes(0);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Google sign-in refused: email not verified',
      expect.objectContaining({ entryPoint: 'auth' })
    );
    const serialized = JSON.stringify(mockLogger.error.mock.calls);
    expect(serialized).not.toContain('victim@example.com');
  });

  test('unverified Google email with no row -> denied, no insert', async () => {
    const { mockSingle } = mockUsersSelectSequence([
      { data: null, error: { code: 'PGRST116' } },
    ]);

    const allowed = await signIn()(googleSignInArgs('new@example.com', false));

    expect(allowed).toBe(false);
    // Refused before touching the database: nothing created for an unproven
    // address.
    expect(mockSingle).toHaveBeenCalledTimes(0);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Google sign-in refused: email not verified',
      expect.objectContaining({ entryPoint: 'auth' })
    );
  });

  test('verified Google email over an existing row -> proceeds (links)', async () => {
    const { mockSingle, mockUpdate, mockInsert } = mockUsersSelectSequence([
      { data: { id: 'uuid-member', image: null }, error: null },
    ]);

    const allowed = await signIn()(googleSignInArgs('member@example.com', true));

    expect(allowed).toBe(true);
    expect(mockSingle).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  test('verified Google email with no row -> inserts a new row', async () => {
    const { mockSingle, mockUpdate, mockInsert } = mockUsersSelectSequence([
      { data: null, error: { code: 'PGRST116' } },
    ]);

    const allowed = await signIn()(googleSignInArgs('fresh@example.com', true));

    expect(allowed).toBe(true);
    expect(mockSingle).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
