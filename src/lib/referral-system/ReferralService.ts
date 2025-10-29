/**
 * Referral Service - Manages referral codes, relationships, and statistics
 */

import { supabaseAdmin } from '../data/supabaseAdmin';
import {
  CreateReferralRequest,
  CreateReferralResult,
  Referral,
  ReferralStats,
  ReferralSystemError,
  InvalidReferralCodeError,
  SelfReferralError,
  DuplicateReferralError,
  UserTier,
  TIER_CONFIGS,
} from './types';

export class ReferralService {
  /**
   * Create a new referral relationship
   */
  static async createReferral(
    request: CreateReferralRequest
  ): Promise<CreateReferralResult> {
    if (!supabaseAdmin) {
      throw new ReferralSystemError('Database not available', 'DB_ERROR', true);
    }

    const { referralCode, newUserId } = request;

    try {
      // Find referrer by code
      const { data: referrerProfile, error: referrerError } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('referral_code', referralCode)
        .single();

      if (referrerError || !referrerProfile) {
        throw new InvalidReferralCodeError(referralCode);
      }

      const referrerId = referrerProfile.id;

      // Check for self-referral
      if (referrerId === newUserId) {
        throw new SelfReferralError();
      }

      // Check for existing referral
      const { data: existingReferral } = await supabaseAdmin
        .from('referrals')
        .select('id')
        .eq('referrer_id', referrerId)
        .eq('referee_id', newUserId)
        .single();

      if (existingReferral) {
        throw new DuplicateReferralError();
      }

      // Create referral relationship
      const { data: newReferral, error: insertError } = await supabaseAdmin
        .from('referrals')
        .insert({
          referrer_id: referrerId,
          referee_id: newUserId,
          referral_code: referralCode,
          status: 'active',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Triggers will automatically update tier and counts

      return {
        success: true,
        referralId: newReferral.id,
      };
    } catch (error) {
      if (
        error instanceof InvalidReferralCodeError ||
        error instanceof SelfReferralError ||
        error instanceof DuplicateReferralError
      ) {
        return {
          success: false,
          error: error.message,
        };
      }

      console.error('Error creating referral:', error);
      throw new ReferralSystemError(
        'Failed to create referral',
        'CREATE_ERROR',
        true
      );
    }
  }

  /**
   * Get referral statistics for a user
   */
  static async getReferralStats(userId: string): Promise<ReferralStats> {
    if (!supabaseAdmin) {
      throw new ReferralSystemError('Database not available', 'DB_ERROR', true);
    }

    try {
      // Get user profile
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      // Get recent referrals with referee info
      const { data: referrals, error: referralsError } = await supabaseAdmin
        .from('referrals')
        .select(`
          *,
          referee:user_profiles!referrals_referee_id_fkey(
            id,
            referral_code
          )
        `)
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (referralsError) throw referralsError;

      const currentTier = profile.current_tier as UserTier;
      const activeReferrals = profile.active_referrals;

      // Calculate next tier requirement
      const nextTier = this.getNextTier(currentTier);
      const nextTierConfig = nextTier ? TIER_CONFIGS[nextTier] : null;
      const nextTierRequirement = nextTierConfig
        ? nextTierConfig.requiredReferrals - activeReferrals
        : 0;

      // Calculate total bonus credits
      const bonusCredits = profile.daily_credits - 5; // Base is 5

      return {
        totalReferrals: profile.total_referrals,
        activeReferrals: profile.active_referrals,
        currentTier,
        nextTierRequirement: Math.max(0, nextTierRequirement),
        totalBonusCredits: bonusCredits,
        recentReferrals: (referrals || []).map((ref) => ({
          id: ref.id,
          referrerId: ref.referrer_id,
          refereeId: ref.referee_id,
          referralCode: ref.referral_code,
          status: ref.status,
          createdAt: new Date(ref.created_at),
          activatedAt: new Date(ref.activated_at),
        })),
      };
    } catch (error) {
      console.error('Error getting referral stats:', error);
      throw new ReferralSystemError(
        'Failed to get referral stats',
        'STATS_ERROR',
        true
      );
    }
  }

  /**
   * Validate a referral code
   */
  static async validateReferralCode(code: string): Promise<boolean> {
    if (!supabaseAdmin) {
      throw new ReferralSystemError('Database not available', 'DB_ERROR', true);
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('referral_code', code)
        .single();

      return !error && !!data;
    } catch (error) {
      console.error('Error validating referral code:', error);
      return false;
    }
  }

  /**
   * Get user's referral code
   */
  static async getUserReferralCode(userId: string): Promise<string | null> {
    if (!supabaseAdmin) {
      throw new ReferralSystemError('Database not available', 'DB_ERROR', true);
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .select('referral_code')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data?.referral_code || null;
    } catch (error) {
      console.error('Error getting referral code:', error);
      return null;
    }
  }

  /**
   * Get active referrals for a user
   */
  static async getActiveReferrals(userId: string): Promise<Referral[]> {
    if (!supabaseAdmin) {
      throw new ReferralSystemError('Database not available', 'DB_ERROR', true);
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('referrals')
        .select('*')
        .eq('referrer_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((ref) => ({
        id: ref.id,
        referrerId: ref.referrer_id,
        refereeId: ref.referee_id,
        referralCode: ref.referral_code,
        status: ref.status,
        createdAt: new Date(ref.created_at),
        activatedAt: new Date(ref.activated_at),
      }));
    } catch (error) {
      console.error('Error getting active referrals:', error);
      throw new ReferralSystemError(
        'Failed to get active referrals',
        'ACTIVE_REFERRALS_ERROR',
        true
      );
    }
  }

  /**
   * Update referral status
   */
  static async updateReferralStatus(
    referralId: string,
    status: 'active' | 'inactive'
  ): Promise<void> {
    if (!supabaseAdmin) {
      throw new ReferralSystemError('Database not available', 'DB_ERROR', true);
    }

    try {
      const { error } = await supabaseAdmin
        .from('referrals')
        .update({ status })
        .eq('id', referralId);

      if (error) throw error;

      // Trigger will automatically recalculate tier
    } catch (error) {
      console.error('Error updating referral status:', error);
      throw new ReferralSystemError(
        'Failed to update referral status',
        'UPDATE_STATUS_ERROR',
        true
      );
    }
  }

  /**
   * Helper: Get next tier
   */
  private static getNextTier(currentTier: UserTier): UserTier | null {
    const tierOrder: UserTier[] = ['Default', 'Explorer', 'Smart Traveler', 'Voyager'];
    const currentIndex = tierOrder.indexOf(currentTier);
    
    if (currentIndex === -1 || currentIndex === tierOrder.length - 1) {
      return null;
    }
    
    return tierOrder[currentIndex + 1];
  }

  /**
   * Get referral code from user ID
   */
  static async getReferralCodeFromUserId(userId: string): Promise<string | null> {
    return this.getUserReferralCode(userId);
  }

  /**
   * Get user ID from referral code
   */
  static async getUserIdFromReferralCode(code: string): Promise<string | null> {
    if (!supabaseAdmin) {
      return null;
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('referral_code', code)
        .single();

      if (error) return null;
      return data?.id || null;
    } catch (error) {
      console.error('Error getting user ID from referral code:', error);
      return null;
    }
  }
}
