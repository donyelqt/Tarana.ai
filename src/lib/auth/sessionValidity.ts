
import { supabaseAdmin } from '@/lib/data/supabaseAdmin';
import { logger } from '@/lib/observability/logger';
import { getSafeErrorMetadata } from '@/lib/observability/safeErrorMetadata';

const LOG_ENTRY_POINT = 'auth';

export const PASSWORD_CHANGED_CLAIM = 'pwdChangedAt';

export interface SessionTokenState {
  id?: string;
  pwdChangedAt?: string | null;
}

export interface TokenIdentity {
  id?: unknown;
  sub?: unknown;
}


export function resolveTokenUserId(token: TokenIdentity | null | undefined): string | undefined {
  const id = token?.id;
  if (typeof id === 'string' && id.length > 0) return id;
  return undefined;
}

export async function readPasswordChangedAt(userId: string): Promise<string | null | undefined> {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('password_changed_at')
      .eq('id', userId)
      .single();

    if (error) {
      logger.warn('Password-change lookup failed; session accepted', {
        entryPoint: LOG_ENTRY_POINT,
        ...getSafeErrorMetadata(error),
      });
      return undefined;
    }

    const value = (data as { password_changed_at?: string | null } | null)?.password_changed_at;
    return value ?? null;
  } catch (error) {
    logger.warn('Password-change lookup threw; session accepted', {
      entryPoint: LOG_ENTRY_POINT,
      ...getSafeErrorMetadata(error),
    });
    return undefined;
  }
}

export function isSessionTokenCurrent(
  token: SessionTokenState & TokenIdentity,
  currentChangedAt: string | null | undefined
): boolean {
  if (!resolveTokenUserId(token)) return true; 
  if (currentChangedAt === undefined) return true; 
  const stamped = token.pwdChangedAt ?? null;
  return stamped === currentChangedAt;
}
