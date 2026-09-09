/**
 * GET /api/auth/mobile-token/exchange-redirect
 *
 * Mobile web-browser exchange target. After the user signs in on the web app,
 * NextAuth redirects here; this route runs the exchange server-side against
 * the real session cookie and redirects to the mobile app's custom URL
 * scheme with the JWT in the query string.
 *
 * Why this exists: `WebBrowser.openAuthSessionAsync` shares cookies on iOS
 * (ASWebAuthenticationSession), but on Android it uses Chrome Custom Tabs — a
 * separate browser context that does NOT share cookies with the app's fetch.
 * So a cookie-bearing POST from the mobile app would silently 401 on Android.
 * Running the exchange here, in the web browser's own context, is correct on
 * both platforms.
 *
 * The mobile app parses the `token` query param from the final redirect URL.
 */
import { NextRequest, NextResponse } from 'next/server';
import { runMobileTokenExchange } from '@/lib/auth/mobileTokenExchange';

export async function GET(request: NextRequest) {
  // The mobile app's custom URL scheme, e.g. tarana-mobile://auth/exchange.
  // Must match app.json "scheme".
  const redirectUrl =
    process.env.MOBILE_EXCHANGE_REDIRECT_URL ?? 'tarana-mobile://auth/exchange';

  const result = await runMobileTokenExchange({ req: request, redirectUrl });
  if ('response' in result) return result.response;

  // Should not happen when a redirectUrl is provided, but fail closed rather
  // than returning a bare JSON body the mobile app cannot parse.
  return NextResponse.json(
    { error: 'Exchange did not produce a redirect' },
    { status: 500 }
  );
}