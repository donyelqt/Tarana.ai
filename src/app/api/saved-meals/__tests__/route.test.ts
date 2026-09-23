const MockedResponseMeals = globalThis.Response as unknown as { new(body?: unknown, init?: any): any; json(body: unknown, init?: any): any; };
if (typeof MockedResponseMeals.json !== 'function') {
  MockedResponseMeals.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponseMeals(JSON.stringify(body), { status: init?.status ?? 200, headers: { 'content-type': 'application/json' } });
}

import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { getServerSession } from 'next-auth';
import { createMeal, listMeals, MealDbError } from '@/lib/services/mealService';
import { claimIdempotency, completeIdempotency, hashIdempotencyPayload } from '@/lib/services/idempotencyService';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/services/mealService', () => ({
  createMeal: jest.fn(),
  listMeals: jest.fn(),
  MealDbError: class MealDbError extends Error {
    details: string;
    hint?: string;
    code?: string;
    constructor(details: string, hint?: string, code?: string) {
      super(`Failed to fetch saved meals: ${details}`);
      this.name = 'MealDbError';
      this.details = details;
      this.hint = hint;
      this.code = code;
    }
  },
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
const mockedGetServerSession = getServerSession as unknown as jest.Mock;
const mockedListMeals = listMeals as unknown as jest.Mock;
const mockedCreateMeal = createMeal as unknown as jest.Mock;
const mockedClaimIdempotency = claimIdempotency as unknown as jest.Mock;
const mockedCompleteIdempotency = completeIdempotency as unknown as jest.Mock;
const mockedHashIdempotencyPayload = hashIdempotencyPayload as unknown as jest.Mock;

function authedRequest(body?: unknown): NextRequest {
  return {
    headers: { get: () => null },
    json: jest.fn().mockResolvedValue(body),
  } as unknown as NextRequest;
}

const validMeal = {
  cafe_name: 'Cafe Baguio',
  meal_type: 'dinner',
  price: 250,
};

describe('Saved Meals API Route Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
  });

  test('rejects unauthenticated requests with 401', async () => {
    mockedGetServerSession.mockResolvedValue(null);

    const response = await GET(authedRequest());
    expect(response.status).toBe(401);
    expect(mockedListMeals).not.toHaveBeenCalled();
  });

  test('GET returns the caller meals with count', async () => {
    const meals = [{ id: 'm1' }, { id: 'm2' }];
    mockedListMeals.mockResolvedValue(meals);

    const response = await GET(authedRequest());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(meals);
    expect(body.userId).toBe('user-1');
    expect(body.count).toBe(2);
    expect(mockedListMeals).toHaveBeenCalledWith('user-1');
  });

  test('GET returns safe 500 on DB error without leaking details', async () => {
    mockedListMeals.mockRejectedValue(new MealDbError('db boom', 'private hint', 'PGRST001'));

    const response = await GET(authedRequest());
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toBe('Internal server error');
    expect(body.details).toBeUndefined();
    expect(body.hint).toBeUndefined();
    expect(body.code).toBeUndefined();
  });

  test('POST returns 200 with the saved meal', async () => {
    const saved = { id: 'm1', ...validMeal };
    mockedCreateMeal.mockResolvedValue(saved);

    const response = await POST(authedRequest(validMeal));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(saved);
    expect(mockedCreateMeal).toHaveBeenCalledWith('user-1', expect.objectContaining(validMeal));
  });

  test('POST returns 400 for invalid input without touching the DB', async () => {
    const response = await POST(authedRequest({ meal_type: 'dinner', price: -5 }));
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe('Invalid input');
    expect(mockedCreateMeal).not.toHaveBeenCalled();
  });

  test('POST returns 500 when the insert fails', async () => {
    mockedCreateMeal.mockRejectedValue(new Error('db down'));

    const response = await POST(authedRequest(validMeal));
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toBe('Failed to save meal');
  });
});

describe('saved-meals POST idempotency (Phase 2.3-R2)', () => {
  function postWithKey(body: unknown, key: string) {
    return {
      headers: { get: (name: string) => (name === 'Idempotency-Key' ? key : null) },
      json: async () => body,
    } as unknown as NextRequest;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockedHashIdempotencyPayload.mockReturnValue('hash-1');
  });

  test('returns a cached replay instead of running the mutation', async () => {
    mockedClaimIdempotency.mockResolvedValue({
      kind: 'replay',
      replay: { status: 200, body: { success: true, data: { id: 'meal-cached' } } },
    });

    const res = await POST(postWithKey(validMeal, 'key-1'));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ data: { id: 'meal-cached' } });
    expect(mockedCreateMeal).not.toHaveBeenCalled();
    expect(mockedCompleteIdempotency).not.toHaveBeenCalled();
  });

  test('claims, runs, and completes a first request with the exact response', async () => {
    mockedClaimIdempotency.mockResolvedValue({ kind: 'owner', rowId: 7 });
    mockedCreateMeal.mockResolvedValue({ id: 'm1', ...validMeal });
    mockedCompleteIdempotency.mockResolvedValue(undefined);

    const res = await POST(postWithKey(validMeal, 'key-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockedClaimIdempotency).toHaveBeenCalledWith('user-1', '/api/saved-meals', 'key-1', expect.any(String));
    expect(mockedCreateMeal).toHaveBeenCalledTimes(1);
    expect(mockedCompleteIdempotency).toHaveBeenCalledWith(7, 200, body);
  });

  test('does not consult idempotency when no key is sent', async () => {
    mockedCreateMeal.mockResolvedValue({ id: 'm1', ...validMeal });

    const res = await POST(authedRequest(validMeal));

    expect(res.status).toBe(200);
    expect(mockedClaimIdempotency).not.toHaveBeenCalled();
    expect(mockedCompleteIdempotency).not.toHaveBeenCalled();
  });

  test('rejects a concurrent duplicate without running the mutation', async () => {
    mockedClaimIdempotency.mockResolvedValue({ kind: 'conflict' });

    const res = await POST(postWithKey(validMeal, 'key-1'));

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'Request is already being processed' });
    expect(res.headers.get('Retry-After')).toBe('1');
    expect(mockedCreateMeal).not.toHaveBeenCalled();
    expect(mockedCompleteIdempotency).not.toHaveBeenCalled();
  });

  test('rejects a reused key with a different payload without running the mutation', async () => {
    mockedClaimIdempotency.mockResolvedValue({ kind: 'payload-mismatch' });

    const res = await POST(postWithKey({ ...validMeal, cafe_name: 'Different cafe' }, 'key-1'));

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: 'Idempotency key was already used with a different payload' });
    expect(mockedCreateMeal).not.toHaveBeenCalled();
    expect(mockedCompleteIdempotency).not.toHaveBeenCalled();
  });

  test('caches a mutation failure so a replay cannot double-write', async () => {
    mockedClaimIdempotency.mockResolvedValue({ kind: 'owner', rowId: 7 });
    mockedCreateMeal.mockRejectedValue(new Error('db down'));
    mockedCompleteIdempotency.mockResolvedValue(undefined);

    const res = await POST(postWithKey(validMeal, 'key-1'));

    expect(res.status).toBe(500);
    expect(mockedCompleteIdempotency).toHaveBeenCalledWith(7, 500, { error: 'Failed to save meal' });
  });
});
