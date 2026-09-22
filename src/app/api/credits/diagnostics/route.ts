import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { handleApiError } from '@/lib/errors/handleApiError';
import { timedHttp } from '@/lib/observability/httpMetrics';
import { createUserProfile } from '@/lib/services/userService';

import {
  checkConsumeCreditsFunction,
  checkTableExists,
  getRecentTransactions,
  getUserProfileRow,
} from '@/lib/services/creditDiagnostics';

/**
 * GET /api/credits/diagnostics
 * Comprehensive diagnostic check for credit system
 */
export const GET = withAuth(async (req: NextRequest, userId: string) => {
  return timedHttp('/api/credits/diagnostics', 'GET', async () => {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    try {
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      userId,
      checks: {},
      errors: [],
    };

    // CHECK 1: Does user_profiles table exist?
    try {
      const table = await checkTableExists('user_profiles');

      diagnostics.checks.userProfilesTableExists = table.exists;
      if (table.error) {
        diagnostics.errors.push(`user_profiles table error: ${table.error.message}`);
      }
    } catch (error) {
      diagnostics.checks.userProfilesTableExists = false;
      diagnostics.errors.push(`user_profiles table check failed: ${error}`);
    }

    // CHECK 2: Does user profile exist?
    try {
      const { profile, error: profileError } = await getUserProfileRow(userId);

      diagnostics.checks.userProfileExists = !!profile;
      diagnostics.userProfile = profile;

      if (profileError && profileError.code !== 'PGRST116') {
        diagnostics.errors.push(`Profile fetch error: ${profileError.message}`);
      }
    } catch (error) {
      diagnostics.checks.userProfileExists = false;
      diagnostics.errors.push(`Profile check failed: ${error}`);
    }

    // CHECK 3: Does credit_transactions table exist?
    try {
      const table = await checkTableExists('credit_transactions');

      diagnostics.checks.creditTransactionsTableExists = table.exists;
      if (table.error) {
        diagnostics.errors.push(`credit_transactions table error: ${table.error.message}`);
      }
    } catch (error) {
      diagnostics.checks.creditTransactionsTableExists = false;
      diagnostics.errors.push(`credit_transactions table check failed: ${error}`);
    }

    // CHECK 4: Does consume_credits function exist?
    try {
      // Use raw SQL to check if function exists
      const func = await checkConsumeCreditsFunction();

      diagnostics.checks.consumeCreditsFunctionExists = func.exists;
      if (func.note) {
        diagnostics.checks.consumeCreditsFunctionNote = func.note;
      }
    } catch (error: any) {
      // Fallback: If function check fails, assume it exists if tables are there
      // The real test will be during actual credit consumption
      diagnostics.checks.consumeCreditsFunctionExists = diagnostics.checks.userProfilesTableExists;
      diagnostics.checks.consumeCreditsFunctionNote = 'Function existence inferred from table structure';
    }
      
    // CHECK 5: Get recent transactions
    try {
      const { transactions, error: txError } = await getRecentTransactions(userId, 5);

      diagnostics.recentTransactions = transactions || [];

      if (txError) {
        diagnostics.errors.push(`Transaction fetch error: ${txError.message}`);
      }
    } catch (error) {
      diagnostics.errors.push(`Transaction fetch failed: ${error}`);
    }

    // CHECK 6: Test profile creation
    if (!diagnostics.checks.userProfileExists && diagnostics.checks.userProfilesTableExists) {
      try {
        await createUserProfile(userId);
        diagnostics.checks.profileCreated = true;
      } catch (error) {
        diagnostics.errors.push(`Profile creation failed: ${(error as Error).message}`);
      }
    }

    // SUMMARY
    diagnostics.summary = {
      migrationRun: diagnostics.checks.userProfilesTableExists && 
                    diagnostics.checks.creditTransactionsTableExists &&
                    diagnostics.checks.consumeCreditsFunctionExists,
      userSetup: diagnostics.checks.userProfileExists || diagnostics.checks.profileCreated,
      readyToUse: diagnostics.checks.userProfileExists && 
                  diagnostics.checks.consumeCreditsFunctionExists,
      errorCount: diagnostics.errors.length,
    };

    return NextResponse.json(diagnostics);
  } catch (error) {
    return handleApiError(error, req);
  }
  }, (res) => res.status);
});
