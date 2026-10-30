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