import { supabaseAdmin } from '@/lib/data/supabaseAdmin';

/**
 * A cached replay result, returned verbatim to a caller who re-sends a key
 * we have already seen. The shape mirrors what a route would have returned:
 * status + body, so the replay is indistinguishable from the original.
 */
export interface IdempotencyReplay {
  status: number;
  body: unknown;
}

/**
 * Check whether an idempotency key has already been recorded for this
 * caller on this route. Returns the cached response on a hit, or `null`
 * on a miss (first request, or a key never seen).
 *
 * The lookup is the *only* read; `recordIdempotencyKey` does the write.
 * Splitting them lets a route check first, run its logic, then record —
 * which is the only ordering that makes replay semantics correct. A single
 * "check-then-write" helper would race: two concurrent requests with the
 * same key would both miss, both run the mutation, and one write would be
 * lost. Callers must: check → execute → record.
 */
export async function checkIdempotency(
  userId: string,
  route: string,
  key: string
): Promise<IdempotencyReplay | null> {
  const { data, error } = await supabaseAdmin
    .from('idempotency_keys')
    .select('status, response_body')
    .eq('user_id', userId)
    .eq('route', route)
    .eq('idempotency_key', key)
    .maybeSingle();

  if (error) {
    // A lookup failure must not silently masquerade as a miss: a transient
    // DB error would let the mutation run, and a retry would double-write.
    // Surface it so the route's existing error handling decides.
    throw error;
  }

  if (!data) return null;
  return { status: data.status, body: data.response_body };
}

/**
 * Record that a key was handled, caching the response so a replay returns
 * the original result. Best-effort: if the insert fails (e.g. a duplicate
 * from a concurrent request that also missed the check), the failure is
 * swallowed and the response is still returned — the caller already got
 * its result, and a missing cache entry only means a future replay runs
 * the mutation again, which is safe because the underlying write is
 * idempotent-by-design (INSERT ... ON CONFLICT DO NOTHING on the entity
 * table) or the replay check catches it next time.
 *
 * The unique index (user_id, route, idempotency_key) means a concurrent
 * duplicate insert fails loudly rather than creating two rows; the
 * swallow below is for that exact case, not for masking real errors.
 */
export async function recordIdempotency(
  userId: string,
  route: string,
  key: string,
  status: number,
  body: unknown
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('idempotency_keys')
    .insert({
      user_id: userId,
      route,
      idempotency_key: key,
      status,
      response_body: body,
    })
    .select()
    .maybeSingle();

  if (error && error.code !== '23505') {
    // 23505 = unique_violation: a concurrent request recorded first. That
    // is the expected race, not a failure — both requests computed the same
    // result and one cache row is enough.
    console.error('[idempotency] failed to record key', {
      userId, route, key, status, error: error.message,
    });
  }
}

/**
 * Extract a caller-supplied idempotency key from a request header.
 *
 * Per plan §2.3 the key is part of the request contract. We accept it from
 * the standard `Idempotency-Key` header (HTTP semantics) and also honor the
 * `X-Idempotency-Key` alias some clients send. A missing header means the
 * caller did not request idempotency — the request runs once, as before.
 * No server-minted key: the caller owns retry identity.
 */
export function getIdempotencyKey(request: Request): string | null {
  const raw = request.headers.get('Idempotency-Key') ?? request.headers.get('X-Idempotency-Key');
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 256) return null;
  return trimmed;
}