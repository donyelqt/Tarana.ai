/**
 * Mobile auth bridge — consumes the Phase 1 contract.
 *
 * Flow: open the web app in a cookie-bearing auth session → after sign-in
 * the web app redirects to the mobile exchange redirect URL carrying the
 * JWT → parse it from the redirect URL → store via the platform-aware
 * `./tokenStorage` adapter (SecureStore on native, localStorage on web) →
 * as Bearer on all subsequent requests.
 *
 * Why the token comes back in the redirect URL, not via a cookie-bearing
 * POST: `WebBrowser.openAuthSessionAsync` shares cookies on iOS
 * (`ASWebAuthenticationSession`), but on Android it uses Chrome Custom Tabs
 * — a separate browser context that does NOT share cookies with the app's
 * `fetch`. Relying on cookie sharing would silently 401 on Android. Parsing
 * the token out of the redirect URL is correct on both platforms.
 *
 * The web app is the single source of truth for identity; this module is
 * only the transport. It never creates or validates identity itself.
 */
import * as WebBrowser from 'expo-web-browser';
import * as TokenStorage from './tokenStorage';
import { config } from './config';

const MOBILE_TOKEN_KEY = 'tarana.mobileToken';
const MOBILE_TOKEN_CLAIM_KEY = 'tarana.mobileTokenClaim';

export type TokenPayload = {
  sub: string;
  id: string;
  email: string;
  tosAccepted: boolean;
  mobile: boolean;
};

export type AuthState = {
  token: string | null;
  payload: TokenPayload | null;
  loading: boolean;
};

export async function getStoredToken(): Promise<string | null> {
  return TokenStorage.getItemAsync(MOBILE_TOKEN_KEY);
}

export async function clearStoredToken(): Promise<void> {
  await TokenStorage.deleteItemAsync(MOBILE_TOKEN_KEY);
  await TokenStorage.deleteItemAsync(MOBILE_TOKEN_CLAIM_KEY);
}

/**
 * Exchange a web session for a mobile token.
 *
 * The web app signs the user in, then redirects to the web exchange
 * endpoint (/api/auth/mobile-token/exchange-redirect), which runs the
 * exchange server-side against the real session cookie and redirects to the
 * mobile app's custom URL scheme with the JWT in the query string.
 * `openAuthSessionAsync` returns that final URL; we extract the token.
 */
export async function exchangeForMobileToken(): Promise<TokenPayload> {
  const baseUrl = config.webBaseUrl;
  const authUrl = `${baseUrl}/api/auth/signin`;
  // The web exchange endpoint redirects here after issuing the token.
  const webExchangeUrl = `${baseUrl}/api/auth/mobile-token/exchange-redirect`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, webExchangeUrl);

  if (result.type !== 'success') {
    throw new Error('Sign-in was cancelled or did not complete.');
  }

  const token = extractTokenFromRedirect(result.url);
  if (!token) {
    throw new Error('Exchange redirect did not carry a token.');
  }

  const payload = decodeMobileTokenPayload(token);
  await TokenStorage.setItemAsync(MOBILE_TOKEN_KEY, token);
  await TokenStorage.setItemAsync(MOBILE_TOKEN_CLAIM_KEY, JSON.stringify(payload));
  return payload;
}

function extractTokenFromRedirect(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('token');
  } catch {
    return null;
  }
}

function decodeBase64Url(input: string): string {
  // React Native has no Node Buffer; decode base64url with the platform's
  // Atob (Hermes supports it) instead of depending on a Node polyfill.
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  return decodeURIComponent(
    Array.prototype.map
      .call(atob(b64 + padding), (c: string) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('')
  );
}

function decodeMobileTokenPayload(token: string): TokenPayload {
  // JWT: header.payload.signature — payload is base64url JSON.
  const payloadPart = token.split('.')[1];
  if (!payloadPart) throw new Error('Malformed token: missing payload segment.');
  const decoded = JSON.parse(decodeBase64Url(payloadPart)) as Partial<TokenPayload>;
  if (
    decoded.mobile !== true ||
    typeof decoded.sub !== 'string' ||
    typeof decoded.id !== 'string' ||
    typeof decoded.email !== 'string' ||
    decoded.tosAccepted !== true
  ) {
    throw new Error('Token is not a valid mobile token payload.');
  }
  return decoded as TokenPayload;
}

/**
 * Attach the stored mobile token as a Bearer header. Fail-closed: a missing
 * token means the caller must sign in first, never an anonymous request.
 */
export async function withMobileAuth(headers: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await getStoredToken();
  if (!token) {
    throw new Error('No mobile token stored. Call exchangeForMobileToken() first.');
  }
  return { ...headers, Authorization: `Bearer ${token}` };
}

export async function loadAuthState(): Promise<AuthState> {
  const token = await getStoredToken();
  const claim = await TokenStorage.getItemAsync(MOBILE_TOKEN_CLAIM_KEY);
  let payload: TokenPayload | null = null;
  if (claim) {
    try {
      payload = JSON.parse(claim) as TokenPayload;
    } catch {
      payload = null;
    }
  } else if (token) {
    payload = decodeMobileTokenPayload(token);
  }
  return { token, payload, loading: false };
}