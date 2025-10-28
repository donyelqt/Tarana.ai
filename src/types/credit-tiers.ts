/**
 * Credit Tier System Type Definitions
 * Enhanced with validation and error handling
 */

export type TierStatus = 'unlocked' | 'next' | 'locked';
export type TierIcon = 'checkmark' | 'lightning';

export interface TierConfig {
  readonly id: string;
  readonly name: string;
  readonly dailyCreditsBonus: number;
  readonly totalDailyCredits: number;
  readonly referralsRequired: number;
  readonly icon: TierIcon;
  readonly order: number;
}

export interface UserTierProgress {
  readonly currentReferrals: number;
  readonly currentTierId: string;
  readonly nextTierId?: string;
  readonly progressToNext: number; // 0-100 percentage
}

export interface TierCardProps {
  readonly tierName: string;
  readonly dailyCredits: number;
  readonly totalCredits: number;
  readonly referralsRequired?: number;
  readonly status: TierStatus;
  readonly icon: React.ReactNode;
}

export interface ProgressIndicatorProps {
  readonly currentReferrals: number;
  readonly targetReferrals: number;
  readonly progressPercentage: number;
}

// Type guards for runtime validation
export const isTierStatus = (value: unknown): value is TierStatus => {
  return typeof value === 'string' && ['unlocked', 'next', 'locked'].includes(value);
};

export const isTierIcon = (value: unknown): value is TierIcon => {
  return typeof value === 'string' && ['checkmark', 'lightning'].includes(value);
};

export const isValidTierConfig = (config: unknown): config is TierConfig => {
  if (!config || typeof config !== 'object') return false;
  
  const c = config as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    typeof c.name === 'string' &&
    typeof c.dailyCreditsBonus === 'number' &&
    typeof c.totalDailyCredits === 'number' &&
    typeof c.referralsRequired === 'number' &&
    isTierIcon(c.icon) &&
    typeof c.order === 'number' &&
    c.dailyCreditsBonus >= 0 &&
    c.totalDailyCredits >= 0 &&
    c.referralsRequired >= 0 &&
    c.order >= 0
  );
};

export const isValidProgressIndicatorProps = (props: unknown): props is ProgressIndicatorProps => {
  if (!props || typeof props !== 'object') return false;
  
  const p = props as Record<string, unknown>;
  return (
    typeof p.currentReferrals === 'number' &&
    typeof p.targetReferrals === 'number' &&
    typeof p.progressPercentage === 'number' &&
    p.currentReferrals >= 0 &&
    p.targetReferrals >= 0 &&
    p.progressPercentage >= 0 &&
    p.progressPercentage <= 100
  );
};

// Error types for better error handling
export class TierSystemError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'TierSystemError';
  }
}

export class TierValidationError extends TierSystemError {
  constructor(message: string) {
    super(message, 'TIER_VALIDATION_ERROR');
  }
}

export class TierCalculationError extends TierSystemError {
  constructor(message: string) {
    super(message, 'TIER_CALCULATION_ERROR');
  }
}