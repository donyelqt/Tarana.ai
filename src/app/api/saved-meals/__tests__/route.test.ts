const MockedResponseMeals = globalThis.Response as unknown as { new(body?: unknown, init?: any): any; json(body: unknown, init?: any): any; };
if (typeof MockedResponseMeals.json !== 'function') {
  MockedResponseMeals.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponseMeals(JSON.stringify(body), { status: init?.status ?? 200, headers: { 'content-type': 'application/json' } });
}

import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { getServerSession } from 'next-auth';
import { createMeal, listMeals, MealDbError } from '@/lib/services/mealService';

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

const mockedGetServerSession = getServerSession as unknown as jest.Mock;
const mockedListMeals = listMeals as unknown as jest.Mock;
const mockedCreateMeal = createMeal as unknown as jest.Mock;

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

  test('GET preserves the detailed 500 shape on DB error', async () => {
    mockedListMeals.mockRejectedValue(new MealDbError('db boom', 'h', 'c'));

    const response = await GET(authedRequest());
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toBe('Failed to fetch saved meals');
    expect(body.details).toBe('db boom');
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
