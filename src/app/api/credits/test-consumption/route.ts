import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { handleApiError } from '@/lib/errors/handleApiError';
import { timedHttp } from '@/lib/observability/httpMetrics';
import { logger } from '@/lib/observability/logger';
import { getRequestId } from '@/middleware/requestId';
import {
  consumeTestCredit,
  getRecentTransactions,
  getUserProfileRow,
} from '@/lib/services/creditDiagnostics';

/**
 * POST /api/credits/test-consumption
 * Test credit consumption with proper service name
 */
export const POST = withAuth(async (req: NextRequest, userId: string) => {
  return timedHttp('/api/credits/test-consumption', 'POST', async () => {
    const requestId = getRequestId(req);
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const testResult: any = {
      timestamp: new Date().toISOString(),
      userId,
      steps: [],
    };

    // STEP 1: Check if profile exists
    const { profile, error: profileError } = await getUserProfileRow(userId);

    testResult.steps.push({
      step: 'Check Profile',
      success: !!profile,
      data: profile,
      error: profileError?.message
    });

    if (!profile) {
      return NextResponse.json({
        ...testResult,
        finalResult: 'FAILED - Profile does not exist'
      });
    }

    const profileRow = profile as { daily_credits: number; credits_used_today: number };

    // STEP 2: Check current balance
    const balanceBefore = profileRow.daily_credits - profileRow.credits_used_today;
    testResult.steps.push({
      step: 'Check Balance Before',
      success: true,
      data: {
        dailyCredits: profile.daily_credits,
        usedToday: profile.credits_used_today,
        remaining: balanceBefore
      }
    });

    // STEP 3: Try to call consume_credits function
    logger.info(
      'Attempting to consume test credit',
      { entryPoint: '/api/credits/test-consumption', userId },
      requestId
    );

    const { data: consumeResult, error: consumeError } = await consumeTestCredit(userId);

    testResult.steps.push({
      step: 'Call consume_credits Function',
      success: !consumeError,
      data: consumeResult,
      error: consumeError ? {
        message: consumeError.message,
        code: consumeError.code,
        details: consumeError.details,
        hint: consumeError.hint
      } : null
    });

    if (consumeError) {
      return NextResponse.json({
        ...testResult,
        finalResult: 'FAILED - consume_credits function error',
        recommendation: consumeError.code === '42883' 
          ? 'Function does not exist - RUN THE MIGRATION!'
          : 'Check error details above'
      });
    }

    // STEP 4: Check balance after
    const { profile: profileAfter, error: afterError } = await getUserProfileRow(userId);
    const afterRow = profileAfter as { daily_credits: number; credits_used_today: number } | null;

    const balanceAfter = afterRow
      ? afterRow.daily_credits - afterRow.credits_used_today
      : 0;

    testResult.steps.push({
      step: 'Check Balance After',
      success: !!profileAfter,
      data: {
        dailyCredits: afterRow?.daily_credits,
        usedToday: afterRow?.credits_used_today,
        remaining: balanceAfter
      },
      error: afterError?.message
    });

    // STEP 5: Check transaction was logged
    const { transactions, error: txError } = await getRecentTransactions(
      userId,
      1,
      'TEST - Credit consumption test'
    );

    testResult.steps.push({
      step: 'Check Transaction Logged',
      success: !txError && transactions && transactions.length > 0,
      data: transactions,
      error: txError?.message
    });

    // FINAL RESULT
    const creditWasConsumed = balanceAfter === balanceBefore - 1;
    const transactionWasLogged = transactions && transactions.length > 0;

    testResult.finalResult = creditWasConsumed && transactionWasLogged
      ? '✅ SUCCESS - Credit system is working!'
      : '❌ FAILED - Credit was not consumed';

    testResult.summary = {
      balanceBefore,
      balanceAfter,
      creditConsumed: creditWasConsumed,
      transactionLogged: transactionWasLogged,
      allStepsSucceeded: testResult.steps.every((s: any) => s.success)
    };

    return NextResponse.json(testResult);
  } catch (error) {
    return handleApiError(error, req);
  }
  }, (res) => res.status);
});
