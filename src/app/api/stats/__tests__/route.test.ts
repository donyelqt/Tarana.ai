/**
 * Tests for GET /api/stats (dashboard Tarana Stats widget).
 * Public aggregates: exact-count head queries + static cafes length.
 */
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { getStats } from '@/lib/services/statsService';
import { logger } from '@/lib/observability/logger';
import { restaurants } from '@/app/tarana-eats/data/taranaEatsData';

// jest.setup.js replaces global Response with a minimal mock lacking the
// static json() NextResponse.json() delegates to. Restore just that static.
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

jest.mock('@/lib/services/statsService', () => ({
  getStats: jest.fn(),
}));

jest.mock('@/lib/observability/logger', () => ({
  logger: { error: jest.fn() },
}));

const mockLogger = logger as jest.Mocked<typeof logger>;

function request(requestId = '11111111-1111-4111-8111-111111111111'): NextRequest {
  return {
    headers: {
      get: (name: string) => name === 'x-request-id' ? requestId : null,
    },
  } as unknown as NextRequest;
}

const mockedGetStats = getStats as unknown as jest.Mock;

describe('GET /api/stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetStats.mockResolvedValue({
      itineraries: 12,
      cafes: restaurants.length,
      meals: 34,
      explorers: 56,
    });
  });

  it('returns exact counts plus the static cafes length', async () => {
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      stats: { itineraries: 12, cafes: restaurants.length, meals: 34, explorers: 56 },
    });
    expect(restaurants.length).toBeGreaterThan(0);
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('returns 500 when any count query fails', async () => {
    mockedGetStats.mockRejectedValue(new Error('db down'));
    const requestId = '11111111-1111-4111-8111-111111111111';
    const res = await GET(request(requestId));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to get stats' });
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Stats request failed',
      { entryPoint: '/api/stats' },
      requestId
    );
  });
});