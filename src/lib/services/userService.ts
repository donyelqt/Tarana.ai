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

/**
 * Create the default user profile row. Non-fatal: the caller logs the error
 * and continues, because a missing profile must not block registration.
 */
export async function createUserProfile(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('user_profiles')
    .insert({
      id: userId,
      current_tier: 'Default',
      daily_credits: 5,
      credits_used_today: 0,
      total_referrals: 0,
      active_referrals: 0,
    });

  if (error) {
    throw new Error(`Failed to create user profile: ${error.message}`);
  }
}

/**
 * Check whether a user profile row exists. Lives next to
 * `createUserProfile` (same table, same owner) so callers needing
 * check-then-create (init-profile, diagnostics) don't reimplement the
 * lookup — or a fourth copy of the insert.
 */
export async function userProfileExists(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('id')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return false;
  }

  return true;
}