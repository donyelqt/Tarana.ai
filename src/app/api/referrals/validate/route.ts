import { NextRequest, NextResponse } from 'next/server';
import { ReferralService } from '@/lib/referral-system';
import { createRateLimitMiddleware, rateLimitConfigs } from '@/lib/security/rateLimiter';
import { sanitizeText } from '@/lib/security/inputSanitizer';
import { z } from 'zod';
import { handleApiError } from '@/lib/errors/handleApiError';
import { timedHttp } from '@/lib/observability/httpMetrics';
const referralValidationRateLimit = createRateLimitMiddleware(rateLimitConfigs.referralValidation);

const payloadSchema = z.object({
  code: z.string().trim().min(1).max(50),
});

/**
 * POST /api/referrals/validate
 * Validate a referral code (no authentication required)
 */
export async function POST(req: NextRequest) {
  return timedHttp('/api/referrals/validate', 'POST', async () => {
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
    return handleApiError(error, req);
  }
  }, (res) => res.status);
}