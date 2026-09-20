import { supabaseAdmin } from '@/lib/data/supabaseAdmin';

/**
 * Records ToS/Privacy acceptance for the signed-in user.
 *
 * The consent route owns the HTTP shape (200/401/500 + body); this service
 * owns the DB write. Keeping the two apart means the route can be unit-tested
 * by mocking a single function instead of the whole Supabase client chain.
 */
export async function recordTosAcceptance(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('users')
    .update({ tos_accepted_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    throw new Error(`Could not record acceptance: ${error.message}`);
  }
}