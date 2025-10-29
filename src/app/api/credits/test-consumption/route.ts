import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/data/supabaseAdmin';

/**
 * POST /api/credits/test-consumption
 * Test credit consumption with proper service name
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const testResult: any = {
      timestamp: new Date().toISOString(),
      userId,
      steps: [],
    };

    // STEP 1: Check if profile exists
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

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

    // STEP 2: Check current balance
    const balanceBefore = profile.daily_credits - profile.credits_used_today;
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
    console.log(`[TEST] Attempting to consume 1 credit for user ${userId}`);
    
    const { data: consumeResult, error: consumeError } = await supabaseAdmin
      .rpc('consume_credits', {
        p_user_id: userId,
        p_amount: 1,
        p_service: 'tarana_gala', // Use valid service name
        p_description: 'TEST - Credit consumption test',
      });

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
    const { data: profileAfter, error: afterError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    const balanceAfter = profileAfter 
      ? profileAfter.daily_credits - profileAfter.credits_used_today
      : 0;

    testResult.steps.push({
      step: 'Check Balance After',
      success: !!profileAfter,
      data: {
        dailyCredits: profileAfter?.daily_credits,
        usedToday: profileAfter?.credits_used_today,
        remaining: balanceAfter
      },
      error: afterError?.message
    });

    // STEP 5: Check transaction was logged
    const { data: transactions, error: txError } = await supabaseAdmin
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('description', 'TEST - Credit consumption test')
      .order('created_at', { ascending: false })
      .limit(1);

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
    console.error('Test consumption error:', error);
    return NextResponse.json(
      {
        error: 'Test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
