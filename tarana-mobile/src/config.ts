/**
 * Runtime config for the mobile app.
 *
 * The web app reads its values from `process.env.*`; on mobile those are not
 * available at import time, so the values ship through `app.json` `extra`
 * and are read via `Constants`. This adapter falls back to `process.env`
 * so the same code path works during local Metro dev against the web env.
 */
import Constants from 'expo-constants';

type MobileConfig = {
  webBaseUrl: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<MobileConfig>;

export const config: MobileConfig = {
  webBaseUrl: (extra.webBaseUrl ?? process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'http://localhost:3000') as string,
  supabaseUrl: (extra.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL) as string | undefined,
  supabaseAnonKey: (extra.supabaseAnonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as string | undefined,
};

export function requireConfig<K extends keyof MobileConfig>(key: K): NonNullable<MobileConfig[K]> {
  const value = config[key];
  if (!value) {
    throw new Error(`Missing config: ${key}. Set it in app.json "extra" or EXPO_PUBLIC_${String(key).toUpperCase()}.`);
  }
  return value as NonNullable<MobileConfig[K]>;
}