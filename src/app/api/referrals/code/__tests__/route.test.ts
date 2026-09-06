/**
 * Tests for GET /api/referrals/code (auth-adjacent path).
 * 401 unauthenticated; 404-on-null exact contract; 200 {success,referralCode};
 * 500 mapping on throw.
 */
import { GET } from '../route';
import { getServerSession } from 'next-auth';
import { ReferralService } from '@/lib/referral-system';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/referral-system', () => ({
  ReferralService: { getUserReferralCode: jest.fn() },
}));

// jest.setup.js replaces global Response with a minimal mock lacking the
// static json() NextResponse.json() delegates to. Restore just that static.
const MockedResponse = globalThis.Response as unknown as {
  new (body?: unknown, init?: { status?: number; headers?: Record<string, string> }): InstanceType<typeof globalThis.Response>;
  json(body: unknown, init?: { status?: number }): unknown;
};
if (typeof MockedResponse.json !== 'function') {
  MockedResponse.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponse(JSON.stringify(body), {
      status: init?.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
}

const sessionMock = getServerSession as unknown as jest.Mock;
const codeMock = ReferralService.getUserReferralCode as unknown as jest.Mock;

function get() {
  return GET({} as unknown as Parameters<typeof GET>[0]);
}

describe('GET /api/referrals/code', () => {
  beforeEach(() => {
    sessionMock.mockReset();
    codeMock.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    sessionMock.mockResolvedValue(null);
    const res = await get();
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
    expect(codeMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the user has no referral code (null)', async () => {
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    codeMock.mockResolvedValue(null);
    const res = await get();
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'Referral code not found' });
  });

  it('returns 200 with {success,referralCode}', async () => {
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    codeMock.mockResolvedValue('ABC123');
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, referralCode: 'ABC123' });
    expect(codeMock).toHaveBeenCalledWith('user-1');
  });

  it('maps service throw to 500', async () => {
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    codeMock.mockRejectedValue(new Error('db down'));
    const res = await get();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to get referral code');
    expect(body.details).toBe('db down');
  });
});
