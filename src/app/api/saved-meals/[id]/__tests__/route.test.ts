const MockedResponseMealId = globalThis.Response as unknown as { new(body?: unknown, init?: any): any; json(body: unknown, init?: any): any; };
if (typeof MockedResponseMealId.json !== 'function') {
  MockedResponseMealId.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponseMealId(JSON.stringify(body), { status: init?.status ?? 200, headers: { 'content-type': 'application/json' } });
}

import { NextRequest } from 'next/server';
import { GET, DELETE } from '../route';
import { getServerSession } from 'next-auth';
import { deleteMealById, getMealById } from '@/lib/services/mealService';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/services/mealService', () => ({
  deleteMealById: jest.fn(),
  getMealById: jest.fn(),
}));

const mockedGetServerSession = getServerSession as unknown as jest.Mock;
const mockedGetMealById = getMealById as unknown as jest.Mock;
const mockedDeleteMealById = deleteMealById as unknown as jest.Mock;

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
    mockedGetMealById.mockResolvedValue(meal);

    const response = await GET(authedRequest('m1'), ctx('m1') as unknown as NextRequest);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(meal);
    expect(mockedGetMealById).toHaveBeenCalledWith('m1', 'user-1');
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

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(mockedDeleteMealById).toHaveBeenCalledWith('m1', 'user-1');
  });

  test('DELETE returns 404 when nothing is deleted', async () => {
    mockedDeleteMealById.mockResolvedValue(false);

    const response = await DELETE(authedRequest('m1'), ctx('m1') as unknown as NextRequest);
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error).toBe('Meal not found');
  });
});
