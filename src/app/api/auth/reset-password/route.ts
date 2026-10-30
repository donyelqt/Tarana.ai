import { NextRequest, NextResponse } from 'next/server';
import { findUserByResetToken, hashPassword, resetPassword } from '@/lib/services/passwordService';
import { createRateLimitMiddleware, rateLimitConfigs } from '@/lib/security/rateLimiter';
import { validatePasswordStrength } from '@/lib/security/inputSanitizer';
import { checkRequiredEnvVars } from '@/lib/security/environmentValidator';
import { timedHttp } from '@/lib/observability/httpMetrics';
import { logger } from '@/lib/observability/logger';
import { getRequestId } from '@/middleware/requestId';
import { getSafeErrorMetadata } from '@/lib/observability/safeErrorMetadata';

const resetPasswordRateLimit = createRateLimitMiddleware(rateLimitConfigs.auth);

export async function POST(request: NextRequest) {
  return timedHttp('/api/auth/reset-password', 'POST', async () => {
    const requestId = getRequestId(request);
  try {
    
    checkRequiredEnvVars(['NEXTAUTH_SECRET', 'SUPABASE_SERVICE_ROLE_KEY']);

    
    const rateLimitResult = resetPasswordRateLimit(request);
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { 
          error: 'Too many password reset attempts. Please try again later.',
          retryAfter: rateLimitResult.retryAfter 
        },
        { status: 429 }
      );
      response.headers.set('Retry-After', rateLimitResult.retryAfter?.toString() || '300');
      return response;
    }

    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: passwordValidation.errors[0] },
        { status: 400 }
      );
    }

    
    const user = await findUserByResetToken(token);

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    
    if (user.reset_token_expiry) {
      const now = new Date();
      const tokenExpiry = new Date(user.reset_token_expiry);
      if (now > tokenExpiry) {
        return NextResponse.json(
          { error: 'Reset token has expired' },
          { status: 400 }
        );
      }
    }

    
    const hashedPassword = await hashPassword(password);

    
    try {
      await resetPassword(user.id, hashedPassword);
    } catch (updateError) {
      logger.error(
        'Error updating password',
        {
          entryPoint: '/api/auth/reset-password',
          ...getSafeErrorMetadata(updateError),
        },
        requestId
      );
      return NextResponse.json(
        { error: 'Failed to reset password' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Password has been reset successfully'
    });

  } catch (error) {
    logger.error(
      'Reset password error',
      {
        entryPoint: '/api/auth/reset-password',
        ...getSafeErrorMetadata(error),
      },
      requestId
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
  }, (res) => res.status);
}
