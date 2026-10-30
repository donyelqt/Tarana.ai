import { supabaseAdmin } from '@/lib/data/supabaseAdmin';

export async function recordTosAcceptance(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('users')
    .update({ tos_accepted_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    throw new Error(`Could not record acceptance: ${error.message}`);
  }
}

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