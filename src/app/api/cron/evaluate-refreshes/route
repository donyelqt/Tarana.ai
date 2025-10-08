/**
 * Cron Job API Endpoint - Evaluate Itinerary Refreshes
 * Scheduled background job to check all itineraries for refresh needs
 * 
 * @route GET /api/cron/evaluate-refreshes
 * @author Tarana.ai Engineering Team
 */

import { NextRequest, NextResponse } from 'next/server';
import { evaluateAllItineraries, notifyUsersOfRefreshNeeds } from '@/lib/services/refreshScheduler';

// ============================================================================
// CRON JOB HANDLER
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  console.log('\n' + '='.repeat(80));
  console.log('⏰ CRON JOB TRIGGERED: Evaluate Itinerary Refreshes');
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log('='.repeat(80) + '\n');

  try {
    // ========================================================================
    // 1. AUTHENTICATION
    // ========================================================================
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Verify cron secret (for Vercel Cron or external triggers)
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('❌ Unauthorized: Invalid cron secret');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unauthorized',
          message: 'Invalid authentication token' 
        },
        { status: 401 }
      );
    }

    // If no CRON_SECRET is set, allow only in development
    if (!cronSecret && process.env.NODE_ENV === 'production') {
      console.log('❌ Unauthorized: CRON_SECRET not configured');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Configuration error',
          message: 'CRON_SECRET environment variable not set' 
        },
        { status: 500 }
      );
    }

    console.log('✅ Authentication successful\n');

    // ========================================================================
    // 2. RUN EVALUATION
    // ========================================================================
    const stats = await evaluateAllItineraries();

    // ========================================================================
    // 3. SEND NOTIFICATIONS (Optional)
    // ========================================================================
    if (stats.needsRefreshCount > 0) {
      await notifyUsersOfRefreshNeeds(stats.results);
    }

    // ========================================================================
    // 4. RETURN RESULTS
    // ========================================================================
    const duration = Date.now() - startTime;
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ CRON JOB COMPLETED SUCCESSFULLY');
    console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log('='.repeat(80) + '\n');

    return NextResponse.json({
      success: true,
      message: 'Evaluation completed successfully',
      stats: {
        totalItineraries: stats.totalItineraries,
        evaluatedCount: stats.evaluatedCount,
        needsRefreshCount: stats.needsRefreshCount,
        skippedCount: stats.skippedCount,
        errorCount: stats.errorCount,
        duration: stats.duration
      },
      results: stats.results.filter(r => r.needsRefresh), // Only return those needing refresh
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('\n❌ CRON JOB ERROR:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// MANUAL TRIGGER (POST)
// ============================================================================

/**
 * Manual trigger for testing or admin purposes
 * POST /api/cron/evaluate-refreshes
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('\n🔧 MANUAL TRIGGER: Evaluate Itinerary Refreshes\n');

  try {
    // For manual triggers, we can be more lenient with auth
    // But still require some form of authentication in production
    if (process.env.NODE_ENV === 'production') {
      const authHeader = request.headers.get('authorization');
      const cronSecret = process.env.CRON_SECRET;

      if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    // Parse request body for options
    let options = { notify: true };
    try {
      const body = await request.json();
      options = { ...options, ...body };
    } catch {
      // Use defaults if no body
    }

    // Run evaluation
    const stats = await evaluateAllItineraries();

    // Send notifications if requested
    if (options.notify && stats.needsRefreshCount > 0) {
      await notifyUsersOfRefreshNeeds(stats.results);
    }

    return NextResponse.json({
      success: true,
      message: 'Manual evaluation completed',
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Manual trigger error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
