import { claimIdempotency, completeIdempotency, getIdempotencyKey, hashIdempotencyPayload } from '../idempotencyService';

const mockRpc = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/data/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => (mockFrom as jest.Mock)(...args),
    rpc: (...args: unknown[]) => (mockRpc as jest.Mock)(...args),
  },
}));

function insertFrom(result: unknown) {
  const maybeSingle = jest.fn().mockResolvedValue(result);
  const select = jest.fn(() => ({ maybeSingle }));
  const insert = jest.fn(() => ({ select }));
  return { insert, select, maybeSingle };
}

function readFrom(result: unknown) {
  const maybeSingle = jest.fn().mockResolvedValue(result);
  const chain = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle,
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return { select: jest.fn(() => chain), chain, maybeSingle };
}

function updateFrom(result: unknown) {
  const maybeSingle = jest.fn().mockResolvedValue(result);
  const chain = {
    update: jest.fn(),
    eq: jest.fn(),
    select: jest.fn(),
    maybeSingle,
  };
  chain.update.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  return { update: jest.fn(() => chain), chain, maybeSingle };
}

describe('getIdempotencyKey', () => {
  function req(header: string | null) {
    return { headers: { get: (name: string) => (name === header ? 'k' : null) } } as unknown as Request;
  }

  it('reads the Idempotency-Key header', () => {
    expect(getIdempotencyKey(req('Idempotency-Key'))).toBe('k');
  });

  it('reads the X-Idempotency-Key alias', () => {
    expect(getIdempotencyKey(req('X-Idempotency-Key'))).toBe('k');
  });

  it('returns null when no key is sent', () => {
    expect(getIdempotencyKey(req('Other-Header'))).toBe(null);
  });

  it('trims surrounding whitespace', () => {
    const r = { headers: { get: () => '  abc  ' } } as unknown as Request;
    expect(getIdempotencyKey(r)).toBe('abc');
  });

  it('rejects empty keys', () => {
    const r = { headers: { get: () => '   ' } } as unknown as Request;
    expect(getIdempotencyKey(r)).toBe(null);
  });

  it('rejects keys over 256 chars', () => {
    const r = { headers: { get: () => 'a'.repeat(257) } } as unknown as Request;
    expect(getIdempotencyKey(r)).toBe(null);
  });

  it('accepts keys at the 256-char boundary', () => {
    const r = { headers: { get: () => 'a'.repeat(256) } } as unknown as Request;
    expect(getIdempotencyKey(r)).toBe('a'.repeat(256));
  });
});

describe('hashIdempotencyPayload', () => {
  it('is deterministic for the same payload', () => {
    expect(hashIdempotencyPayload({ a: 1 })).toBe(hashIdempotencyPayload({ a: 1 }));
  });

  it('is insensitive to object key order', () => {
    expect(hashIdempotencyPayload({ a: 1, b: 2 })).toBe(hashIdempotencyPayload({ b: 2, a: 1 }));
  });

  it('hashes Date values without dropping them', () => {
    expect(hashIdempotencyPayload({ at: new Date('2026-09-23T00:00:00.000Z') })).toBe(
      hashIdempotencyPayload({ at: '2026-09-23T00:00:00.000Z' })
    );
  });

  it('changes when the payload changes', () => {
    expect(hashIdempotencyPayload({ a: 1 })).not.toBe(hashIdempotencyPayload({ a: 2 }));
  });

  it('returns a 64-char hex digest', () => {
    expect(hashIdempotencyPayload({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('claimIdempotency', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockReset();
    mockRpc.mockResolvedValue({ error: null });
  });

  it('cleans up expired keys, then owns a new key with a short-lived pending row', async () => {
    const insert = insertFrom({ data: { id: 7 }, error: null });
    mockFrom.mockReturnValueOnce(insert);

    const result = await claimIdempotency('u1', '/api/saved-itineraries', 'k1', 'hash-1');

    expect(result).toEqual({ kind: 'owner', rowId: 7 });
    expect(mockRpc).toHaveBeenCalledWith('cleanup_expired_idempotency_keys');
    expect(insert.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      route: '/api/saved-itineraries',
      idempotency_key: 'k1',
      request_hash: 'hash-1',
      status: 0,
      response_body: null,
      expires_at: expect.any(String),
    });
  });
  it('returns conflict when a duplicate key is still in progress', async () => {
    const insert = insertFrom({ data: null, error: { code: '23505', message: 'duplicate' } });
    const read = readFrom({ data: { id: 7, status: 0, response_body: null, request_hash: 'hash-1' }, error: null });
    mockFrom.mockReturnValueOnce(insert).mockReturnValueOnce(read);

    const result = await claimIdempotency('u1', '/api/saved-itineraries', 'k1', 'hash-1');

    expect(result).toEqual({ kind: 'conflict' });
  });

  it('replays the cached response when the duplicate key already completed', async () => {
    const insert = insertFrom({ data: null, error: { code: '23505', message: 'duplicate' } });
    const read = readFrom({
      data: { id: 7, status: 201, response_body: { success: true }, request_hash: 'hash-1' },
      error: null,
    });
    mockFrom.mockReturnValueOnce(insert).mockReturnValueOnce(read);

    const result = await claimIdempotency('u1', '/api/saved-itineraries', 'k1', 'hash-1');

    expect(result).toEqual({ kind: 'replay', replay: { status: 201, body: { success: true } } });
  });

  it('rejects a reused key with a different payload, even while in flight', async () => {
    const insert = insertFrom({ data: null, error: { code: '23505', message: 'duplicate' } });
    const read = readFrom({ data: { id: 7, status: 0, response_body: null, request_hash: 'other' }, error: null });
    mockFrom.mockReturnValueOnce(insert).mockReturnValueOnce(read);

    const result = await claimIdempotency('u1', '/api/saved-itineraries', 'k1', 'hash-1');

    expect(result).toEqual({ kind: 'payload-mismatch' });
  });

  it('surfaces non-duplicate insert errors instead of running the mutation', async () => {
    const insert = insertFrom({ data: null, error: { code: '08000', message: 'connection down' } });
    mockFrom.mockReturnValueOnce(insert);

    await expect(claimIdempotency('u1', '/r', 'k', 'hash-1')).rejects.toThrow('connection down');
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('surfaces cleanup failures before any claim is written', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'cleanup down' } });

    await expect(claimIdempotency('u1', '/r', 'k', 'hash-1')).rejects.toThrow('cleanup down');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('throws when a duplicate row disappears before the read', async () => {
    const insert = insertFrom({ data: null, error: { code: '23505', message: 'duplicate' } });
    const read = readFrom({ data: null, error: null });
    mockFrom.mockReturnValueOnce(insert).mockReturnValueOnce(read);

    await expect(claimIdempotency('u1', '/r', 'k', 'hash-1')).rejects.toThrow('disappeared');
  });
});

describe('completeIdempotency', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('completes only a pending claim and restores the full replay window', async () => {
    const update = updateFrom({ data: { id: 7 }, error: null });
    mockFrom.mockReturnValueOnce(update);

    await completeIdempotency(7, 201, { success: true });

    expect(update.update).toHaveBeenCalledWith({ status: 201, response_body: { success: true }, expires_at: expect.any(String) });
    expect(update.chain.eq).toHaveBeenCalledWith('id', 7);
    expect(update.chain.eq).toHaveBeenCalledWith('status', 0);
  });
  it('surfaces completion failures instead of pretending the replay is cached', async () => {
    const update = updateFrom({ data: null, error: { message: 'write down' } });
    mockFrom.mockReturnValueOnce(update);

    await expect(completeIdempotency(7, 201, {})).rejects.toThrow('write down');
  });

  it('throws when the claim is no longer pending', async () => {
    const update = updateFrom({ data: null, error: null });
    mockFrom.mockReturnValueOnce(update);

    await expect(completeIdempotency(7, 201, {})).rejects.toThrow('no longer pending');
  });
});