
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
    requireAuthentication: false,
  });
}

export async function getMobileToken(): Promise<string | null> {
  return SecureStore.getItemAsync(MOBILE_TOKEN_KEY, { keychainService: MOBILE_TOKEN_KEY });
}

export async function clearMobileToken(): Promise<void> {
  await SecureStore.deleteItemAsync(MOBILE_TOKEN_KEY, { keychainService: MOBILE_TOKEN_KEY });
}

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