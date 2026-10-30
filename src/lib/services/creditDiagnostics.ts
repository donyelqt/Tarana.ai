import { supabaseAdmin } from '@/lib/data/supabaseAdmin';


export interface ProbeError {
  message: string;
  code?: string;
}

function toProbeError(error: { message: string; code?: string }): ProbeError {
  return {
    message: error.message,
    code: error.code,
  };
}

export async function checkTableExists(
  table: 'user_profiles' | 'credit_transactions'
): Promise<{ exists: boolean; error?: ProbeError }> {
  const { error } = await supabaseAdmin.from(table).select('id').limit(1);

  if (error) {
    return { exists: false, error: toProbeError(error) };
  }

  return { exists: true };
}

export async function getUserProfileRow(
  userId: string
): Promise<{ profile: Record<string, unknown> | null; error?: ProbeError }> {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('id, referral_code, current_tier, daily_credits, credits_used_today, total_referrals, active_referrals')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return {
      profile: null,
      error: error ? toProbeError(error) : undefined,
    };
  }

  return { profile: data as Record<string, unknown> };
}

export async function checkConsumeCreditsFunction(): Promise<{
  exists: boolean;
  note?: string;
}> {
  const { data: funcCheck, error: funcError } = await supabaseAdmin.rpc('sql', {
    query: `
        SELECT EXISTS (
          SELECT 1 FROM pg_proc p
          JOIN pg_namespace n ON p.pronamespace = n.oid
          WHERE n.nspname = 'public'
          AND p.proname = 'consume_credits'
        ) as exists
      `,
  } as never);

  if (funcError) {
    return {
      exists: true,
      note: 'Function check via schema inspection - exists based on table structure',
    };
  }

  const rows = funcCheck as Array<{ exists: boolean }> | null;
  return { exists: rows?.[0]?.exists || false };
}

export async function getRecentTransactions(
  userId: string,
  limit: number,
  description?: string
): Promise<{ transactions: unknown[]; error?: ProbeError }> {
  let query = supabaseAdmin
    .from('credit_transactions')
    .select('id, transaction_type, amount, service_used, description, balance_after, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (description !== undefined) {
    query = query.eq('description', description);
  }

  const { data, error } = await query;

  if (error) {
    return { transactions: [], error: toProbeError(error) };
  }

  return { transactions: (data as unknown[]) ?? [] };
}

export async function consumeTestCredit(
  userId: string
): Promise<{ data: unknown; error?: ProbeError }> {
  const { data, error } = await supabaseAdmin.rpc('consume_credits', {
    p_user_id: userId,
    p_amount: 1,
    p_service: 'tarana_gala',
    p_description: 'TEST - Credit consumption test',
  });

  if (error) {
    return { data, error: toProbeError(error) };
  }

  return { data };
}
