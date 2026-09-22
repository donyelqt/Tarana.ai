/**
 * POST /api/auth/mobile-token
 *
 * Exchanges a valid web next-auth session for a short-lived mobile JWT.
 * The mobile app stores this JWT in `expo-secure-store` and sends it as
 * `Authorization: Bearer <token>` on every subsequent API call.
 *
 * Requires: a signed-in session with accepted Terms of Service.
 * Rate limited to prevent token brute-forcing.
 *
 * Implementation lives in `src/lib/auth/mobileTokenExchange.ts`, shared with
 * the GET redirect target used by the mobile web-browser flow.
 */
import { NextRequest } from 'next/server';
import { runMobileTokenExchange } from '@/lib/auth/mobileTokenExchange';
import { timedHttp } from '@/lib/observability/httpMetrics';

export async function POST(request: NextRequest) {
  return timedHttp('/api/auth/mobile-token', 'POST', async () => {
    const result = await runMobileTokenExchange({ req: request });
    if ('response' in result) return result.response;
    return Response.json(result.value);
  }, (res) => res.status);
}