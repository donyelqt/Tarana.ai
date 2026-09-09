// Ambient type for the Expo secure-store module, which is not installed in
// the Next.js web build. The mobile contract file in src/expo/auth/ uses it
// only as a typed import; consumers should install `expo-secure-store`.
declare module 'expo-secure-store' {
  export interface SecureStoreOptions {
    keychainService?: string;
    requireAuthentication?: boolean;
    authenticationPrompt?: string;
    authenticationType?: any;
  }

  export function getItemAsync(key: string, options?: SecureStoreOptions): Promise<string | null>;
  export function setItemAsync(key: string, value: string, options?: SecureStoreOptions): Promise<void>;
  export function deleteItemAsync(key: string, options?: SecureStoreOptions): Promise<void>;
  export function hasItemAsync(key: string, options?: SecureStoreOptions): Promise<boolean>;
  export function isAvailableAsync(): Promise<boolean>;
}