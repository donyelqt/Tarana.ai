import { supabaseAdmin } from '@/lib/data/supabaseAdmin';

/**
 * Read-only diagnostics probes for the credit system.
 *
 * These back the dev-only `diagnostics` and `test-consumption` routes (both
 * 404 in production). They are deliberately separate from
 * `referral-system/CreditService`: that class owns money-path domain
 * operations (balance, consume, refund with unlimited-bypass and
 * throw-on-failure semantics), while these probes return raw outcomes
 * ({ data, error } pairs, existence flags) so the routes can assemble
 * step-by-step diagnostic traces — including failure branches like a
 * missing `consume_credits` function that the domain layer would throw on.
 *
 * Probes never throw for query results; they surface `{ error }` and let the
 * route decide. The routes stay thin orchestrators: auth (withAuth),
 * response assembly, and HTTP shape.
 */

export interface ProbeError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

function toProbeError(error: { message: string; code?: string; details?: string; hint?: string }): ProbeError {
  return {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  };
}

/** CHECK 1/3 shape: does `table` exist and answer a probe select? */
export async function checkTableExists(
  table: 'user_profiles' | 'credit_transactions'
): Promise<{ exists: boolean; error?: ProbeError }> {
  const { error } = await supabaseAdmin.from(table).select('id').limit(1);

  if (error) {
    return { exists: false, error: toProbeError(error) };
  }

  return { exists: true };
}

/** Fetch one user profile row. Null profile with a PGRST116 code means
 *  "no rows" — callers treat that as absent, not broken. */
export async function getUserProfileRow(
  userId: string
): Promise<{ profile: Record<string, unknown> | null; error?: ProbeError }> {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
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

/** CHECK 4 shape: does the `consume_credits` RPC function exist?
 *  An RPC-level error (e.g. no `sql` endpoint) falls back to
 *  schema-structure inference, mirroring the route's original fallback.
 *  Unexpected throws (e.g. unconfigured client) propagate so the route's
 *  catch can derive existence from the table checks, as before. */
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

/** Recent credit transactions for a user, newest first. */
export async function getRecentTransactions(
  userId: string,
  limit: number,
  description?: string
): Promise<{ transactions: unknown[]; error?: ProbeError }> {
  let query = supabaseAdmin
    .from('credit_transactions')
    .select('*')
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

/** Raw `consume_credits` RPC call for the consumption test step. Returns the
 *  raw outcome (no throws, no unlimited-bypass, no balance re-reads) so the
 *  route can record step success/failure exactly as before. */
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
