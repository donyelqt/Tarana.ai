import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/data/supabaseAdmin';
import { findUserByEmailFromSupabase } from '@/lib/auth';
import { createRateLimitMiddleware, rateLimitConfigs } from '@/lib/security/rateLimiter';
import { sanitizeEmail } from '@/lib/security/inputSanitizer';
import { applySecurityHeaders } from '@/lib/security/securityHeaders';
import { checkRequiredEnvVars } from '@/lib/security/environmentValidator';
import crypto from 'crypto';

// Strict rate limiter for password reset attempts
const passwordResetRateLimit = createRateLimitMiddleware(rateLimitConfigs.passwordReset);

export async function POST(request: NextRequest) {
  try {
    // Check required environment variables
    checkRequiredEnvVars(['NEXTAUTH_SECRET', 'SUPABASE_SERVICE_ROLE_KEY', 'SMTP_HOST']);

    // Apply strict rate limiting for password reset
    const rateLimitResult = passwordResetRateLimit(request);
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { 
          error: 'Too many password reset attempts. Please try again later.',
          retryAfter: rateLimitResult.retryAfter 
        },
        { status: 429 }
      );
      response.headers.set('Retry-After', rateLimitResult.retryAfter?.toString() || '7200');
      return applySecurityHeaders(response);
    }

    const { email } = await request.json();

    if (!email) {
      return applySecurityHeaders(NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      ));
    }

    // Sanitize email input
    const sanitizedEmail = sanitizeEmail(email);
    if (!sanitizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
      return applySecurityHeaders(NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      ));
    }

    // Check if user exists
    const user = await findUserByEmailFromSupabase(sanitizedEmail);
    
    // Always return success to prevent email enumeration attacks
    if (!user) {
      return applySecurityHeaders(NextResponse.json({
        message: 'If an account with that email exists, we have sent a password reset link.'
      }));
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Store reset token in database
    if (!supabaseAdmin) {
      console.error('Supabase admin client is not initialized.');
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        reset_token: resetToken,
        reset_token_expiry: resetTokenExpiry.toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error storing reset token:', updateError);
      return NextResponse.json(
        { error: 'Failed to process reset request' },
        { status: 500 }
      );
    }

    // Send password reset email
    const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${resetToken}`;
    
    // Import email service dynamically to avoid issues
    const { sendPasswordResetEmail } = await import('@/lib/email');
    const emailSent = await sendPasswordResetEmail(sanitizedEmail, resetUrl);
    
    if (!emailSent) {
      console.warn('Failed to send password reset email, but continuing for security');
    }

    return applySecurityHeaders(NextResponse.json({
      message: 'If an account with that email exists, we have sent a password reset link.'
    }));

  } catch (error) {
    console.error('Forgot password error:', error);
    return applySecurityHeaders(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}
