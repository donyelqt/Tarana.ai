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
 * Delete a user account and every row that hangs off it.
 *
 * The privacy page promises "delete or anonymize your personal data"; this is
 * that deletion path. FKs cascade from users for user_profiles, referrals,
 * credit tables and saved_meals (ON DELETE CASCADE), but `itineraries` has no
 * in-repo FK, so its rows are deleted explicitly first. The users row goes
 * last: if any earlier step fails nothing is half-deleted from the caller's
 * point of view (they still exist and can retry).
 *
 * Returns the number of itinerary rows removed. Throws on DB error.
 */
export async function deleteUserAccount(userId: string): Promise<number> {
  const { error: itineraryError, count } = await supabaseAdmin
    .from('itineraries')
    .delete({ count: 'exact' })
    .eq('user_id', userId);

  if (itineraryError) {
    throw new Error(`Failed to delete itineraries: ${itineraryError.message}`);
  }

  const { error: userError } = await supabaseAdmin
    .from('users')
    .delete()
    .eq('id', userId);

  if (userError) {
    throw new Error(`Failed to delete account: ${userError.message}`);
  }

  return count ?? 0;
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