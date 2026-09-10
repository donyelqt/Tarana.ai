/**
 * Platform-aware token storage for tarana-mobile.
 *
 * `expo-secure-store` is native-only: on Expo WEB the native module has no
 * implementation, so any call (e.g. `getItemAsync` during `loadAuthState`)
 * throws `ExpoSecureStore.default.getValueWithKeyAsync is not a function`
 * and crashes the app at boot. This adapter keeps the exact
 * `getItemAsync` / `setItemAsync` / `deleteItemAsync` signatures used by
 * `auth.ts` and delegates to `expo-secure-store` on native (`Platform.OS
 * !== 'web'`), falling back to `localStorage` on web.
 *
 * Web fallback notes: `localStorage` access is guarded (`typeof window` /
 * `typeof localStorage` existence + try/catch) so private-mode throws or a
 * missing DOM never crash the caller — reads resolve `null`, writes become
 * no-ops. Security: the short-lived JWT in web `localStorage` is
 * XSS-readable, unlike hardware-backed SecureStore on native. Accepted
 * because (a) tokens are short-lived, (b) web already holds equivalent
 * session cookies, (c) this matches Expo's own documented guidance.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

function isWeb(): boolean {
  return Platform.OS === 'web';
}

function getWebStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

export async function getItemAsync(key: string): Promise<string | null> {
  if (!isWeb()) {
    return SecureStore.getItemAsync(key);
  }
  const store = getWebStorage();
  if (!store) return null;
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (!isWeb()) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  const store = getWebStorage();
  if (!store) return;
  try {
    store.setItem(key, value);
  } catch {
    // Private-mode / quota throw: the token simply won't persist across
    // reloads on this browser. Never crash the sign-in flow over storage.
  }
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (!isWeb()) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  const store = getWebStorage();
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    // Nothing persisted (or already gone) — nothing to clear.
  }
}
