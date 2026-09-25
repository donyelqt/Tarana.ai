/**
 * @jest-environment node
 */
jest.mock('@/lib/data/supabaseAdmin', () => ({
  supabaseAdmin: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

import { CreditService } from '../CreditService';
import { InsufficientCreditsError } from '../types';
import { supabaseAdmin } from '@/lib/data/supabaseAdmin';
jest.mock('@/lib/observability/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { logger } from '@/lib/observability/logger';

const mockLogger = logger as unknown as { error: jest.Mock; warn: jest.Mock; info: jest.Mock };
jest.mock('@/lib/services/userService', () => ({
  userProfileExists: jest.fn(),
  createUserProfile: jest.fn(),
}));

import { userProfileExists, createUserProfile } from '@/lib/services/userService';

const mockUserProfileExists = userProfileExists as unknown as jest.Mock;
const mockCreateUserProfile = createUserProfile as unknown as jest.Mock;

describe('CreditService', () => {
  const mockRpc = (supabaseAdmin as any).rpc as jest.Mock;
  const mockFrom = (supabaseAdmin as any).from as jest.Mock;

  let mockSelectSingle: jest.Mock;
  let mockUpdateEq: jest.Mock;
  let mockInsert: jest.Mock;
  let mockUpdate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSelectSingle = jest.fn().mockResolvedValue({
      data: {
        credits_used_today: 2,
        daily_credits: 5,
        last_credit_refresh: new Date().toISOString(),
        current_tier: 'Default',
        id: 'u1',
      },
      error: null,
    });
    mockUpdateEq = jest.fn().mockResolvedValue({ error: null });
    mockInsert = jest.fn().mockResolvedValue({ error: null });
    mockUpdate = jest.fn(() => ({ eq: mockUpdateEq }));
    mockRpc.mockResolvedValue({ data: true, error: null });

    mockFrom.mockImplementation(() => ({
      select: jest.fn(() => ({ eq: jest.fn(() => ({ single: mockSelectSingle })) })),
      update: mockUpdate,
      insert: mockInsert,
    }));

    // also patch global mock
    const g: any = global as any;
    if (g.mockSupabaseAdmin) {
      g.mockSupabaseAdmin.rpc = mockRpc;
      g.mockSupabaseAdmin.from = mockFrom;
    }
  });

  describe('consumeCredits', () => {
    it('throws InsufficientCreditsError when the RPC returns falsy', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });
      await expect(
        CreditService.consumeCredits({ userId: 'u1', amount: 1, service: 'tarana_gala' })
      ).rejects.toBeInstanceOf(InsufficientCreditsError);
    });

    it('returns success and calls the RPC with the correct args', async () => {
      const res = await CreditService.consumeCredits({ userId: 'u1', amount: 1, service: 'tarana_gala' });
      expect(res.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith(
        'consume_credits',
        expect.objectContaining({ p_user_id: 'u1', p_amount: 1, p_service: 'tarana_gala' })
      );
    });
  });

  describe('refundCredits', () => {
    it('calls the refund_credits RPC with the idempotency key and returns true', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null });
      const res = await CreditService.refundCredits({
        userId: 'u1',
        amount: 1,
        service: 'tarana_gala',
        idempotencyKey: 'refund:sess-1',
      });
      expect(res).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith(
        'refund_credits',
        expect.objectContaining({
          p_user_id: 'u1',
          p_amount: 1,
          p_service: 'tarana_gala',
          p_idempotency_key: 'refund:sess-1',
        })
      );
    });

    it('returns false without throwing when the RPC reports a duplicate replay', async () => {
      mockRpc.mockResolvedValue({ data: false, error: null });
      await expect(
        CreditService.refundCredits({ userId: 'u1', amount: 1, service: 'tarana_gala', idempotencyKey: 'refund:sess-1' })
      ).resolves.toBe(false);
    });

    it('returns false without throwing when the DB client throws', async () => {
      mockRpc.mockRejectedValueOnce(new Error('db down'));
      await expect(
        CreditService.refundCredits({ userId: 'u1', amount: 1, service: 'tarana_gala', idempotencyKey: 'refund:sess-1' })
      ).resolves.toBe(false);
    });
  });
});

describe('ensureUserProfile unification', () => {
  const consume = () =>
    CreditService.consumeCredits({ userId: 'u1', amount: 1, service: 'tarana_gala' });

  beforeEach(() => {
    mockUserProfileExists.mockResolvedValue(true);
    mockCreateUserProfile.mockResolvedValue(undefined);
  });

  it('creates a missing profile through the shared service and still consumes credits', async () => {
    mockUserProfileExists.mockResolvedValueOnce(false);
    const res = await consume();
    expect(res.success).toBe(true);
    expect(mockCreateUserProfile).toHaveBeenCalledWith('u1');
  });

  it('skips creation when the profile already exists', async () => {
    const res = await consume();
    expect(res.success).toBe(true);
    expect(mockCreateUserProfile).not.toHaveBeenCalled();
  });

  it('treats profile creation failure as non-fatal on the money path', async () => {
    mockUserProfileExists.mockResolvedValueOnce(false);
    mockCreateUserProfile.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'));
    const res = await consume();
    expect(res.success).toBe(true);
    expect(mockCreateUserProfile).toHaveBeenCalledTimes(1);
  });

  it('never logs raw profile errors or user IDs', async () => {
    const sentinel = 'PROFILE_SENTINEL_xyz789';
    mockUserProfileExists.mockResolvedValueOnce(false);
    mockCreateUserProfile.mockRejectedValueOnce(Object.assign(new Error(sentinel), { code: '23505' }));
    await consume();
    expect(mockLogger.error).toHaveBeenCalled();
    const serialized = JSON.stringify(mockLogger.error.mock.calls);
    expect(serialized).not.toContain(sentinel);
    expect(serialized).not.toContain('u1');
  });
});
