import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { handleApiError } from '@/lib/errors/handleApiError';
import { timedHttp } from '@/lib/observability/httpMetrics';
import { logger } from '@/lib/observability/logger';
import { getRequestId } from '@/middleware/requestId';
import { withRetry } from '@/lib/upstream/withRetry';
import { ReferralService } from '@/lib/referral-system/ReferralService';
import type { CreateReferralResult } from '@/lib/referral-system/types';

/**
 * API endpoint to track referrals after user signup
 * Called from frontend after successful authentication
 */
export const POST = withAuth(async (req: NextRequest, userId: string) => {
  return timedHttp('/api/auth/track-referral', 'POST', async () => {
  const requestId = getRequestId(req);
  try {
    // Get referral code from request body
    const body = await req.json();
    const { referralCode } = body;

    if (!referralCode || typeof referralCode !== 'string' || referralCode.trim().length === 0) {
      return NextResponse.json({
        error: "Invalid referral code",
        success: false
      }, { status: 400 });
    }

    const code = referralCode.trim().toUpperCase();
    logger.info('Tracking referral', { userIdLength: userId.length }, requestId);

    // The caller's profile may not exist immediately after signup, so
    // transient DB failures retry through the shared helper (3 attempts, 1s
    // fixed delay — same budget as the old hand-rolled loop). Business
    // outcomes (invalid/self/duplicate) return { success: false } and are
    // NOT retried: the old loop re-ran them 3x to the same answer.
    let result: CreateReferralResult;
    try {
      result = await withRetry(
        () => ReferralService.createReferral({ referralCode: code, newUserId: userId }),
        { maxAttempts: 3, baseDelayMs: 1000, factor: 1, maxDelayMs: 1000, jitter: 'none' }
      );
    } catch (error) {
      return handleApiError(error, req);
    }

    if (result.success) {
      logger.info('Referral tracked', { referralIdLength: result.referralId?.length ?? 0 }, requestId);
      return NextResponse.json({
        success: true,
        message: "Referral tracked successfully",
        referralId: result.referralId
      });
    } else {
      logger.warn('Referral tracking failed', { errorType: 'referral_rejected' }, requestId);
      return NextResponse.json({
        success: false,
        error: result.error || "Unknown error"
      }, { status: 400 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    // Handle known error types
    if (message.includes('Invalid referral code')) {
      return NextResponse.json(
        { error: 'Invalid referral code' },
        { status: 400 }
      );
    }

    if (message.includes('self-referral')) {
      return NextResponse.json(
        { error: 'You cannot refer yourself' },
        { status: 400 }
      );
    }

    if (message.includes('already exists')) {
      return NextResponse.json(
        { error: 'Referral already exists' },
        { status: 400 }
      );
    }

    return handleApiError(error, req);
  }
  }, (res) => res.status);
});
