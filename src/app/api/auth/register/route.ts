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
import { getSafeErrorMetadata } from '@/lib/observability/safeErrorMetadata';

const registerRateLimit = createRateLimitMiddleware(rateLimitConfigs.auth);

export async function POST(request: NextRequest) {
  return timedHttp('/api/auth/register', 'POST', async () => {
    const requestId = getRequestId(request);
  try {
    
    checkRequiredEnvVars(['NEXTAUTH_SECRET', 'SUPABASE_SERVICE_ROLE_KEY']);

    
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

    
    if (!fullName || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    
    
    if (agreed !== true) {
      return NextResponse.json(
        { error: 'You must accept the Terms of Service and Privacy Policy' },
        { status: 400 }
      );
    }

    
    
    
    
    const normalizedReferralCode = typeof referralCode === 'string'
      ? referralCode.trim().toUpperCase()
      : '';

    
    if (normalizedReferralCode) {
      const isValidReferralCode = await ReferralService.validateReferralCode(normalizedReferralCode);
      if (!isValidReferralCode) {
        return NextResponse.json(
          { error: 'Invalid referral code' },
          { status: 400 }
        );
      }
    }

    
    const { sanitized, errors } = sanitizeUserRegistration({ fullName, email, password });

    if (errors.length > 0) {
      return NextResponse.json(
        { error: errors[0] }, 
        { status: 400 }
      );
    }

    try {
      
      const newUser = await createUserInSupabase(sanitized.fullName, sanitized.email, sanitized.password, new Date().toISOString());

      
      if (newUser?.id) {
        try {
          
          try {
            await createUserProfile(newUser.id);
          } catch (profileError) {
            logger.error(
              'Error creating user profile',
              {
                entryPoint: '/api/auth/register',
                userIdLength: newUser.id.length,
                ...getSafeErrorMetadata(profileError),
              },
              requestId
            );
          }

          
          if (normalizedReferralCode) {
            const referralResult = await ReferralService.createReferral({
              referralCode: normalizedReferralCode,
              newUserId: newUser.id,
            });

            if (referralResult.success) {
              logger.info(
                'Referral created',
                { entryPoint: '/api/auth/register', userIdLength: newUser.id.length },
                requestId
              );
            } else {
              logger.error(
                'Failed to create referral',
                {
                  entryPoint: '/api/auth/register',
                  errorType: 'referral_rejected',
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
              userIdLength: newUser.id.length,
              ...getSafeErrorMetadata(profileError),
            },
            requestId
          );
          
        }
      }

      
      return NextResponse.json(
        { success: true, message: 'User registered successfully' },
        { status: 201 }
      );
    } catch (userError: unknown) {
      
      
      
      
      logger.warn(
        'Account creation did not complete',
        {
          entryPoint: '/api/auth/register',
          ...getSafeErrorMetadata(userError),
        },
        requestId
      );
      return NextResponse.json(
        { error: 'Could not create account with the provided details' },
        { status: 400 }
      );
    }
  } catch (error) {
    logger.error(
      'Registration error',
      {
        entryPoint: '/api/auth/register',
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