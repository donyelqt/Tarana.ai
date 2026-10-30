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