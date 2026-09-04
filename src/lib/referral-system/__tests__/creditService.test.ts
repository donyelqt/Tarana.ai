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
    it('restores credits and writes a refund transaction', async () => {
      await CreditService.refundCredits({ userId: 'u1', amount: 1, service: 'tarana_gala' });
      expect(mockUpdate).toHaveBeenCalledWith({ credits_used_today: 1 });
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'u1',
          transaction_type: 'refund',
          amount: 1,
        })
      );
    });

    it('does not throw when the DB client throws', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('db down');
      });
      const g: any = global as any;
      if (g.mockSupabaseAdmin) g.mockSupabaseAdmin.from = mockFrom;
      await expect(
        CreditService.refundCredits({ userId: 'u1', amount: 1, service: 'tarana_gala' })
      ).resolves.toBeUndefined();
    });

    it('returns early and does not write when the profile read errors', async () => {
      mockSelectSingle.mockResolvedValue({ data: null, error: { message: 'boom' } });
      await CreditService.refundCredits({ userId: 'u1', amount: 1, service: 'tarana_gala' });
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });
});
