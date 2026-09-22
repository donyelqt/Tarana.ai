import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { handleApiError } from '@/lib/errors/handleApiError';
import { timedHttp } from '@/lib/observability/httpMetrics';
import { createUserProfile, userProfileExists } from '@/lib/services/userService';

/**
 * Initialize user profile for existing users (one-time fix)
 */
export const POST = withAuth(async (req: NextRequest, userId: string) => {
  return timedHttp('/api/credits/init-profile', 'POST', async () => {
  try {
    // Check if profile already exists
    const exists = await userProfileExists(userId);

    if (exists) {
      return NextResponse.json({
        success: true,
        message: 'Profile already exists',
        action: 'none',
      });
    }

    // Create user profile (same default row as registration)
    try {
      await createUserProfile(userId);
    } catch {
      return NextResponse.json(
        { error: 'Failed to create profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'User profile created successfully',
      action: 'created',
    });
  } catch (error) {
    return handleApiError(error, req);
  }
  }, (res) => res.status);
});
