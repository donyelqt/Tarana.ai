import { supabaseAdmin } from '@/lib/data/supabaseAdmin';
import bcrypt from 'bcryptjs';

export interface ResetTokenUser {
  id: string;
  reset_token_expiry: string | null;
}

/**
 * Store a reset token for the given user. Token lives one hour.
 *
 * The route owns the token generation (crypto.randomBytes) and the email
 * send; this service owns the DB write so the route can be unit-tested by
 * mocking one function instead of the whole Supabase client chain.
 */
export async function storeResetToken(
  userId: string,
  resetToken: string,
  resetTokenExpiry: Date
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('users')
    .update({
      reset_token: resetToken,
      reset_token_expiry: resetTokenExpiry.toISOString(),
    })
    .eq('id', userId);

  if (error) {
    throw new Error(`Failed to store reset token: ${error.message}`);
  }
}

/**
 * Null expired reset tokens. Retention control: a requested-but-never-used
 * token otherwise lives until the next request overwrites it, extending the
 * takeover window past intent. Called opportunistically by the reset routes;
 * a cron can also invoke it.
 */
export async function clearExpiredResetTokens(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .update({ reset_token: null, reset_token_expiry: null })
    .lt('reset_token_expiry', new Date().toISOString())
    .not('reset_token', 'is', null)
    .select('id');

  if (error) {
    throw new Error(`Failed to clear expired reset tokens: ${error.message}`);
  }

  return data?.length ?? 0;
}

/**
 * Find a user by their reset token. Returns null when no match — the route
 * treats that as an invalid/expired token (400), never as a 500.
 */
export async function findUserByResetToken(
  token: string
): Promise<ResetTokenUser | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, reset_token_expiry')
    .eq('reset_token', token)
    .single();

  if (error || !data) {
    return null;
  }

  return { id: data.id, reset_token_expiry: data.reset_token_expiry };
}

/**
 * Reset the user's password and clear the token. Returns null when the
 * update failed (route maps that to 500).
 */
export async function resetPassword(
  userId: string,
  hashedPassword: string
): Promise<boolean> {
  // `password_changed_at` is written in the same statement as the credential:
  // the session callback rejects tokens stamped before it, so every session
  // that predates this reset (including an attacker's) stops being accepted.
  // Doing it here rather than in the route keeps the invariant at the single
  // write point, so a future second caller cannot change the password without it.
  const { error } = await supabaseAdmin
    .from('users')
    .update({
      hashed_password: hashedPassword,
      reset_token: null,
      reset_token_expiry: null,
      password_changed_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    throw new Error(`Failed to reset password: ${error.message}`);
  }

  return true;
}

/**
 * Hash a plaintext password with bcrypt (10 rounds).
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}