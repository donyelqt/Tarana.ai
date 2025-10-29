/**
 * Credit Service - Manages credit operations, consumption, and balance tracking
 */

import { supabaseAdmin } from '../data/supabaseAdmin';
import {
  CreditBalance,
  ConsumeCreditsRequest,
  ConsumeCreditsResult,
  RefreshCreditsResult,
  CreditTransaction,
  InsufficientCreditsError,
  ReferralSystemError,
  ServiceType,
  UserTier,
} from './types';

export class CreditService {
  /**
   * Ensure user profile exists, create if not
   */
  private static async ensureUserProfile(userId: string): Promise<void> {
    if (!supabaseAdmin) {
      console.log(`[CreditService] ensureUserProfile: supabaseAdmin not available`);
      return;
    }

    try {
      console.log(`[CreditService] Checking if profile exists for user ${userId}...`);
      
      // Check if profile exists
      const { data: existing, error: checkError } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error(`[CreditService] Error checking profile:`, checkError);
      }

      if (!existing) {
        // Create profile with default values
        console.log(`[CreditService] Profile not found. Creating profile for user ${userId}...`);
        const { data: newProfile, error: insertError } = await supabaseAdmin
          .from('user_profiles')
          .insert({
            id: userId,
            current_tier: 'Default',
            daily_credits: 5,
            credits_used_today: 0,
            total_referrals: 0,
            active_referrals: 0,
          })
          .select()
          .single();

        if (insertError) {
          console.error('[CreditService] ❌ Error creating user profile:', {
            message: insertError.message,
            code: insertError.code,
            details: insertError.details,
            hint: insertError.hint
          });
        } else {
          console.log(`[CreditService] ✅ User profile created successfully for ${userId}`, newProfile);
        }
      } else {
        console.log(`[CreditService] ✅ Profile exists for user ${userId}`);
      }
    } catch (error: any) {
      console.error('[CreditService] Exception in ensureUserProfile:', {
        error: error?.message || error,
        userId
      });
    }
  }

  /**
   * Get current credit balance for a user
   */
  static async getCurrentBalance(userId: string): Promise<CreditBalance> {
    if (!supabaseAdmin) {
      throw new ReferralSystemError('Database not available', 'DB_ERROR', true);
    }

    try {
      // Ensure user profile exists
      await this.ensureUserProfile(userId);

      // Get user profile with credit info
      const { data: profile, error } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      if (!profile) {
        throw new ReferralSystemError('User profile not found', 'NOT_FOUND', false);
      }

      // Check if credits need refresh (new day)
      const lastRefresh = new Date(profile.last_credit_refresh);
      const now = new Date();
      const needsRefresh = lastRefresh.toDateString() !== now.toDateString();

      let usedToday = profile.credits_used_today;
      if (needsRefresh) {
        // Reset used credits for new day
        usedToday = 0;
        await this.refreshDailyCredits(userId);
      }

      const remainingToday = Math.max(0, profile.daily_credits - usedToday);

      // Calculate next refresh time (midnight Manila time)
      const nextRefresh = new Date();
      nextRefresh.setDate(nextRefresh.getDate() + 1);
      nextRefresh.setHours(0, 0, 0, 0);

      return {
        totalCredits: profile.daily_credits,
        usedToday,
        remainingToday,
        tier: profile.current_tier as UserTier,
        nextRefresh,
        dailyLimit: profile.daily_credits,
      };
    } catch (error) {
      console.error('Error getting credit balance:', error);
      throw new ReferralSystemError(
        'Failed to get credit balance',
        'BALANCE_ERROR',
        true
      );
    }
  }

  /**
   * Consume credits for a service
   */
  static async consumeCredits(
    request: ConsumeCreditsRequest
  ): Promise<ConsumeCreditsResult> {
    if (!supabaseAdmin) {
      throw new ReferralSystemError('Database not available', 'DB_ERROR', true);
    }

    const { userId, amount, service, description } = request;

    try {
      console.log(`[CreditService] Starting credit consumption for user ${userId}, amount: ${amount}, service: ${service}`);
      
      // Ensure user profile exists before consuming credits
      await this.ensureUserProfile(userId);
      console.log(`[CreditService] User profile check completed for ${userId}`);

      // Call the database function to consume credits atomically
      console.log(`[CreditService] Calling consume_credits RPC function...`);
      const { data, error } = await supabaseAdmin.rpc('consume_credits', {
        p_user_id: userId,
        p_amount: amount,
        p_service: service,
        p_description: description || `Used ${amount} credit(s) for ${service}`,
      });

      if (error) {
        console.error(`[CreditService] RPC Error:`, {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      console.log(`[CreditService] RPC Response:`, { data });

      // Check if consumption was successful
      if (!data) {
        console.log(`[CreditService] Consumption returned false - insufficient credits`);
        const balance = await this.getCurrentBalance(userId);
        throw new InsufficientCreditsError(
          amount,
          balance.remainingToday,
          service
        );
      }

      // Get updated balance
      const newBalance = await this.getCurrentBalance(userId);
      console.log(`[CreditService] ✅ Credit consumption successful. New balance:`, newBalance);

      return {
        success: true,
        remainingCredits: newBalance.remainingToday,
      };
    } catch (error: any) {
      if (error instanceof InsufficientCreditsError) {
        console.log(`[CreditService] Insufficient credits error`, error);
        throw error;
      }
      console.error('[CreditService] Credit consumption error:', {
        error: error?.message || error,
        code: error?.code,
        details: error?.details,
        userId,
        amount,
        service
      });
      throw new ReferralSystemError(
        `Failed to consume credits: ${error?.message || 'Unknown error'}`,
        'CONSUME_ERROR',
        true
      );
    }
  }

  /**
   * Refresh daily credits (called at midnight or manually)
   */
  static async refreshDailyCredits(userId: string): Promise<RefreshCreditsResult> {
    if (!supabaseAdmin) {
      throw new ReferralSystemError('Database not available', 'DB_ERROR', true);
    }

    try {
      // Reset used credits and update last refresh timestamp
      const { error: updateError } = await supabaseAdmin
        .from('user_profiles')
        .update({
          credits_used_today: 0,
          last_credit_refresh: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Log the refresh transaction
      const profile = await supabaseAdmin
        .from('user_profiles')
        .select('daily_credits, current_tier')
        .eq('id', userId)
        .single();

      if (profile.data) {
        await supabaseAdmin.from('credit_transactions').insert({
          user_id: userId,
          transaction_type: 'refresh',
          amount: profile.data.daily_credits,
          description: 'Daily credit refresh',
          balance_after: profile.data.daily_credits,
        });

        // Create daily allocation record
        await supabaseAdmin.from('daily_credit_allocations').insert({
          user_id: userId,
          allocation_date: new Date().toISOString().split('T')[0],
          base_credits: 5,
          bonus_credits: profile.data.daily_credits - 5,
          tier: profile.data.current_tier,
        });
      }

      // Get updated balance
      const newBalance = await this.getCurrentBalance(userId);

      return {
        success: true,
        newBalance,
      };
    } catch (error) {
      console.error('Error refreshing credits:', error);
      throw new ReferralSystemError(
        'Failed to refresh credits',
        'REFRESH_ERROR',
        true
      );
    }
  }

  /**
   * Get credit transaction history
   */
  static async getCreditHistory(
    userId: string,
    limit: number = 20
  ): Promise<CreditTransaction[]> {
    if (!supabaseAdmin) {
      throw new ReferralSystemError('Database not available', 'DB_ERROR', true);
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('credit_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((tx) => ({
        id: tx.id,
        userId: tx.user_id,
        transactionType: tx.transaction_type,
        amount: tx.amount,
        serviceUsed: tx.service_used,
        description: tx.description,
        balanceAfter: tx.balance_after,
        createdAt: new Date(tx.created_at),
      }));
    } catch (error) {
      console.error('Error getting credit history:', error);
      throw new ReferralSystemError(
        'Failed to get credit history',
        'HISTORY_ERROR',
        true
      );
    }
  }

  /**
   * Check if user has sufficient credits
   */
  static async hasSufficientCredits(
    userId: string,
    requiredAmount: number
  ): Promise<boolean> {
    try {
      const balance = await this.getCurrentBalance(userId);
      return balance.remainingToday >= requiredAmount;
    } catch (error) {
      console.error('Error checking credits:', error);
      return false;
    }
  }

  /**
   * Get available credits (helper function)
   */
  static async getAvailableCredits(userId: string): Promise<number> {
    try {
      const balance = await this.getCurrentBalance(userId);
      return balance.remainingToday;
    } catch (error) {
      console.error('Error getting available credits:', error);
      return 0;
    }
  }
}
