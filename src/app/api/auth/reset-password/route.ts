import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createRateLimitMiddleware, rateLimitConfigs } from '@/lib/security/rateLimiter';
import { validatePasswordStrength } from '@/lib/security/inputSanitizer';
import { applySecurityHeaders } from '@/lib/security/securityHeaders';
import { checkRequiredEnvVars } from '@/lib/security/environmentValidator';
import bcrypt from 'bcryptjs';

// Rate limiter for password reset attempts
const resetPasswordRateLimit = createRateLimitMiddleware(rateLimitConfigs.auth);

export async function POST(request: NextRequest) {
  try {
    // Check required environment variables
    checkRequiredEnvVars(['NEXTAUTH_SECRET', 'SUPABASE_SERVICE_ROLE_KEY']);

    // Apply rate limiting
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
      return applySecurityHeaders(response);
    }

    const { token, password } = await request.json();

    if (!token || !password) {
      return applySecurityHeaders(NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      ));
    }

    // Comprehensive password validation
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return applySecurityHeaders(NextResponse.json(
        { error: passwordValidation.errors[0] },
        { status: 400 }
      ));
    }

    // Find user by reset token and check if it's still valid
    if (!supabaseAdmin) {
      console.error('Supabase admin client is not initialized.');
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 }
      );
    }

    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, reset_token, reset_token_expiry')
      .eq('reset_token', token)
      .single();

    if (fetchError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Check if token has expired
    const now = new Date();
    const tokenExpiry = new Date(user.reset_token_expiry);
    
    if (now > tokenExpiry) {
      return NextResponse.json(
        { error: 'Reset token has expired' },
        { status: 400 }
      );
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user's password and clear reset token
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        hashed_password: hashedPassword,
        reset_token: null,
        reset_token_expiry: null,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating password:', updateError);
      return NextResponse.json(
        { error: 'Failed to reset password' },
        { status: 500 }
      );
    }

    return applySecurityHeaders(NextResponse.json({
      message: 'Password has been reset successfully'
    }));

  } catch (error) {
    console.error('Reset password error:', error);
    return applySecurityHeaders(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}
