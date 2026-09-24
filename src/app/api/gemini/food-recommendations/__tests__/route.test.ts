const MockedResponseEats = globalThis.Response as unknown as { new(body?: unknown, init?: { status?: number; headers?: Record<string, string> }): InstanceType<typeof globalThis.Response>; json(body: unknown, init?: { status?: number }): unknown; };
if (typeof MockedResponseEats.json !== 'function') {
  MockedResponseEats.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponseEats(JSON.stringify(body), { status: init?.status ?? 200, headers: { 'content-type': 'application/json' } });
}

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getServerSession } from 'next-auth';
import { CreditService, InsufficientCreditsError } from '@/lib/referral-system';
import { withRetry } from '@/lib/upstream/withRetry';
import { RobustFoodJsonParser } from '@/lib/robustFoodJsonParser';
import { recommendationEngine } from '@/app/tarana-eats/services/recommendationEngine';
import { menuIndexingService } from '@/app/tarana-eats/services/menuIndexingService';
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/referral-system', () => ({
  CreditService: { consumeCredits: jest.fn(), refundCredits: jest.fn() },
  InsufficientCreditsError: class InsufficientCreditsError extends Error {
    required: number;
    available: number;
    constructor(required: number, available: number, service: string) {
      super(`Insufficient credits for ${service}: need ${required}, have ${available}`);
      this.name = 'InsufficientCreditsError';
      this.required = required;
      this.available = available;
    }
  },
}));
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn(() => ({})),
  })),
  HarmCategory: {},
  HarmBlockThreshold: {},
}));

jest.mock('@/lib/robustFoodJsonParser', () => ({
  RobustFoodJsonParser: { parseResponse: jest.fn() },
}));

jest.mock('@/lib/upstream/withRetry', () => ({
  withRetry: jest.fn(),
}));

const sessionMock = getServerSession as unknown as jest.Mock;
const consumeMock = CreditService.consumeCredits as unknown as jest.Mock;
const refundMock = CreditService.refundCredits as unknown as jest.Mock;
const parseMock = RobustFoodJsonParser.parseResponse as unknown as jest.Mock;

const restaurant = {
  name: 'Cafe Baguio',
  cuisine: ['Cafe'],
  priceRange: { min: 100, max: 300 },
  location: 'Baguio',
  popularFor: ['cozy'],
  dietaryOptions: [],
  ratings: 4.5,
  image: '/img.jpg',
  fullMenu: [],
};

const foodData = { restaurants: [restaurant] };

function post(body: unknown) {
  return { headers: { get: () => null }, json: async () => body } as unknown as NextRequest;
}

describe('food-recommendations charge-first (H1-Eats)', () => {
  const geminiMatches = [
    { name: 'Cafe Baguio', meals: 2, price: 500, image: '/img.jpg', reason: 'Great coffee and cozy seats.' },
  ];
  beforeEach(() => {
    jest.clearAllMocks();
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    consumeMock.mockResolvedValue({ success: true, remainingCredits: 4 });
    refundMock.mockResolvedValue(true);
    // Gemini SDK returns a Response object; the route reads .text() off it.
    // The retry helper is bypassed (returns the object directly); the parser
    // mock decides success vs failure per test.
    (withRetry as unknown as jest.Mock).mockImplementation(async () => ({
      response: { text: () => 'parser decides' },
    }));
    parseMock.mockReturnValue({ success: true, data: { matches: geminiMatches } });
    jest.spyOn(recommendationEngine, 'generateRecommendations').mockReturnValue([]);
    jest.spyOn(menuIndexingService, 'indexRestaurants').mockImplementation(() => undefined);
    jest.spyOn(menuIndexingService, 'getIndexStats').mockReturnValue({ totalItems: 0, totalRestaurants: 0, categoryCounts: {} } as never);
    jest.spyOn(menuIndexingService, 'getRestaurantMenu').mockReturnValue([]);
  });

  test('402s before any charge when the balance is insufficient', async () => {
    consumeMock.mockRejectedValueOnce(new InsufficientCreditsError(1, 0, 'tarana_eats'));

    const res = await POST(post({ prompt: 'coffee for 2', foodData }));

    expect(res.status).toBe(402);
    expect(refundMock).not.toHaveBeenCalled();
  });

  test('charges exactly once and answers safe failure when validation faults', async () => {
    const res = await POST(post({ prompt: 'coffee for 2', foodData }));
    const text = await res.text();

    expect(consumeMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(500);
    expect(text).not.toContain('SUPER_SECRET');
  });

  test('refunds the prepaid credit when generation fails', async () => {
    (withRetry as unknown as jest.Mock).mockRejectedValueOnce(new Error('upstream down'));

    const res = await POST(post({ prompt: 'coffee for 2', foodData }));
    const text = await res.text();

    expect(consumeMock).toHaveBeenCalledTimes(1);
    expect(refundMock).toHaveBeenCalledTimes(1);
    expect(refundMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', amount: 1, service: 'tarana_eats' })
    );
    expect(res.status).toBe(500);
    expect(text).not.toContain('upstream down');
  });
});
