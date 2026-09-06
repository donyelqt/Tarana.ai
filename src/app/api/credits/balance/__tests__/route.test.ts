/**
 * Tests for GET /api/credits/balance (money path).
 * 401 unauthenticated; 200 {success,balance} shape; 500 mapping on throw.
 */
import { GET } from '../route';
import { getServerSession } from 'next-auth';
import { CreditService } from '@/lib/referral-system';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/referral-system', () => ({
  CreditService: { getCurrentBalance: jest.fn() },
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
const balanceMock = CreditService.getCurrentBalance as unknown as jest.Mock;

function get() {
  return GET({} as unknown as Parameters<typeof GET>[0]);
}

describe('GET /api/credits/balance', () => {
  beforeEach(() => {
    sessionMock.mockReset();
    balanceMock.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    sessionMock.mockResolvedValue(null);
    const res = await get();
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
    expect(balanceMock).not.toHaveBeenCalled();
  });

  it('returns 200 with {success,balance} shape', async () => {
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    const balance = {
      totalCredits: 5,
      usedToday: 1,
      remainingToday: 4,
      tier: 'Default',
      nextRefresh: new Date('2026-09-07T00:00:00.000Z'),
      dailyLimit: 5,
    };
    balanceMock.mockResolvedValue(balance);
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.balance).toMatchObject({
      totalCredits: 5,
      usedToday: 1,
      remainingToday: 4,
      tier: 'Default',
      dailyLimit: 5,
    });
    expect(balanceMock).toHaveBeenCalledWith('user-1');
  });

  it('maps service throw to 500', async () => {
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    balanceMock.mockRejectedValue(new Error('db down'));
    const res = await get();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to get credit balance');
    expect(body.details).toBe('db down');
  });
});
