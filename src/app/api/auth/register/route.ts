import { NextRequest, NextResponse } from 'next/server';
import { createUserInSupabase } from '@/lib/auth';
import { createRateLimitMiddleware, rateLimitConfigs } from '@/lib/security/rateLimiter';
import { sanitizeUserRegistration } from '@/lib/security/inputSanitizer';
import { applySecurityHeaders } from '@/lib/security/securityHeaders';
import { checkRequiredEnvVars } from '@/lib/security/environmentValidator';
import { ReferralService } from '@/lib/referral-system';
import { supabaseAdmin } from '@/lib/data/supabaseAdmin';

// Rate limiter for registration attempts
const registerRateLimit = createRateLimitMiddleware(rateLimitConfigs.auth);

export async function POST(request: NextRequest) {
  try {
    // Check required environment variables
    checkRequiredEnvVars(['NEXTAUTH_SECRET', 'SUPABASE_SERVICE_ROLE_KEY']);

    // Apply rate limiting
    const rateLimitResult = registerRateLimit(request);
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { 
          error: 'Too many registration attempts. Please try again later.',
          retryAfter: rateLimitResult.retryAfter 
        },
        { status: 429 }
      );
      response.headers.set('Retry-After', rateLimitResult.retryAfter?.toString() || '300');
      return applySecurityHeaders(response);
    }

    const requestBody = await request.json();
    const { fullName, email, password, referralCode } = requestBody;

    // Validate required fields
    if (!fullName || !email || !password) {
      return applySecurityHeaders(NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      ));
    }

    // Validate referral code if provided
    if (referralCode) {
      const isValidReferralCode = await ReferralService.validateReferralCode(referralCode);
      if (!isValidReferralCode) {
        return applySecurityHeaders(NextResponse.json(
          { error: 'Invalid referral code' },
          { status: 400 }
        ));
      }
    }

    // Comprehensive input sanitization and validation
    const { sanitized, errors } = sanitizeUserRegistration({ fullName, email, password });
    
    if (errors.length > 0) {
      return applySecurityHeaders(NextResponse.json(
        { error: errors[0] }, // Return first error
        { status: 400 }
      ));
    }

    try {
      // Create user in Supabase with sanitized data
      const newUser = await createUserInSupabase(sanitized.fullName, sanitized.email, sanitized.password);

      // ✅ REFERRAL SYSTEM: Create user profile and handle referral
      if (supabaseAdmin && newUser?.id) {
        try {
          // Create user profile with default tier
          const { error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .insert({
              id: newUser.id,
              current_tier: 'Default',
              daily_credits: 5,
              credits_used_today: 0,
              total_referrals: 0,
              active_referrals: 0,
            });

          if (profileError) {
            console.error('Error creating user profile:', profileError);
          }

          // Create referral relationship if referral code provided
          if (referralCode) {
            const referralResult = await ReferralService.createReferral({
              referralCode,
              newUserId: newUser.id,
            });

            if (referralResult.success) {
              console.log(`✅ Referral created for user ${newUser.id} with code ${referralCode}`);
            } else {
              console.error('Failed to create referral:', referralResult.error);
            }
          }
        } catch (profileError) {
          console.error('Error in referral system setup:', profileError);
          // Don't block registration if profile creation fails
        }
      }

      // Return success response (without exposing sensitive data)
      return applySecurityHeaders(NextResponse.json(
        { success: true, message: 'User registered successfully' },
        { status: 201 }
      ));
    } catch (userError: unknown) {
      // Handle specific user creation errors
      if (userError instanceof Error) {
        if (userError.message === 'User with this email already exists') {
          return applySecurityHeaders(NextResponse.json(
            { error: userError.message },
            { status: 409 } // Conflict status code
          ));
        }
        // For other errors thrown by createUserInSupabase
        return applySecurityHeaders(NextResponse.json(
          { error: userError.message }, 
          { status: 400 }
        ));
      }
      // If it's not an Error instance, re-throw for the outer catch block to handle as 500
      throw userError; 
    }
  } catch (error) {
    console.error('Registration error:', error);
    return applySecurityHeaders(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}