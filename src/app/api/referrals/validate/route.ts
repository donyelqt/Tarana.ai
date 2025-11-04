import { NextRequest, NextResponse } from 'next/server';
import { ReferralService } from '@/lib/referral-system';
import { createRateLimitMiddleware, rateLimitConfigs } from '@/lib/security/rateLimiter';
import { sanitizeText } from '@/lib/security/inputSanitizer';
import { z } from 'zod';

const referralValidationRateLimit = createRateLimitMiddleware(rateLimitConfigs.referralValidation);

const payloadSchema = z.object({
  code: z.string().trim().min(1).max(50),
});

/**
 * POST /api/referrals/validate
 * Validate a referral code (no authentication required)
 */
export async function POST(req: NextRequest) {
  try {
    const rateLimitResult = referralValidationRateLimit(req);
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        {
          error: 'Too many validation attempts. Please try again later.',
          retryAfter: rateLimitResult.retryAfter,
        },
        { status: 429 }
      );
      if (rateLimitResult.retryAfter) {
        response.headers.set('Retry-After', rateLimitResult.retryAfter.toString());
      }
      return response;
    }

    const rawBody = await req.json();
    const parsedBody = payloadSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Referral code is required' },
        { status: 400 }
      );
    }

    const sanitizedCode = sanitizeText(parsedBody.data.code).replace(/\s+/g, '').toUpperCase().slice(0, 50);

    if (!sanitizedCode) {
      return NextResponse.json(
        { error: 'Referral code is required' },
        { status: 400 }
      );
    }

    const isValid = await ReferralService.validateReferralCode(sanitizedCode);

    return NextResponse.json({
      success: true,
      valid: isValid,
      code: sanitizedCode,
    });
  } catch (error) {
    console.error('Error in /api/referrals/validate:', error);
    return NextResponse.json(
      {
        error: 'Failed to validate referral code',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
