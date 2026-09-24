import { NextRequest, NextResponse } from 'next/server';
import { createUserInSupabase } from '@/lib/auth';
import { createRateLimitMiddleware, rateLimitConfigs } from '@/lib/security/rateLimiter';
import { sanitizeUserRegistration } from '@/lib/security/inputSanitizer';
import { checkRequiredEnvVars } from '@/lib/security/environmentValidator';
import { ReferralService } from '@/lib/referral-system';
import { createUserProfile } from '@/lib/services/userService';
import { timedHttp } from '@/lib/observability/httpMetrics';
import { logger } from '@/lib/observability/logger';
import { getRequestId } from '@/middleware/requestId';
// Rate limiter for registration attempts
const registerRateLimit = createRateLimitMiddleware(rateLimitConfigs.auth);

export async function POST(request: NextRequest) {
  return timedHttp('/api/auth/register', 'POST', async () => {
    const requestId = getRequestId(request);
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
      return response;
    }

    const requestBody = await request.json();
    const { fullName, email, password, referralCode, agreed } = requestBody;

    // Validate required fields
    if (!fullName || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Server-side ToS consent enforcement (client checkbox alone is bypassable
    // via direct POST, so agreement must be asserted in the request body).
    if (agreed !== true) {
      return NextResponse.json(
        { error: 'You must accept the Terms of Service and Privacy Policy' },
        { status: 400 }
      );
    }

    // Validate referral code if provided
    if (referralCode) {
      const isValidReferralCode = await ReferralService.validateReferralCode(referralCode);
      if (!isValidReferralCode) {
        return NextResponse.json(
          { error: 'Invalid referral code' },
          { status: 400 }
        );
      }
    }

    // Comprehensive input sanitization and validation
    const { sanitized, errors } = sanitizeUserRegistration({ fullName, email, password });

    if (errors.length > 0) {
      return NextResponse.json(
        { error: errors[0] }, // Return first error
        { status: 400 }
      );
    }

    try {
      // Create user in Supabase with sanitized data (records ToS acceptance time)
      const newUser = await createUserInSupabase(sanitized.fullName, sanitized.email, sanitized.password, new Date().toISOString());

      // ✅ REFERRAL SYSTEM: Create user profile and handle referral
      if (newUser?.id) {
        try {
          // Create user profile with default tier (non-fatal)
          try {
            await createUserProfile(newUser.id);
          } catch (profileError) {
            logger.error(
              'Error creating user profile',
              {
                entryPoint: '/api/auth/register',
                userId: newUser.id,
                errorName: profileError instanceof Error ? profileError.name : 'UnknownError',
                errorMessage: profileError instanceof Error ? profileError.message : 'Unknown error',
              },
              requestId
            );
          }

          // Create referral relationship if referral code provided
          if (referralCode) {
            const referralResult = await ReferralService.createReferral({
              referralCode,
              newUserId: newUser.id,
            });

            if (referralResult.success) {
              logger.info(
                'Referral created',
                { entryPoint: '/api/auth/register', userId: newUser.id },
                requestId
              );
            } else {
              logger.error(
                'Failed to create referral',
                {
                  entryPoint: '/api/auth/register',
                  userId: newUser.id,
                  errorMessage: referralResult.error,
                },
                requestId
              );
            }
          }
        } catch (profileError) {
          logger.error(
            'Error in referral system setup',
            {
              entryPoint: '/api/auth/register',
              userId: newUser.id,
              errorName: profileError instanceof Error ? profileError.name : 'UnknownError',
              errorMessage: profileError instanceof Error ? profileError.message : 'Unknown error',
            },
            requestId
          );
          // Don't block registration if profile creation fails
        }
      }

      // Return success response (without exposing sensitive data)
      return NextResponse.json(
        { success: true, message: 'User registered successfully' },
        { status: 201 }
      );
    } catch (userError: unknown) {
      // Handle specific user creation errors
      if (userError instanceof Error) {
        if (userError.message === 'User with this email already exists') {
          return NextResponse.json(
            { error: userError.message },
            { status: 409 } // Conflict status code
          );
        }
        // For other errors thrown by createUserInSupabase
        return NextResponse.json(
          { error: userError.message },
          { status: 400 }
        );
      }
      // If it's not an Error instance, re-throw for the outer catch block to handle as 500
      throw userError;
    }
  } catch (error) {
    logger.error(
      'Registration error',
      {
        entryPoint: '/api/auth/register',
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
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