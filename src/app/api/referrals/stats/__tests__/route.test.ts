/**
 * Tests for GET /api/referrals/stats (money path).
 * 401 unauthenticated; 200 shape; 500 mapping on throw.
 */
import { GET } from '../route';
import { getServerSession } from 'next-auth';
import { ReferralService, TierService } from '@/lib/referral-system';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/referral-system', () => ({
  ReferralService: {
    getReferralStats: jest.fn(),
    getUserReferralCode: jest.fn(),
  },
  TierService: { getTierProgress: jest.fn() },
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
const statsMock = ReferralService.getReferralStats as unknown as jest.Mock;
const tierMock = TierService.getTierProgress as unknown as jest.Mock;
const codeMock = ReferralService.getUserReferralCode as unknown as jest.Mock;

function get() {
  return GET({} as unknown as Parameters<typeof GET>[0]);
}

describe('GET /api/referrals/stats', () => {
  beforeEach(() => {
    sessionMock.mockReset();
    statsMock.mockReset();
    tierMock.mockReset();
    codeMock.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    sessionMock.mockResolvedValue(null);
    const res = await get();
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
    expect(statsMock).not.toHaveBeenCalled();
    expect(tierMock).not.toHaveBeenCalled();
    expect(codeMock).not.toHaveBeenCalled();
  });

  it('returns 200 with {success,stats,tierProgress,referralCode} shape', async () => {
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    const stats = {
      totalReferrals: 2,
      activeReferrals: 2,
      currentTier: 'Default',
      nextTierRequirement: 3,
      totalBonusCredits: 0,
      recentReferrals: [],
    };
    const tierProgress = {
      currentTier: 'Default',
      currentReferrals: 2,
      nextTier: 'Explorer',
      nextTierRequirement: 5,
      progress: 40,
    };
    statsMock.mockResolvedValue(stats);
    tierMock.mockResolvedValue(tierProgress);
    codeMock.mockResolvedValue('ABC123');
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.stats).toEqual(stats);
    expect(body.tierProgress).toEqual(tierProgress);
    expect(body.referralCode).toBe('ABC123');
    expect(statsMock).toHaveBeenCalledWith('user-1');
    expect(tierMock).toHaveBeenCalledWith('user-1');
    expect(codeMock).toHaveBeenCalledWith('user-1');
  });

  it('maps service throw to 500', async () => {
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    statsMock.mockRejectedValue(new Error('db down'));
    const res = await get();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to get referral stats');
    expect(body.details).toBe('db down');
  });
});
