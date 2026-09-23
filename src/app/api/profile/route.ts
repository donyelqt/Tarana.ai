import { NextRequest, NextResponse } from 'next/server';
import { withAuthEmail } from '@/lib/auth/withAuth';
import { handleApiError } from '@/lib/errors/handleApiError';
import { timedHttp } from '@/lib/observability/httpMetrics';
import { logger } from '@/lib/observability/logger';
import { getRequestId } from '@/middleware/requestId';
import { claimIdempotency, completeIdempotency, getIdempotencyKey, hashIdempotencyPayload } from '@/lib/services/idempotencyService';
import { getProfileByEmail, updateProfileByEmail } from '@/lib/services/profileService';
import { sanitizeName, sanitizeText } from '@/lib/security/inputSanitizer';

const IDEMPOTENCY_ROUTE = '/api/profile';

// GET - Fetch user profile
export const GET = withAuthEmail(async (req: NextRequest, { email }) => {
  return timedHttp('/api/profile', 'GET', async () => {
  try {
    let user;
    try {
      user = await getProfileByEmail(email);
    } catch (error) {
      logger.error('Error fetching user profile', { error }, getRequestId(req));
      return NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: user.id,
        email: user.email,
        fullName: user.full_name || '',
        image: user.image || '',
        location: user.location || '',
        bio: user.bio || '',
      }
    });
  } catch (error) {
    return handleApiError(error, req);
  }
  }, (res) => res.status);
});
// PATCH - Update user profile
export const PATCH = withAuthEmail(async (req: NextRequest, { email }) => {
  return timedHttp('/api/profile', 'PATCH', async () => {
  try {

    const body = await req.json();
    const { fullName, location, bio } = body;

    const sanitizedFullName = sanitizeName(fullName ?? '');
    const sanitizedLocation = location ? sanitizeText(location).slice(0, 200) : undefined;
    const sanitizedBio = bio ? sanitizeText(bio).slice(0, 500) : undefined;

    // Validation
    if (!sanitizedFullName || sanitizedFullName.length === 0) {
      return NextResponse.json(
        { error: 'Full name is required' },
        { status: 400 }
      );
    }

    if (sanitizedFullName.length > 100) {
      return NextResponse.json(
        { error: 'Full name must be less than 100 characters' },
        { status: 400 }
      );
    }

    if (sanitizedLocation && sanitizedLocation.length > 200) {
      return NextResponse.json(
        { error: 'Location must be less than 200 characters' },
        { status: 400 }
      );
    }

    if (sanitizedBio && sanitizedBio.length > 500) {
      return NextResponse.json(
        { error: 'Bio must be less than 500 characters' },
        { status: 400 }
      );
    }

    const sanitizedUpdate = {
      fullName: sanitizedFullName,
      location: sanitizedLocation,
      bio: sanitizedBio,
    };

    const key = getIdempotencyKey(req);
    const claim = key
      ? await claimIdempotency(email, IDEMPOTENCY_ROUTE, key, hashIdempotencyPayload(sanitizedUpdate))
      : null;

    if (claim?.kind === 'replay') {
      return NextResponse.json(claim.replay.body, { status: claim.replay.status });
    }

    if (claim?.kind === 'conflict') {
      const response = NextResponse.json(
        { error: 'Request is already being processed' },
        { status: 409 }
      );
      response.headers.set('Retry-After', '1');
      return response;
    }

    if (claim?.kind === 'payload-mismatch') {
      return NextResponse.json(
        { error: 'Idempotency key was already used with a different payload' },
        { status: 422 }
      );
    }

    // Update user profile
    let updatedUser;
    try {
      updatedUser = await updateProfileByEmail(email, sanitizedUpdate);
    } catch (error) {
      logger.error('Error updating user profile', { error }, getRequestId(req));
      if (claim?.kind === 'owner') {
        await completeIdempotency(claim.rowId, 500, { error: 'Failed to update profile' }).catch(() => {
          logger.error('[idempotency] failed to cache mutation failure', { route: IDEMPOTENCY_ROUTE, rowId: claim.rowId }, getRequestId(req));
        });
      }
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    const responseBody = {
      success: true,
      message: 'Profile updated successfully',
      profile: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.full_name || '',
        image: updatedUser.image || '',
        location: updatedUser.location || '',
        bio: updatedUser.bio || '',
      }
    };
    const response = NextResponse.json(responseBody);

    if (claim?.kind === 'owner') {
      await completeIdempotency(claim.rowId, 200, responseBody).catch(() => {
        logger.error('[idempotency] failed to complete key', { route: IDEMPOTENCY_ROUTE, rowId: claim.rowId }, getRequestId(req));
      });
    }
    return response;
  } catch (error) {
    return handleApiError(error, req);
  }
  }, (res) => res.status);
});
