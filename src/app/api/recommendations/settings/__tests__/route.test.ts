import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { listMeals } from '@/lib/services/mealService';
import {
  activityToPayload,
  rankCafes,
  rankSpots,
  spotPool,
  toCafeCard,
  toSpotCard,
} from '@/app/dashboard/utils';
import { GET } from '../route';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/services/mealService', () => ({
  listMeals: jest.fn(),
}));

jest.mock('@/app/dashboard/utils', () => ({
  activityToPayload: jest.fn(),
  rankCafes: jest.fn(),
  rankSpots: jest.fn(),
  spotPool: jest.fn(),
  toCafeCard: jest.fn(),
  toSpotCard: jest.fn(),
}));

jest.mock('@/lib/observability/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn() },
}));

const MockedResponse = globalThis.Response as unknown as {
  new (body?: unknown, init?: { status?: number; headers?: Record<string, string> }): InstanceType<typeof globalThis.Response>;
  json(body: unknown, init?: { status?: number }): unknown;
};
if (typeof MockedResponse.json !== 'function') {
  MockedResponse.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponse(JSON.stringify(body), {
      status: init?.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
}

const sessionMock = getServerSession as unknown as jest.Mock;
const listMealsMock = listMeals as jest.MockedFunction<typeof listMeals>;
const rankCafesMock = rankCafes as jest.MockedFunction<typeof rankCafes>;
const rankSpotsMock = rankSpots as jest.MockedFunction<typeof rankSpots>;
const spotPoolMock = spotPool as jest.MockedFunction<typeof spotPool>;
const activityToPayloadMock = activityToPayload as jest.MockedFunction<typeof activityToPayload>;
const toCafeCardMock = toCafeCard as jest.MockedFunction<typeof toCafeCard>;
const toSpotCardMock = toSpotCard as jest.MockedFunction<typeof toSpotCard>;

function request() {
  return new Request('http://localhost:3000/api/recommendations/settings', {
    method: 'GET',
  }) as NextRequest;
}

describe('GET /api/recommendations/settings', () => {
  beforeEach(() => {
    sessionMock.mockReset().mockResolvedValue({ user: { id: 'user-1' } });
    listMealsMock.mockReset().mockResolvedValue([]);
    rankCafesMock.mockReset().mockReturnValue([{ matchedOn: [] }] as never);
    rankSpotsMock.mockReset().mockReturnValue([{ title: 'Baguio Public Market' }] as never);
    spotPoolMock.mockReset().mockReturnValue([] as never);
    activityToPayloadMock.mockReset().mockReturnValue({
      name: 'Baguio Public Market',
      image: '/images/market.png',
      lat: 16.4,
      lon: 120.6,
      peakHours: null,
    });
    toCafeCardMock.mockReset().mockReturnValue({
      name: 'Itaewon Cafe',
      image: '/images/itaewon.jpg',
      distance: '~1.0km',
      time: '~3 min',
      traffic: 'Low',
      lat: 16.4,
      lon: 120.6,
    });
    toSpotCardMock.mockReset().mockReturnValue({
      name: 'Baguio Public Market',
      image: '/images/market.png',
      distance: '~0.3km',
      time: '~1 min',
      traffic: 'Low',
      lat: 16.4,
      lon: 120.6,
    });
  });

  it('rejects unauthenticated requests', async () => {
    sessionMock.mockResolvedValue(null);

    const response = await GET(request());

    expect(response.status).toBe(401);
  });

  it('returns compact recommendations and marks saved-meal personalization', async () => {
    listMealsMock.mockResolvedValue([
      { id: 'meal-1', cafe_name: 'Itaewon Cafe', meal_type: 'Lunch', price: 300, good_for: 2 },
    ] as never);
    rankCafesMock.mockReturnValue([{ matchedOn: ['Korean'] }] as never);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({
      success: true,
      personalized: true,
      personalizationError: false,
    }));
    expect(body.recommendations).toHaveLength(2);
    expect(body.recommendations[0]).toEqual(expect.objectContaining({
      kind: 'cafe',
      context: 'Taste match',
    }));
    expect(body.recommendations[0].card).not.toHaveProperty('lat');
  });

  it('returns useful fallback recommendations when saved meals cannot load', async () => {
    listMealsMock.mockRejectedValue(new Error('database unavailable'));

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({
      success: true,
      personalized: false,
      personalizationError: true,
    }));
    expect(body.recommendations).toHaveLength(2);
  });
});
