import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function readEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl) {
    throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!supabaseAnonKey) {
    throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return { supabaseUrl, supabaseAnonKey };
}

function createAuthedClient(accessToken?: string) {
  const { supabaseUrl, supabaseAnonKey } = readEnv();
  return createClient(
    supabaseUrl,
    supabaseAnonKey,
    accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : undefined,
  );
}

export const createSupabaseClientWithToken = (accessToken: string) =>
  createAuthedClient(accessToken);

let cachedBaseClient: SupabaseClient | null = null;

/** Lazily-created shared client. Importing this module must NEVER throw for
 *  missing env (mobile bundling injects env after import); the identical error
 *  surfaces at first use instead. */
export function getSupabase(): SupabaseClient {
  if (!cachedBaseClient) cachedBaseClient = createAuthedClient();
  return cachedBaseClient;
}
