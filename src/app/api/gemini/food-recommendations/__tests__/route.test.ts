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
import {
  claimIdempotency,
  completeIdempotency,
  hashIdempotencyPayload,
} from '@/lib/services/idempotencyService';
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

jest.mock('@/lib/services/idempotencyService', () => ({
  claimIdempotency: jest.fn(),
  completeIdempotency: jest.fn(),
  hashIdempotencyPayload: jest.fn(() => 'hash-1'),
  getIdempotencyKey: (request: { headers: { get: (key: string) => string | null } }) => {
    const raw = request.headers.get('Idempotency-Key') ?? request.headers.get('X-Idempotency-Key');
    if (!raw) return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 && trimmed.length <= 256 ? trimmed : null;
  },
}));

const sessionMock = getServerSession as unknown as jest.Mock;
const consumeMock = CreditService.consumeCredits as unknown as jest.Mock;
const refundMock = CreditService.refundCredits as unknown as jest.Mock;
const parseMock = RobustFoodJsonParser.parseResponse as unknown as jest.Mock;
const claimMock = claimIdempotency as unknown as jest.Mock;
const completeMock = completeIdempotency as unknown as jest.Mock;
const hashMock = hashIdempotencyPayload as unknown as jest.Mock;

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

function post(body: unknown, idempotencyKey?: string) {
  return {
    headers: {
      get: (name: string) => idempotencyKey && name === 'Idempotency-Key' ? idempotencyKey : null,
    },
    json: async () => body,
  } as unknown as NextRequest;
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

describe('food-recommendations idempotency', () => {
  const matches = [
    { name: 'Cafe Baguio', meals: 2, price: 500, image: '/img.jpg', reason: 'Great coffee and cozy seats.' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    consumeMock.mockResolvedValue({ success: true, remainingCredits: 4 });
    refundMock.mockResolvedValue(true);
    claimMock.mockResolvedValue({ kind: 'owner', rowId: 7 });
    completeMock.mockResolvedValue(undefined);
    hashMock.mockReturnValue('hash-1');
    (withRetry as unknown as jest.Mock).mockImplementation(async () => ({
      response: { candidates: [{}], text: () => 'parser decides' },
    }));
    parseMock.mockReturnValue({ success: true, data: { matches } });
    jest.spyOn(recommendationEngine, 'generateRecommendations').mockReturnValue([]);
    jest.spyOn(menuIndexingService, 'indexRestaurants').mockImplementation(() => undefined);
    jest.spyOn(menuIndexingService, 'getIndexStats').mockReturnValue({ totalItems: 0, totalRestaurants: 0, categoryCounts: {} } as never);
    jest.spyOn(menuIndexingService, 'getRestaurantMenu').mockReturnValue([]);
  });

  test('replays a completed keyed response without charging again', async () => {
    claimMock.mockResolvedValue({
      kind: 'replay',
      replay: { status: 200, body: { matches: [{ name: 'Cached Cafe' }] } },
    });

    const res = await POST(post({ prompt: 'coffee for 2', foodData }, 'key-1'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ matches: [{ name: 'Cached Cafe' }] });
    expect(consumeMock).not.toHaveBeenCalled();
    expect(completeMock).not.toHaveBeenCalled();
  });

  test('claims and completes a successful keyed response', async () => {
    const res = await POST(post({ prompt: 'coffee for 2', foodData }, 'key-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(claimMock).toHaveBeenCalledWith('user-1', '/api/gemini/food-recommendations', 'key-1', 'hash-1');
    expect(consumeMock).toHaveBeenCalledTimes(1);
    expect(completeMock).toHaveBeenCalledWith(7, 200, body);
  });

  test('returns conflict without charging an in-flight duplicate', async () => {
    claimMock.mockResolvedValue({ kind: 'conflict' });

    const res = await POST(post({ prompt: 'coffee for 2', foodData }, 'key-1'));

    expect(res.status).toBe(409);
    expect(res.headers.get('Retry-After')).toBe('1');
    expect(consumeMock).not.toHaveBeenCalled();
  });

  test('rejects a reused key with a different payload before charging', async () => {
    claimMock.mockResolvedValue({ kind: 'payload-mismatch' });

    const res = await POST(post({ prompt: 'coffee for 3', foodData }, 'key-1'));

    expect(res.status).toBe(422);
    expect(consumeMock).not.toHaveBeenCalled();
  });

  test('completes a keyed insufficient-credit response', async () => {
    consumeMock.mockRejectedValueOnce(new InsufficientCreditsError(1, 0, 'tarana_eats'));

    const res = await POST(post({ prompt: 'coffee for 2', foodData }, 'key-1'));
    const body = await res.json();

    expect(res.status).toBe(402);
    expect(completeMock).toHaveBeenCalledWith(7, 402, body);
  });

  test('completes a keyed generation failure after refunding', async () => {
    (withRetry as unknown as jest.Mock).mockRejectedValueOnce(new Error('upstream down'));

    const res = await POST(post({ prompt: 'tea for 2', foodData }, 'key-1'));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(refundMock).toHaveBeenCalledTimes(1);
    expect(completeMock).toHaveBeenCalledWith(7, 500, body);
  });

  test('completes a keyed non-insufficient credit failure without refunding', async () => {
    consumeMock.mockRejectedValueOnce(new Error('credit store down'));

    const res = await POST(post({ prompt: 'credit failure', foodData }, 'key-1'));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(refundMock).not.toHaveBeenCalled();
    expect(completeMock).toHaveBeenCalledWith(7, 500, body);
  });

  test('fails closed when idempotency completion cannot be persisted', async () => {
    completeMock.mockRejectedValueOnce(new Error('idempotency store down'));

    const res = await POST(post({ prompt: 'completion failure', foodData }, 'key-1'));

    expect(res.status).toBe(500);
    expect(consumeMock).toHaveBeenCalledTimes(1);
    expect(completeMock).toHaveBeenNthCalledWith(1, 7, 200, expect.anything());
    expect(completeMock).toHaveBeenNthCalledWith(2, 7, 500, expect.anything());
  });

  test('rejects oversized bodies with 413 without charging', async () => {
    const bigBody = { prompt: 'coffee for 2', foodData };
    const req = {
      headers: {
        get: (name: string) =>
          name === 'content-length' ? String(64 * 1024) : null,
      },
      json: async () => bigBody,
    } as unknown as NextRequest;

    const res = await POST(req);

    expect(res.status).toBe(413);
    expect(consumeMock).not.toHaveBeenCalled();
    expect(claimMock).not.toHaveBeenCalled();
  });

  test('rejects unauthenticated monitoring stats with 401', async () => {
    sessionMock.mockResolvedValueOnce(null);

    const { GET } = await import('../route');
    const req = {
      url: 'http://localhost/api/gemini/food-recommendations?action=stats',
      headers: new Headers(),
    } as unknown as NextRequest;

    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  test('does not claim when no idempotency key is sent', async () => {
    const res = await POST(post({ prompt: 'coffee for 2', foodData }));

    expect(res.status).toBe(200);
    expect(claimMock).not.toHaveBeenCalled();
    expect(completeMock).not.toHaveBeenCalled();
  });
});
