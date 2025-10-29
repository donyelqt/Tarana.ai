/**
 * Type definitions for the Referral Credit System
 */

// =====================================================
// USER TIER SYSTEM
// =====================================================
export type UserTier = 'Default' | 'Explorer' | 'Smart Traveler' | 'Voyager';

export interface TierConfig {
  name: UserTier;
  dailyCredits: number;
  requiredReferrals: number;
  benefits: string[];
  color: string;
  icon: string;
}

export const TIER_CONFIGS: Record<UserTier, TierConfig> = {
  'Default': {
    name: 'Default',
    dailyCredits: 5,
    requiredReferrals: 0,
    benefits: ['5 daily credits', 'Access to all features'],
    color: 'gray',
    icon: '⭐'
  },
  'Explorer': {
    name: 'Explorer',
    dailyCredits: 6,
    requiredReferrals: 1,
    benefits: ['6 daily credits', 'Priority support', '1 active referral'],
    color: 'blue',
    icon: '🌟'
  },
  'Smart Traveler': {
    name: 'Smart Traveler',
    dailyCredits: 8,
    requiredReferrals: 3,
    benefits: ['8 daily credits', 'Premium features', '3 active referrals'],
    color: 'purple',
    icon: '✨'
  },
  'Voyager': {
    name: 'Voyager',
    dailyCredits: 10,
    requiredReferrals: 5,
    benefits: ['10 daily credits', 'VIP access', '5 active referrals'],
    color: 'gold',
    icon: '🎖️'
  }
};

// =====================================================
// USER PROFILE
// =====================================================
export interface UserProfile {
  id: string;
  referralCode: string;
  currentTier: UserTier;
  dailyCredits: number;
  creditsUsedToday: number;
  totalReferrals: number;
  activeReferrals: number;
  lastCreditRefresh: Date;
  createdAt: Date;
  updatedAt: Date;
}

// =====================================================
// REFERRAL SYSTEM
// =====================================================
export type ReferralStatus = 'pending' | 'active' | 'inactive';

export interface Referral {
  id: string;
  referrerId: string;
  refereeId: string;
  referralCode: string;
  status: ReferralStatus;
  createdAt: Date;
  activatedAt: Date;
}

export interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  currentTier: UserTier;
  nextTierRequirement: number;
  totalBonusCredits: number;
  recentReferrals: Referral[];
}

export interface CreateReferralRequest {
  referralCode: string;
  newUserId: string;
}

export interface CreateReferralResult {
  success: boolean;
  referralId?: string;
  error?: string;
}

// =====================================================
// CREDIT SYSTEM
// =====================================================
export type TransactionType = 'earn' | 'spend' | 'refresh' | 'bonus';
export type ServiceType = 'tarana_gala' | 'tarana_eats';

export interface CreditTransaction {
  id: string;
  userId: string;
  transactionType: TransactionType;
  amount: number;
  serviceUsed?: ServiceType;
  description?: string;
  balanceAfter: number;
  createdAt: Date;
}

export interface CreditBalance {
  totalCredits: number;
  usedToday: number;
  remainingToday: number;
  tier: UserTier;
  nextRefresh: Date;
  dailyLimit: number;
}

export interface ConsumeCreditsRequest {
  userId: string;
  amount: number;
  service: ServiceType;
  description?: string;
}

export interface ConsumeCreditsResult {
  success: boolean;
  remainingCredits: number;
  error?: string;
}

export interface RefreshCreditsResult {
  success: boolean;
  newBalance: CreditBalance;
  error?: string;
}

// =====================================================
// DAILY ALLOCATION
// =====================================================
export interface DailyCreditAllocation {
  id: string;
  userId: string;
  allocationDate: Date;
  baseCredits: number;
  bonusCredits: number;
  totalCredits: number;
  tier: UserTier;
  createdAt: Date;
}

// =====================================================
// ERROR TYPES
// =====================================================
export class ReferralSystemError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'ReferralSystemError';
  }
}

export class InsufficientCreditsError extends ReferralSystemError {
  constructor(
    public required: number,
    public available: number,
    public service: ServiceType
  ) {
    super(
      `Insufficient credits: need ${required}, have ${available} for ${service}`,
      'INSUFFICIENT_CREDITS',
      false
    );
    this.name = 'InsufficientCreditsError';
  }
}

export class InvalidReferralCodeError extends ReferralSystemError {
  constructor(code: string) {
    super(`Invalid referral code: ${code}`, 'INVALID_REFERRAL_CODE', false);
    this.name = 'InvalidReferralCodeError';
  }
}

export class SelfReferralError extends ReferralSystemError {
  constructor() {
    super('Users cannot refer themselves', 'SELF_REFERRAL', false);
    this.name = 'SelfReferralError';
  }
}

export class DuplicateReferralError extends ReferralSystemError {
  constructor() {
    super('Referral relationship already exists', 'DUPLICATE_REFERRAL', false);
    this.name = 'DuplicateReferralError';
  }
}
