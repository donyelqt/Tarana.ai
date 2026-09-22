import { checkIdempotency, getIdempotencyKey, recordIdempotency } from '../idempotencyService';

const maybeSingle = jest.fn();
const insertSelectMaybeSingle = jest.fn();

jest.mock('@/lib/data/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle,
      insert: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        maybeSingle: insertSelectMaybeSingle,
      })),
    })),
  },
}));

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

describe('checkIdempotency', () => {
  beforeEach(() => {
    maybeSingle.mockReset();
    insertSelectMaybeSingle.mockReset();
  });

  it('returns null on a cache miss', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await checkIdempotency('u1', '/api/saved-itineraries', 'k1');
    expect(result).toBe(null);
  });

  it('returns the cached replay on a hit', async () => {
    // The column is response_body; the service maps it to body on the way out.
    maybeSingle.mockResolvedValue({
      data: { status: 201, response_body: { success: true, data: { id: 'it_1' } } },
      error: null,
    });
    const result = await checkIdempotency('u1', '/api/saved-itineraries', 'k1');
    expect(result).toEqual({ status: 201, body: { success: true, data: { id: 'it_1' } } });
  });

  it('surfaces DB errors instead of treating them as a miss', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(checkIdempotency('u1', '/r', 'k')).rejects.toEqual({ message: 'boom' });
  });
});

describe('recordIdempotency', () => {
  beforeEach(() => {
    insertSelectMaybeSingle.mockReset();
  });

  it('inserts the key with status and body', async () => {
    insertSelectMaybeSingle.mockResolvedValue({ error: null });
    await recordIdempotency('u1', '/api/saved-itineraries', 'k1', 201, { success: true });
    expect(insertSelectMaybeSingle).toHaveBeenCalled();
  });

  it('swallows a concurrent duplicate (23505) without logging', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    insertSelectMaybeSingle.mockResolvedValue({ error: { code: '23505', message: 'duplicate' } });
    await expect(recordIdempotency('u1', '/r', 'k', 200, {})).resolves.toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('logs other insert failures but still resolves', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    insertSelectMaybeSingle.mockResolvedValue({ error: { code: '08000', message: 'connection' } });
    await expect(recordIdempotency('u1', '/r', 'k', 200, {})).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});