// src/lib/data/supabaseAdmin.ts
// IMPORTANT: This should ONLY be used on the server-side (API routes, server components)
// NEVER import this in client-side code as it exposes the service role key
import { createClient } from '@supabase/supabase-js';

// Ensure this only runs on server-side
if (typeof window !== 'undefined') {
  throw new Error('supabaseAdmin should never be imported on the client-side!');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}
if (!supabaseServiceKey) {
  throw new Error('Missing env.SUPABASE_SERVICE_ROLE_KEY');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});