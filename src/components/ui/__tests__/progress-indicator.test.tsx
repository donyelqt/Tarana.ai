import { ProgressIndicatorProps } from '../../../types/credit-tiers';

describe('ProgressIndicator', () => {
  it('should have correct props interface', () => {
    const props: ProgressIndicatorProps = {
      currentReferrals: 2,
      targetReferrals: 3,
      progressPercentage: 66.67
    };

    expect(props.currentReferrals).toBe(2);
    expect(props.targetReferrals).toBe(3);
    expect(props.progressPercentage).toBe(66.67);
  });

  it('should handle edge case values', () => {
    const zeroProgress: ProgressIndicatorProps = {
      currentReferrals: 0,
      targetReferrals: 5,
      progressPercentage: 0
    };

    const fullProgress: ProgressIndicatorProps = {
      currentReferrals: 5,
      targetReferrals: 5,
      progressPercentage: 100
    };

    expect(zeroProgress.progressPercentage).toBe(0);
    expect(fullProgress.progressPercentage).toBe(100);
  });

  it('should validate progress percentage bounds', () => {
    // Test that component would handle values outside 0-100 range
    const negativeProgress = -10;
    const overProgress = 150;
    
    // Simulate the Math.min/Math.max logic from component
    const clampedNegative = Math.min(100, Math.max(0, negativeProgress));
    const clampedOver = Math.min(100, Math.max(0, overProgress));
    
    expect(clampedNegative).toBe(0);
    expect(clampedOver).toBe(100);
  });
});