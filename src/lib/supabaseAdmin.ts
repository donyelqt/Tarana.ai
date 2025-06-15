// src/lib/supabaseAdmin.ts (new file or integrated into auth.ts)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
}
if (!supabaseServiceKey) {
  throw new Error("Missing env.SUPABASE_SERVICE_ROLE_KEY");
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);