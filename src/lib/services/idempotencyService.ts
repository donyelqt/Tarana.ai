import { createHash } from 'node:crypto';
import { supabaseAdmin } from '@/lib/data/supabaseAdmin';

const IN_PROGRESS_STATUS = 0;

export interface IdempotencyReplay {
  status: number;
  body: unknown;
}
export type IdempotencyClaim =
  | { kind: 'owner'; rowId: number }
  | { kind: 'replay'; replay: IdempotencyReplay }
  | { kind: 'conflict' }
  | { kind: 'payload-mismatch' };

function stableStringify(value: unknown): string | undefined {
  if (value instanceof Date) return JSON.stringify(value);
  if (Array.isArray(value)) {
    const items = value.map((item) => stableStringify(item) ?? 'null');
    return `[${items.join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([name, entryValue]) => `${JSON.stringify(name)}:${stableStringify(entryValue) ?? 'null'}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

export function hashIdempotencyPayload(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload) ?? 'null').digest('hex');
}

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return new Error(String(error.message));
  }
  return new Error('Idempotency store operation failed');
}

function pendingClaimExpiry(pendingTtlMs: number): string {
  return new Date(Date.now() + pendingTtlMs).toISOString();
}

function completedResponseExpiry(): string {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

async function cleanupExpiredIdempotencyKeys(): Promise<void> {
  const { error } = await supabaseAdmin.rpc('cleanup_expired_idempotency_keys');
  if (error) throw toError(error);
}

async function readStoredResult(
  userId: string,
  route: string,
  key: string,
  requestHash: string
): Promise<IdempotencyClaim> {
  const { data, error } = await supabaseAdmin
    .from('idempotency_keys')
    .select('id, status, response_body, request_hash')
    .eq('user_id', userId)
    .eq('route', route)
    .eq('idempotency_key', key)
    .maybeSingle();

  if (error) throw toError(error);
  if (!data) throw new Error('Idempotency key disappeared during claim');

  if (data.request_hash != null && data.request_hash !== requestHash) {
    return { kind: 'payload-mismatch' };
  }

  if (data.status === IN_PROGRESS_STATUS) return { kind: 'conflict' };

  return {
    kind: 'replay',
    replay: { status: data.status, body: data.response_body },
  };
}

export async function claimIdempotency(
  userId: string,
  route: string,
  key: string,
  requestHash: string,
  pendingTtlMs: number = 5 * 60 * 1000
): Promise<IdempotencyClaim> {
  await cleanupExpiredIdempotencyKeys();

  const { data, error } = await supabaseAdmin
    .from('idempotency_keys')
    .insert({
      user_id: userId,
      route,
      idempotency_key: key,
      request_hash: requestHash,
      status: IN_PROGRESS_STATUS,
      response_body: null,
      expires_at: pendingClaimExpiry(pendingTtlMs),
    })
    .select('id')
    .maybeSingle();

  if (!error) {
    if (!data) throw new Error('Idempotency claim did not return a row');
    return { kind: 'owner', rowId: data.id };
  }

  if (error.code !== '23505') throw toError(error);
  return readStoredResult(userId, route, key, requestHash);
}

export async function completeIdempotency(
  rowId: number,
  status: number,
  body: unknown
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('idempotency_keys')
    .update({ status, response_body: body, expires_at: completedResponseExpiry() })
    .eq('id', rowId)
    .eq('status', IN_PROGRESS_STATUS)
    .select('id')
    .maybeSingle();

  if (error) throw toError(error);
  if (!data) throw new Error('Idempotency claim is no longer pending');
}

export function getIdempotencyKey(request: Request): string | null {
  const raw = request.headers.get('Idempotency-Key') ?? request.headers.get('X-Idempotency-Key');
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 256) return null;
  return trimmed;
}