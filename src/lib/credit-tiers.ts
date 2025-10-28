import { 
  TierConfig, 
  UserTierProgress, 
  TierStatus, 
  isValidTierConfig,
  TierValidationError,
  TierCalculationError
} from '../types/credit-tiers';

/**
 * Static tier configuration data with validation
 */
export const TIER_CONFIGS: readonly TierConfig[] = [
  {
    id: 'explorer',
    name: 'Explorer',
    dailyCreditsBonus: 1,
    totalDailyCredits: 6,
    referralsRequired: 0,
    icon: 'checkmark',
    order: 1
  },
  {
    id: 'smart-traveler',
    name: 'Smart Traveler',
    dailyCreditsBonus: 2,
    totalDailyCredits: 8,
    referralsRequired: 3,
    icon: 'lightning',
    order: 2
  },
  {
    id: 'voyager',
    name: 'Voyager',
    dailyCreditsBonus: 2,
    totalDailyCredits: 10,
    referralsRequired: 5,
    icon: 'lightning',
    order: 3
  }
] as const;

// Validate tier configurations at module load
TIER_CONFIGS.forEach((config, index) => {
  if (!isValidTierConfig(config)) {
    throw new TierValidationError(`Invalid tier configuration at index ${index}: ${JSON.stringify(config)}`);
  }
});

/**
 * Validate referral count input
 */
function validateReferralCount(referralCount: number): number {
  if (typeof referralCount !== 'number' || isNaN(referralCount) || !isFinite(referralCount) || referralCount < 0) {
    throw new TierValidationError(`Invalid referral count: ${referralCount}. Must be a non-negative finite number.`);
  }
  return Math.floor(referralCount); // Ensure integer
}

/**
 * Get tier configuration by ID with validation
 */
export function getTierById(tierId: string): TierConfig | undefined {
  if (typeof tierId !== 'string' || !tierId.trim()) {
    throw new TierValidationError(`Invalid tier ID: ${tierId}`);
  }
  
  return TIER_CONFIGS.find(tier => tier.id === tierId);
}

/**
 * Get all tiers sorted by order
 */
export function getAllTiers(): TierConfig[] {
  try {
    return [...TIER_CONFIGS].sort((a, b) => a.order - b.order);
  } catch (error) {
    throw new TierCalculationError(`Failed to sort tiers: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate current tier based on referral count with validation
 */
export function getCurrentTier(referralCount: number): TierConfig {
  const validReferralCount = validateReferralCount(referralCount);
  
  try {
    // Find the highest tier the user has unlocked
    const unlockedTiers = TIER_CONFIGS.filter(tier => validReferralCount >= tier.referralsRequired);
    const currentTier = unlockedTiers.sort((a, b) => b.order - a.order)[0];
    
    if (!currentTier) {
      // Fallback to first tier if no tiers are unlocked (shouldn't happen with Explorer at 0 referrals)
      return TIER_CONFIGS[0];
    }
    
    return currentTier;
  } catch (error) {
    throw new TierCalculationError(`Failed to calculate current tier: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the next tier to unlock with validation
 */
export function getNextTier(referralCount: number): TierConfig | undefined {
  const validReferralCount = validateReferralCount(referralCount);
  
  try {
    const sortedTiers = getAllTiers();
    return sortedTiers.find(tier => validReferralCount < tier.referralsRequired);
  } catch (error) {
    throw new TierCalculationError(`Failed to calculate next tier: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate tier status for a given tier and user's referral count with validation
 */
export function getTierStatus(tier: TierConfig, referralCount: number): TierStatus {
  if (!isValidTierConfig(tier)) {
    throw new TierValidationError(`Invalid tier configuration: ${JSON.stringify(tier)}`);
  }
  
  const validReferralCount = validateReferralCount(referralCount);
  
  try {
    if (validReferralCount >= tier.referralsRequired) {
      return 'unlocked';
    }
    
    const nextTier = getNextTier(validReferralCount);
    if (nextTier && nextTier.id === tier.id) {
      return 'next';
    }
    
    return 'locked';
  } catch (error) {
    throw new TierCalculationError(`Failed to calculate tier status: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate progress percentage to next tier with validation
 */
export function calculateProgressPercentage(referralCount: number): number {
  const validReferralCount = validateReferralCount(referralCount);
  
  try {
    const nextTier = getNextTier(validReferralCount);
    if (!nextTier) {
      return 100; // All tiers unlocked
    }
    
    const currentTier = getCurrentTier(validReferralCount);
    const progressStart = currentTier.referralsRequired;
    const progressEnd = nextTier.referralsRequired;
    const progressRange = progressEnd - progressStart;
    
    if (progressRange <= 0) {
      throw new TierCalculationError(`Invalid progress range: ${progressRange}`);
    }
    
    const currentProgress = validReferralCount - progressStart;
    const percentage = (currentProgress / progressRange) * 100;
    
    return Math.min(100, Math.max(0, percentage));
  } catch (error) {
    if (error instanceof TierCalculationError || error instanceof TierValidationError) {
      throw error;
    }
    throw new TierCalculationError(`Failed to calculate progress percentage: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get user tier progress information with validation
 */
export function getUserTierProgress(referralCount: number): UserTierProgress {
  const validReferralCount = validateReferralCount(referralCount);
  
  try {
    const currentTier = getCurrentTier(validReferralCount);
    const nextTier = getNextTier(validReferralCount);
    const progressPercentage = calculateProgressPercentage(validReferralCount);
    
    return {
      currentReferrals: validReferralCount,
      currentTierId: currentTier.id,
      nextTierId: nextTier?.id,
      progressToNext: progressPercentage
    };
  } catch (error) {
    if (error instanceof TierCalculationError || error instanceof TierValidationError) {
      throw error;
    }
    throw new TierCalculationError(`Failed to get user tier progress: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}