/**
 * Mobile Supabase client — thin wrapper over the shared web client.
 *
 * `src/lib/data/supabaseClient.ts` reads `process.env.NEXT_PUBLIC_*` at
 * module load and throws if missing, which is correct for the web app but
 * would crash the mobile app (no Node env at runtime). This wrapper injects
 * the values from `app.json` `extra` before delegating to the shared factory,
 * so the mobile app reuses the exact same client construction — one source
 * of truth, no duplicated Supabase setup.
 */
import * as SecureStore from 'expo-secure-store';
import { config, requireConfig } from './config';
import { createSupabaseClientWithToken } from 'tarana-web/data/supabaseClient';

function ensureWebEnv(): void {
  if (config.supabaseUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = config.supabaseUrl;
  if (config.supabaseAnonKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = config.supabaseAnonKey;
}

export async function createMobileSupabaseClient() {
  ensureWebEnv();
  const token = await SecureStore.getItemAsync('tarana.mobileToken');
  if (!token) {
    throw new Error('No mobile token stored. Sign in first.');
  }
  return createSupabaseClientWithToken(token);
}

export async function getSupabaseUrl(): Promise<string> {
  return requireConfig('supabaseUrl');
}