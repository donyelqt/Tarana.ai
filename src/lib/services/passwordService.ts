import { supabaseAdmin } from '@/lib/data/supabaseAdmin';
import bcrypt from 'bcryptjs';

export interface ResetTokenUser {
  id: string;
  reset_token_expiry: string | null;
}


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


export async function resetPassword(
  userId: string,
  hashedPassword: string
): Promise<boolean> {
  
  
  
  
  
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


export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}