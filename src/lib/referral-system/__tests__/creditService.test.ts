import { CreditService } from '../CreditService';
import { InsufficientCreditsError } from '../types';

let fromShouldThrow = false;
const mockRpc = jest.fn();
const mockSelectSingle = jest.fn();
const mockUpdateEq = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn(() => ({ eq: mockUpdateEq }));
const mockFrom = jest.fn((..._args: any[]) => {
  if (fromShouldThrow) throw new Error('db down');
  return {
    select: jest.fn(() => ({ eq: jest.fn(() => ({ single: mockSelectSingle })) })),
    update: mockUpdate,
    insert: mockInsert,
  };
});

jest.mock('../../data/supabaseAdmin', () => ({
  supabaseAdmin: {
    rpc: (...args: any[]) => mockRpc(...args),
    from: (...args: any[]) => mockFrom(...args),
  },
}));

describe('CreditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fromShouldThrow = false;
    mockSelectSingle.mockResolvedValue({ data: { credits_used_today: 2, daily_credits: 5 }, error: null });
    mockUpdateEq.mockResolvedValue({ error: null });
    mockInsert.mockResolvedValue({ error: null });
    mockRpc.mockResolvedValue({ data: true, error: null });
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
      fromShouldThrow = true;
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
