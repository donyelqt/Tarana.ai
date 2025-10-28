import {
  TIER_CONFIGS,
  getTierById,
  getAllTiers,
  getCurrentTier,
  getNextTier,
  getTierStatus,
  calculateProgressPercentage,
  getUserTierProgress
} from '../credit-tiers';
import { TierValidationError, TierCalculationError } from '../../types/credit-tiers';

describe('Credit Tiers Utility Functions', () => {
  describe('TIER_CONFIGS validation', () => {
    it('should have valid tier configurations', () => {
      expect(TIER_CONFIGS).toHaveLength(3);
      expect(TIER_CONFIGS[0].id).toBe('explorer');
      expect(TIER_CONFIGS[1].id).toBe('smart-traveler');
      expect(TIER_CONFIGS[2].id).toBe('voyager');
    });

    it('should have proper tier ordering', () => {
      const sortedTiers = getAllTiers();
      expect(sortedTiers[0].order).toBeLessThan(sortedTiers[1].order);
      expect(sortedTiers[1].order).toBeLessThan(sortedTiers[2].order);
    });
  });

  describe('getTierById', () => {
    it('should return correct tier for valid ID', () => {
      const tier = getTierById('explorer');
      expect(tier).toBeDefined();
      expect(tier?.name).toBe('Explorer');
    });

    it('should return undefined for invalid ID', () => {
      const tier = getTierById('invalid-tier');
      expect(tier).toBeUndefined();
    });

    it('should throw error for invalid input', () => {
      expect(() => getTierById('')).toThrow(TierValidationError);
      expect(() => getTierById('   ')).toThrow(TierValidationError);
    });
  });

  describe('getCurrentTier', () => {
    it('should return Explorer for 0 referrals', () => {
      const tier = getCurrentTier(0);
      expect(tier.id).toBe('explorer');
    });

    it('should return Smart Traveler for 3 referrals', () => {
      const tier = getCurrentTier(3);
      expect(tier.id).toBe('smart-traveler');
    });

    it('should return Voyager for 5+ referrals', () => {
      const tier = getCurrentTier(5);
      expect(tier.id).toBe('voyager');
      
      const tierHigher = getCurrentTier(10);
      expect(tierHigher.id).toBe('voyager');
    });

    it('should handle invalid referral counts', () => {
      expect(() => getCurrentTier(-1)).toThrow(TierValidationError);
      expect(() => getCurrentTier(NaN)).toThrow(TierValidationError);
    });
  });

  describe('getNextTier', () => {
    it('should return Smart Traveler for 0-2 referrals', () => {
      expect(getNextTier(0)?.id).toBe('smart-traveler');
      expect(getNextTier(2)?.id).toBe('smart-traveler');
    });

    it('should return Voyager for 3-4 referrals', () => {
      expect(getNextTier(3)?.id).toBe('voyager');
      expect(getNextTier(4)?.id).toBe('voyager');
    });

    it('should return undefined for max tier', () => {
      expect(getNextTier(5)).toBeUndefined();
      expect(getNextTier(10)).toBeUndefined();
    });
  });

  describe('getTierStatus', () => {
    const explorerTier = TIER_CONFIGS[0];
    const smartTravelerTier = TIER_CONFIGS[1];
    const voyagerTier = TIER_CONFIGS[2];

    it('should return correct status for each tier', () => {
      // With 2 referrals: Explorer unlocked, Smart Traveler next, Voyager locked
      expect(getTierStatus(explorerTier, 2)).toBe('unlocked');
      expect(getTierStatus(smartTravelerTier, 2)).toBe('next');
      expect(getTierStatus(voyagerTier, 2)).toBe('locked');
    });

    it('should handle edge cases', () => {
      // With 3 referrals: Explorer and Smart Traveler unlocked, Voyager next
      expect(getTierStatus(explorerTier, 3)).toBe('unlocked');
      expect(getTierStatus(smartTravelerTier, 3)).toBe('unlocked');
      expect(getTierStatus(voyagerTier, 3)).toBe('next');
    });
  });

  describe('calculateProgressPercentage', () => {
    it('should calculate correct progress percentages', () => {
      expect(calculateProgressPercentage(0)).toBe(0);
      expect(calculateProgressPercentage(1)).toBeCloseTo(33.33, 1);
      expect(calculateProgressPercentage(2)).toBeCloseTo(66.67, 1);
      expect(calculateProgressPercentage(3)).toBe(0); // Next tier starts
      expect(calculateProgressPercentage(4)).toBe(50); // Halfway to Voyager
      expect(calculateProgressPercentage(5)).toBe(100); // All tiers unlocked
    });

    it('should handle boundary values', () => {
      expect(calculateProgressPercentage(0)).toBeGreaterThanOrEqual(0);
      expect(calculateProgressPercentage(100)).toBeLessThanOrEqual(100);
    });
  });

  describe('getUserTierProgress', () => {
    it('should return complete progress information', () => {
      const progress = getUserTierProgress(2);
      
      expect(progress.currentReferrals).toBe(2);
      expect(progress.currentTierId).toBe('explorer');
      expect(progress.nextTierId).toBe('smart-traveler');
      expect(progress.progressToNext).toBeCloseTo(66.67, 1);
    });

    it('should handle max tier scenario', () => {
      const progress = getUserTierProgress(5);
      
      expect(progress.currentReferrals).toBe(5);
      expect(progress.currentTierId).toBe('voyager');
      expect(progress.nextTierId).toBeUndefined();
      expect(progress.progressToNext).toBe(100);
    });
  });

  describe('Error handling', () => {
    it('should validate referral count inputs', () => {
      expect(() => getCurrentTier(-1)).toThrow(TierValidationError);
      expect(() => getNextTier(NaN)).toThrow(TierValidationError);
      expect(() => calculateProgressPercentage(Infinity)).toThrow(TierValidationError);
    });

    it('should handle calculation errors gracefully', () => {
      // These should not throw but handle edge cases
      expect(() => getCurrentTier(0)).not.toThrow();
      expect(() => getNextTier(1000)).not.toThrow();
    });
  });
});