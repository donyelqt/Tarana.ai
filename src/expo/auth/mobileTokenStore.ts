/**
 * Expo / React Native contract for the mobile token bridge.
 *
 * This file is intentionally dependency-free and framework-agnostic so it can
 * be copied into an Expo project as the single source of truth for how the
 * mobile app interacts with the web backend.
 *
 * Storage target: `expo-secure-store` (never localStorage or
 * `AsyncStorage` — tokens must not be readable by other apps or JS).
 *
 * Usage:
 *   import { saveMobileToken, getMobileToken, clearMobileToken } from './mobileTokenStore';
 *   await saveMobileToken(token);
 *   const token = await getMobileToken();
 *   await clearMobileToken();
 */

import * as SecureStore from 'expo-secure-store';

const MOBILE_TOKEN_KEY = 'tarana.mobile.token';
const MOBILE_TOKEN_TYPE = 'Bearer';

export interface MobileTokenResponse {
  success: boolean;
  token: string;
  tokenType: string;
  expiresIn: number;
  userId: string;
}

export async function saveMobileToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(MOBILE_TOKEN_KEY, token, {
    keychainService: MOBILE_TOKEN_KEY,
    // Token is short-lived; if the device is locked for a while the value
    // simply expires on the server side.
    requireAuthentication: false,
  });
}

export async function getMobileToken(): Promise<string | null> {
  return SecureStore.getItemAsync(MOBILE_TOKEN_KEY, { keychainService: MOBILE_TOKEN_KEY });
}

export async function clearMobileToken(): Promise<void> {
  await SecureStore.deleteItemAsync(MOBILE_TOKEN_KEY, { keychainService: MOBILE_TOKEN_KEY });
}

/**
 * Exchange a web session for a mobile token.
 *
 * Must be called with the web app's cookies present (e.g. via a shared
 * cookie jar / SFSafariView / WebKit-based browser), never with a bearer
 * token already in the header.
 */
export async function exchangeSessionForMobileToken(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<MobileTokenResponse> {
  const response = await fetchImpl(`${baseUrl}/api/auth/mobile-token`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Mobile token exchange failed with status ${response.status}`);
  }

  const body = (await response.json()) as Partial<MobileTokenResponse>;
  if (!body.success || !body.token) {
    throw new Error('Mobile token exchange returned an invalid response');
  }

  return body as MobileTokenResponse;
}

/**
 * Attach the stored mobile token to outgoing API requests as a bearer token.
 */
export async function withMobileAuth(
  input: string,
  init: RequestInit = {}
): Promise<RequestInit> {
  const token = await getMobileToken();
  const headers = new Headers(init.headers);
  if (token) {
    headers.set('Authorization', `${MOBILE_TOKEN_TYPE} ${token}`);
  }
  return { ...init, headers };
}

export const mobileTokenStore = {
  key: MOBILE_TOKEN_KEY,
  type: MOBILE_TOKEN_TYPE,
  save: saveMobileToken,
  get: getMobileToken,
  clear: clearMobileToken,
  exchange: exchangeSessionForMobileToken,
};