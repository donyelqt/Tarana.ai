// src/lib/supabaseAdmin.ts (new file or integrated into auth.ts)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Only initialize the Supabase admin client in a server environment
export const supabaseAdmin =
  typeof window === 'undefined' && supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

if (!supabaseAdmin) {
  console.warn("Supabase admin client not initialized. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in a server environment.");
}