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
  }
}
