/**
 * Referral Credit System - Main Export
 * 
 * A comprehensive system for managing user referrals, credits, and tier-based rewards
 */

// Services
export { CreditService } from './CreditService';
export { ReferralService } from './ReferralService';
export { TierService } from './TierService';

// Client-side utilities
export {
  storeReferralCode,
  getStoredReferralCode,
  clearReferralCode,
  trackReferralAfterSignup,
  checkAndStoreReferralFromURL,
} from './client/referralTracking';

// Types and Interfaces
export type {
  UserTier,
  TierConfig,
  UserProfile,
  ReferralStatus,
  Referral,
  ReferralStats,
  CreateReferralRequest,
  CreateReferralResult,
  TransactionType,
  ServiceType,
  CreditTransaction,
  CreditBalance,
  ConsumeCreditsRequest,
  ConsumeCreditsResult,
  RefreshCreditsResult,
  DailyCreditAllocation,
} from './types';

// Constants
export { TIER_CONFIGS } from './types';

// Errors
export {
  ReferralSystemError,
  InsufficientCreditsError,
  InvalidReferralCodeError,
  SelfReferralError,
  DuplicateReferralError,
} from './types';
