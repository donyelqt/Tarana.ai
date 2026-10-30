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

export async function exchangeForMobileToken(): Promise<TokenPayload> {
  const baseUrl = config.webBaseUrl;
  const authUrl = `${baseUrl}/api/auth/signin`;
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
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  return decodeURIComponent(
    Array.prototype.map
      .call(atob(b64 + padding), (c: string) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('')
  );
}

function decodeMobileTokenPayload(token: string): TokenPayload {
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