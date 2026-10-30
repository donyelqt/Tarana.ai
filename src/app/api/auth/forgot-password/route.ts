import { NextRequest, NextResponse } from 'next/server';
import { storeResetToken, clearExpiredResetTokens } from '@/lib/services/passwordService';
import { findUserByEmailFromSupabase } from '@/lib/auth';
import { createRateLimitMiddleware, rateLimitConfigs } from '@/lib/security/rateLimiter';
import { sanitizeEmail } from '@/lib/security/inputSanitizer';
import { checkRequiredEnvVars } from '@/lib/security/environmentValidator';
import { timedHttp } from '@/lib/observability/httpMetrics';
import { logger } from '@/lib/observability/logger';
import { getRequestId } from '@/middleware/requestId';
import { getSafeErrorMetadata } from '@/lib/observability/safeErrorMetadata';
import crypto from 'crypto';

const passwordResetRateLimit = createRateLimitMiddleware(rateLimitConfigs.passwordReset);

export async function POST(request: NextRequest) {
  return timedHttp('/api/auth/forgot-password', 'POST', async () => {
    const requestId = getRequestId(request);
    try {
      checkRequiredEnvVars(['NEXTAUTH_SECRET', 'SUPABASE_SERVICE_ROLE_KEY', 'SMTP_HOST']);

      const rateLimitResult = passwordResetRateLimit(request);
      if (!rateLimitResult.allowed) {
        const response = NextResponse.json(
          {
            error: 'Too many password reset attempts. Please try again later.',
            retryAfter: rateLimitResult.retryAfter,
          },
          { status: 429 }
        );
        response.headers.set('Retry-After', rateLimitResult.retryAfter?.toString() || '7200');
        return response;
      }

      const { email } = await request.json();

      if (!email) {
        return NextResponse.json(
          { error: 'Email is required' },
          { status: 400 }
        );
      }

      const sanitizedEmail = sanitizeEmail(email);
      if (!sanitizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }

      const user = await findUserByEmailFromSupabase(sanitizedEmail);

      if (!user) {
        return NextResponse.json({
          message: 'If an account with that email exists, we have sent a password reset link.',
        });
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000); 

      try {
        await clearExpiredResetTokens();
      } catch (sweepError) {
        logger.warn('Expired reset-token sweep failed', { entryPoint: '/api/auth/forgot-password', ...getSafeErrorMetadata(sweepError) }, requestId);
      }

      try {
        await storeResetToken(user.id, resetToken, resetTokenExpiry);
      } catch (updateError) {
        logger.error(
          'Error storing reset token',
          {
            entryPoint: '/api/auth/forgot-password',
            ...getSafeErrorMetadata(updateError),
          },
          requestId
        );
        return NextResponse.json(
          { error: 'Failed to process reset request' },
          { status: 500 }
        );
      }

      const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${resetToken}`;

      const { sendPasswordResetEmail } = await import('@/lib/email');
      const emailSent = await sendPasswordResetEmail(sanitizedEmail, resetUrl);

      if (!emailSent) {
        logger.warn(
          'Failed to send password reset email',
          { entryPoint: '/api/auth/forgot-password' },
          requestId
        );
      }

      return NextResponse.json({
        message: 'If an account with that email exists, we have sent a password reset link.',
      });
    } catch (error) {
      logger.error(
        'Forgot password error',
        {
          entryPoint: '/api/auth/forgot-password',
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