const MockedResponseTrack = globalThis.Response as unknown as { new(body?: unknown, init?: { status?: number; headers?: Record<string, string> }): InstanceType<typeof globalThis.Response>; json(body: unknown, init?: { status?: number }): unknown; };
if (typeof MockedResponseTrack.json !== 'function') {
  MockedResponseTrack.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponseTrack(JSON.stringify(body), { status: init?.status ?? 200, headers: { 'content-type': 'application/json' } });
}

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getServerSession } from 'next-auth';
import { ReferralService } from '@/lib/referral-system/ReferralService';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/referral-system/ReferralService', () => ({
  ReferralService: { createReferral: jest.fn() },
}));

const sessionMock = getServerSession as unknown as jest.Mock;
const createMock = ReferralService.createReferral as unknown as jest.Mock;

function post(body: unknown) {
  return { headers: { get: () => null }, json: async () => body } as unknown as NextRequest;
}

describe('track-referral route (5.1-R1 narrow)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
  });

  test('rejects unauthenticated requests with 401', async () => {
    sessionMock.mockResolvedValue(null);

    const res = await POST(post({ referralCode: 'ABC123' }));

    expect(res.status).toBe(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  test('returns 400 for blank code without touching the service', async () => {
    const res = await POST(post({ referralCode: '   ' }));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'Invalid referral code' });
    expect(createMock).not.toHaveBeenCalled();
  });

  test('normalizes the code and returns success on first attempt', async () => {
    createMock.mockResolvedValue({ success: true, referralId: 'ref-1' });

    const res = await POST(post({ referralCode: ' abc123 ' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, referralId: 'ref-1' });
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith({ referralCode: 'ABC123', newUserId: 'user-1' });
  });

  test('does not retry business failures (invalid code answers once)', async () => {
    createMock.mockResolvedValue({ success: false, error: 'Invalid referral code: NOPE' });

    const res = await POST(post({ referralCode: 'NOPE' }));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ success: false });
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  test('retries transient throws then succeeds', async () => {
    createMock
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockResolvedValue({ success: true, referralId: 'ref-9' });

    const res = await POST(post({ referralCode: 'ABC123' }));

    expect(res.status).toBe(200);
    expect(createMock).toHaveBeenCalledTimes(3);
  }, 15000);

  test('maps exhausted transient throws to a safe 500 without leaking text', async () => {
    const sentinel = 'sentinel-track-referral-leak-probe';
    createMock.mockRejectedValue(new Error(sentinel));

    const res = await POST(post({ referralCode: 'ABC123' }));
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(text).not.toContain(sentinel);
  }, 15000);
});
