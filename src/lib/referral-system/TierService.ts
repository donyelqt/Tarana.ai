/**
 * Tier Service - Manages user tier calculations and benefits
 */

import { supabaseAdmin } from '../data/supabaseAdmin';
import {
  UserTier,
  TierConfig,
  TIER_CONFIGS,
  ReferralSystemError,
} from './types';

export class TierService {
  /**
   * Calculate user tier based on active referrals
   */
  static calculateTierFromReferrals(activeReferrals: number): UserTier {
    if (activeReferrals >= 5) return 'Voyager';
    if (activeReferrals >= 3) return 'Smart Traveler';
    if (activeReferrals >= 1) return 'Explorer';
    return 'Default';
  }

  /**
   * Get tier configuration
   */
  static getTierConfig(tier: UserTier): TierConfig {
    return TIER_CONFIGS[tier];
  }

  /**
   * Get all tier configurations
   */
  static getAllTiers(): TierConfig[] {
    return Object.values(TIER_CONFIGS);
  }

  /**
   * Update user tier (called by triggers, but can be manually invoked)
   */
  static async updateUserTier(userId: string): Promise<void> {
    if (!supabaseAdmin) {
      throw new ReferralSystemError('Database not available', 'DB_ERROR', true);
    }

    try {
      // Count active referrals
      const { data: referrals, error: countError } = await supabaseAdmin
        .from('referrals')
        .select('id', { count: 'exact', head: true })
        .eq('referrer_id', userId)
        .eq('status', 'active');

      if (countError) throw countError;

      const activeCount = referrals || 0;
      const newTier = this.calculateTierFromReferrals(activeCount);
      const tierConfig = this.getTierConfig(newTier);

      // Update user profile
      const { error: updateError } = await supabaseAdmin
        .from('user_profiles')
        .update({
          active_referrals: activeCount,
          current_tier: newTier,
          daily_credits: tierConfig.dailyCredits,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) throw updateError;
    } catch (error) {
      console.error('Error updating user tier:', error);
      throw new ReferralSystemError(
        'Failed to update user tier',
        'TIER_UPDATE_ERROR',
        true
      );
    }
  }

  /**
   * Get user's current tier
   */
  static async getUserTier(userId: string): Promise<UserTier> {
    if (!supabaseAdmin) {
      throw new ReferralSystemError('Database not available', 'DB_ERROR', true);
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .select('current_tier')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return (data?.current_tier as UserTier) || 'Default';
    } catch (error) {
      console.error('Error getting user tier:', error);
      return 'Default';
    }
  }

  /**
   * Get tier benefits for a specific tier
   */
  static getTierBenefits(tier: UserTier): string[] {
    return this.getTierConfig(tier).benefits;
  }

  /**
   * Get progress to next tier
   */
  static async getTierProgress(
    userId: string
  ): Promise<{
    currentTier: UserTier;
    currentReferrals: number;
    nextTier: UserTier | null;
    nextTierRequirement: number | null;
    progress: number;
  }> {
    if (!supabaseAdmin) {
      throw new ReferralSystemError('Database not available', 'DB_ERROR', true);
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .select('current_tier, active_referrals')
        .eq('id', userId)
        .single();

      if (error) throw error;

      const currentTier = (data?.current_tier as UserTier) || 'Default';
      const currentReferrals = data?.active_referrals || 0;

      const nextTier = this.getNextTier(currentTier);
      const nextTierConfig = nextTier ? this.getTierConfig(nextTier) : null;

      let progress = 0;
      if (nextTierConfig) {
        const currentTierConfig = this.getTierConfig(currentTier);
        const progressReferrals = currentReferrals - currentTierConfig.requiredReferrals;
        const requiredForNext =
          nextTierConfig.requiredReferrals - currentTierConfig.requiredReferrals;
        progress = Math.min(100, (progressReferrals / requiredForNext) * 100);
      }

      return {
        currentTier,
        currentReferrals,
        nextTier,
        nextTierRequirement: nextTierConfig?.requiredReferrals || null,
        progress,
      };
    } catch (error) {
      console.error('Error getting tier progress:', error);
      throw new ReferralSystemError(
        'Failed to get tier progress',
        'TIER_PROGRESS_ERROR',
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
   * Check if user can upgrade tier
   */
  static async canUpgradeTier(userId: string): Promise<boolean> {
    try {
      const progress = await this.getTierProgress(userId);
      return progress.nextTier !== null && progress.progress >= 100;
    } catch (error) {
      console.error('Error checking tier upgrade:', error);
      return false;
    }
  }

  /**
   * Get daily credits for a tier
   */
  static getDailyCreditsForTier(tier: UserTier): number {
    return this.getTierConfig(tier).dailyCredits;
  }

  /**
   * Get required referrals for a tier
   */
  static getRequiredReferralsForTier(tier: UserTier): number {
    return this.getTierConfig(tier).requiredReferrals;
  }
}
