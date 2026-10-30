const MockedResponseMealId = globalThis.Response as unknown as { new(body?: unknown, init?: any): any; json(body: unknown, init?: any): any; };
if (typeof MockedResponseMealId.json !== 'function') {
  MockedResponseMealId.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponseMealId(JSON.stringify(body), { status: init?.status ?? 200, headers: { 'content-type': 'application/json' } });
}

import { NextRequest } from 'next/server';
import { GET, DELETE, PATCH } from '../route';
import { getServerSession } from 'next-auth';
import { deleteMealById, getMealById, getMealNotes, updateMealNotes } from '@/lib/services/mealService';
import { claimIdempotency, completeIdempotency, hashIdempotencyPayload } from '@/lib/services/idempotencyService';
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/services/mealService', () => ({
  deleteMealById: jest.fn(),
  getMealById: jest.fn(),
  getMealNotes: jest.fn(),
  updateMealNotes: jest.fn(),
}));
jest.mock('@/lib/services/idempotencyService', () => ({
  claimIdempotency: jest.fn(),
  completeIdempotency: jest.fn(),
  hashIdempotencyPayload: jest.fn(() => 'hash-1'),
  getIdempotencyKey: (request: { headers: { get: (k: string) => string | null } }) => {
    const raw = request.headers.get('Idempotency-Key') ?? request.headers.get('X-Idempotency-Key');
    if (!raw) return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 && trimmed.length <= 256 ? trimmed : null;
  },
}));
const mockedClaimIdempotency = claimIdempotency as unknown as jest.Mock;
const mockedCompleteIdempotency = completeIdempotency as unknown as jest.Mock;
const mockedHashIdempotencyPayload = hashIdempotencyPayload as unknown as jest.Mock;

const mockedGetServerSession = getServerSession as unknown as jest.Mock;
const mockedGetMealById = getMealById as unknown as jest.Mock;
const mockedGetMealNotes = getMealNotes as unknown as jest.Mock;
const mockedDeleteMealById = deleteMealById as unknown as jest.Mock;
const mockedUpdateMealNotes = updateMealNotes as unknown as jest.Mock;

function authedRequest(id: string): NextRequest {
  return {
    headers: { get: () => null },
  } as unknown as NextRequest;
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('Saved Meal [id] API Route Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
  });

  test('rejects unauthenticated requests with 401', async () => {
    mockedGetServerSession.mockResolvedValue(null);

    const response = await GET(authedRequest('m1'), ctx('m1') as unknown as NextRequest);
    expect(response.status).toBe(401);
    expect(mockedGetMealById).not.toHaveBeenCalled();
  });

  test('GET returns the meal scoped to the caller', async () => {
    const meal = { id: 'm1', cafe_name: 'Cafe Baguio' };
    const notes = { id: 'n1', title: 'My Favorite', notes: 'Great for dates' };
    mockedGetMealById.mockResolvedValue(meal);
    mockedGetMealNotes.mockResolvedValue(notes);

    const response = await GET(authedRequest('m1'), ctx('m1') as unknown as NextRequest);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(meal);
    expect(body.notes).toEqual(notes);
    expect(mockedGetMealById).toHaveBeenCalledWith('m1', 'user-1');
  });

  test('GET returns null notes when no notes row exists', async () => {
    const meal = { id: 'm1', cafe_name: 'Cafe Baguio' };
    mockedGetMealById.mockResolvedValue(meal);
    mockedGetMealNotes.mockResolvedValue(null);

    const response = await GET(authedRequest('m1'), ctx('m1') as unknown as NextRequest);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(meal);
    expect(body.notes).toBeNull();
  });

  test('GET returns 404 when the meal is absent or belongs to another user', async () => {
    mockedGetMealById.mockResolvedValue(null);

    const response = await GET(authedRequest('m1'), ctx('m1') as unknown as NextRequest);
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error).toBe('Meal not found');
  });

  test('DELETE returns success when a row is deleted', async () => {
    mockedDeleteMealById.mockResolvedValue(true);

    const response = await DELETE(authedRequest('m1'), ctx('m1') as unknown as NextRequest);
    expect(response.status).toBe(200);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(mockedDeleteMealById).toHaveBeenCalledWith('m1', 'user-1');
  });
describe('saved-meals [id] DELETE idempotency (2.3-R5)', () => {
  function deleteWithKey(key: string, id = 'm1') {
    return DELETE(
      { headers: { get: (name: string) => (name === 'Idempotency-Key' ? key : null) } } as unknown as NextRequest,
      ctx(id) as unknown as NextRequest
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockedHashIdempotencyPayload.mockReturnValue('hash-1');
  });

  test('returns a cached replay instead of running the mutation', async () => {
    mockedClaimIdempotency.mockResolvedValue({
      kind: 'replay',
      replay: { status: 200, body: { success: true } },
    });

    const res = await deleteWithKey('key-1');

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
    expect(mockedDeleteMealById).not.toHaveBeenCalled();
    expect(mockedCompleteIdempotency).not.toHaveBeenCalled();
  });

  test('claims, deletes, and completes a first request with the exact response', async () => {
    mockedClaimIdempotency.mockResolvedValue({ kind: 'owner', rowId: 7 });
    mockedDeleteMealById.mockResolvedValue(true);
    mockedCompleteIdempotency.mockResolvedValue(undefined);

    const res = await deleteWithKey('key-1');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockedClaimIdempotency).toHaveBeenCalledWith('user-1', '/api/saved-meals/[id]', 'key-1', expect.any(String));
    expect(mockedDeleteMealById).toHaveBeenCalledWith('m1', 'user-1');
    expect(mockedCompleteIdempotency).toHaveBeenCalledWith(7, 200, body);
  });

  test('does not consult idempotency when no key is sent', async () => {
    mockedDeleteMealById.mockResolvedValue(true);

    const res = await DELETE(authedRequest('m1'), ctx('m1') as unknown as NextRequest);

    expect(res.status).toBe(200);
    expect(mockedClaimIdempotency).not.toHaveBeenCalled();
    expect(mockedCompleteIdempotency).not.toHaveBeenCalled();
  });

  test('rejects a concurrent duplicate without running the mutation', async () => {
    mockedClaimIdempotency.mockResolvedValue({ kind: 'conflict' });

    const res = await deleteWithKey('key-1');

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'Request is already being processed' });
    expect(res.headers.get('Retry-After')).toBe('1');
    expect(mockedDeleteMealById).not.toHaveBeenCalled();
    expect(mockedCompleteIdempotency).not.toHaveBeenCalled();
  });

  test('rejects a reused key with a different payload without running the mutation', async () => {
    mockedClaimIdempotency.mockResolvedValue({ kind: 'payload-mismatch' });

    const res = await deleteWithKey('key-1');

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: 'Idempotency key was already used with a different payload' });
    expect(mockedDeleteMealById).not.toHaveBeenCalled();
    expect(mockedCompleteIdempotency).not.toHaveBeenCalled();
  });

  test('caches a 404 miss so a replay cannot re-run the lookup', async () => {
    mockedClaimIdempotency.mockResolvedValue({ kind: 'owner', rowId: 7 });
    mockedDeleteMealById.mockResolvedValue(false);
    mockedCompleteIdempotency.mockResolvedValue(undefined);

    const res = await deleteWithKey('key-1');

    expect(res.status).toBe(404);
    expect(mockedCompleteIdempotency).toHaveBeenCalledWith(7, 404, { error: 'Meal not found' });
  });

  test('caches a mutation failure so a replay cannot double-write', async () => {
    mockedClaimIdempotency.mockResolvedValue({ kind: 'owner', rowId: 7 });
    mockedDeleteMealById.mockRejectedValue(new Error('db down'));
    mockedCompleteIdempotency.mockResolvedValue(undefined);

    const res = await deleteWithKey('key-1');

    expect(res.status).toBe(500);
    expect(mockedCompleteIdempotency).not.toHaveBeenCalled();
  });
});

  test('DELETE returns 404 when nothing is deleted', async () => {
    mockedDeleteMealById.mockResolvedValue(false);

    const response = await DELETE(authedRequest('m1'), ctx('m1') as unknown as NextRequest);
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error).toBe('Meal not found');
  });
});

describe('saved-meals [id] PATCH', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
  });
  const patchReq = (body?: unknown) =>
    ({ headers: { get: () => null }, json: async () => body }) as unknown as NextRequest;

  test('PATCH returns 400 on empty body', async () => {
    const res = await PATCH(patchReq({}), ctx('m1') as unknown as NextRequest);
    expect(res.status).toBe(400);
    expect(mockedUpdateMealNotes).not.toHaveBeenCalled();
  });

  test('PATCH returns 400 on invalid input', async () => {
    const res = await PATCH(patchReq({ title: 123 }), ctx('m1') as unknown as NextRequest);
    expect(res.status).toBe(400);
    expect(mockedUpdateMealNotes).not.toHaveBeenCalled();
  });

  test('PATCH returns 200 on valid update', async () => {
    const notesRow = { id: 'n1', title: 'My Lunch', notes: 'Try the soup' };
    mockedUpdateMealNotes.mockResolvedValue(notesRow);

    const res = await PATCH(patchReq({ title: 'My Lunch', notes: 'Try the soup' }), ctx('m1') as unknown as NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(notesRow);
    expect(mockedUpdateMealNotes).toHaveBeenCalledWith('m1', 'user-1', { title: 'My Lunch', notes: 'Try the soup' });
  });

  test('PATCH allows null to clear fields', async () => {
    const notesRow = { id: 'n1', title: null, notes: null };
    mockedUpdateMealNotes.mockResolvedValue(notesRow);

    const res = await PATCH(patchReq({ title: null, notes: null }), ctx('m1') as unknown as NextRequest);
    expect(res.status).toBe(200);
    expect(mockedUpdateMealNotes).toHaveBeenCalledWith('m1', 'user-1', { title: null, notes: null });
  });

  test('PATCH returns 404 when meal is missing or not owned', async () => {
    mockedUpdateMealNotes.mockResolvedValue(null);

    const res = await PATCH(patchReq({ title: 'updated' }), ctx('m1') as unknown as NextRequest);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'Meal not found' });
  });

});
