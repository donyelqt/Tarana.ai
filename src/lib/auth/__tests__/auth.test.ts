import { authOptions } from '../auth';
import { supabaseAdmin } from '@/lib/data/supabaseAdmin';

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
  const mockEq = jest.fn(() => ({ single: mockSingle }));
  const mockSelect = jest.fn(() => ({ eq: mockEq }));
  mockedFrom.mockReturnValue({ select: mockSelect });
  return { mockSingle, mockEq, mockSelect };
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

    // Fail-loud log: names the provider and the domain, never the full email.
    const errorSpy = console.error as unknown as jest.Mock;
    expect(errorSpy).toHaveBeenCalled();
    const serialized = JSON.stringify(errorSpy.mock.calls);
    expect(serialized).toMatch(/google/i);
    expect(serialized).toContain('Example.com');
    expect(serialized).toMatch(/no users row exists post-provisioning/i);
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
    ]);
    const jwt = authOptions.callbacks?.jwt as unknown as (args: any) => Promise<any>;

    const token = await jwt(googleJwtArgs());

    expect(mockSingle).toHaveBeenCalledTimes(2);
    expect(token.id).toBe('uuid-retry-456');
    expect(token.id).not.toBe('google-sub-123');
    expect(token.name).toBe('Retry User');
    // NULL tos_accepted_at (first-time OAuth) stays falsy for the consent gate.
    expect((token as any).tosAccepted).toBe(false);
  });
});
