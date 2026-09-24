/**
 * Regression suite for POST /api/saved-itineraries/[id]/refresh.
 *
 * Primary bug this pins: the route regenerates by calling the authenticated
 * generator endpoint (`/api/gemini/itinerary-generator`) server-to-server.
 * Node's fetch attaches no cookies, so unless the caller's credential is
 * forwarded the generator answers 401 and every refresh fails. The "forwards
 * the caller's credential" and "401s become an explicit failure" cases below
 * both fail against the pre-fix route.
 *
 * Secondary: response bodies must never carry raw upstream error text
 * (safe-error boundary).
 */
import { NextRequest } from 'next/server';

const MockedResponse = globalThis.Response as unknown as {
  new (body?: unknown, init?: { status?: number; headers?: Record<string, string> }): InstanceType<
    typeof globalThis.Response
  >;
  json(body: unknown, init?: { status?: number; headers?: Record<string, string> }): unknown;
};
if (typeof MockedResponse.json !== 'function') {
  MockedResponse.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponse(JSON.stringify(body), {
      status: init?.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
}

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/auth/auth', () => ({ authOptions: {} }));

import { POST } from '../route';
import { getServerSession } from 'next-auth';
import { getSavedItineraries, updateItinerary } from '@/lib/data/savedItineraries';
import { fetchWeatherFromAPI } from '@/lib/core/utils';
import { itineraryRefreshService } from '@/lib/services/itineraryRefreshService';
jest.mock('@/lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { logger } from '@/lib/observability/logger';

jest.mock('@/lib/data/savedItineraries', () => ({
  getSavedItineraries: jest.fn(),
  updateItinerary: jest.fn(),
}));
jest.mock('@/lib/core/utils', () => ({
  fetchWeatherFromAPI: jest.fn(),
}));
jest.mock('@/lib/services/itineraryRefreshService', () => ({
  itineraryRefreshService: {
    evaluateRefreshNeed: jest.fn(),
    getChangeSummary: jest.fn(() => 'summary'),
    createTrafficSnapshot: jest.fn(() => ({ snapshot: 'snap' })),
  },
}));
jest.mock('@/lib/performance/parallelTrafficProcessor', () => ({
  parallelTrafficProcessor: {
    processActivitiesUltraFast: jest.fn(async () => ({ enhancedActivities: [] })),
  },
}));

const mockLogger = logger as jest.Mocked<typeof logger>;
const sessionMock = getServerSession as unknown as jest.Mock;
const mockedList = getSavedItineraries as unknown as jest.Mock;
const mockedUpdate = updateItinerary as unknown as jest.Mock;
const mockedWeather = fetchWeatherFromAPI as unknown as jest.Mock;
// jest.mock hoists the factory, so the imported service object is already the mock.
const mockedService = itineraryRefreshService as unknown as { evaluateRefreshNeed: jest.Mock };
const mockedEvaluate = mockedService.evaluateRefreshNeed;

const SENTINEL = 'SUPER_SECRET_UPSTREAM_DETAIL_xyz789';

// Fixture typed against the domain object the route reads from the service.
import type { SavedItinerary } from '@/lib/data/savedItineraries';
const storedItinerary: SavedItinerary = {
  id: 'itin-1',
  title: 'Baguio Day',
  date: 'June 13, 2026',
  budget: 'Budget',
  image: '/images/burnham.jpg',
  tags: ['Nature'],
  formData: {
    budget: 'Budget',
    pax: 'Solo',
    duration: '1 Day',
    dates: { start: '2026-06-13T00:00:00.000Z', end: '2026-06-14T00:00:00.000Z' },
    selectedInterests: ['Nature'],
  },
  itineraryData: {
    title: 'Baguio Day',
    subtitle: 'Highlights',
    items: [
      {
        period: 'Morning',
        activities: [{ title: 'Burnham Park', time: '9:00 AM', desc: 'Boats', image: '/images/burnham.jpg', tags: ['Nature'] }],
      },
    ],
  },
  createdAt: '2026-06-13T00:00:00.000Z',
};

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return {
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => ({ force: true }),
  } as unknown as NextRequest;
}

function callPost(headers: Record<string, string> = {}) {
  return POST(makeRequest(headers), { params: Promise.resolve({ id: 'itin-1' }) });
}

describe('saved-itineraries/[id]/refresh route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    mockedList.mockResolvedValue([storedItinerary]);
    mockedWeather.mockResolvedValue({ weather: [{ main: 'Clouds' }], main: { temp: 20 } });
    mockedEvaluate.mockResolvedValue({
      needsRefresh: true,
      severity: 'moderate',
      confidence: 80,
      reasons: ['weather changed'],
    });
    mockedUpdate.mockResolvedValue({
      ...storedItinerary,
      refreshMetadata: { refreshCount: 1, trafficSnapshot: null } as never,
    });
  });


  it('returns 401 when unauthenticated and does not read the itinerary', async () => {
    sessionMock.mockResolvedValue(null);

    const res = await callPost();

    expect(res.status).toBe(401);
    expect(mockedList).not.toHaveBeenCalled();
  });

  it("forwards the caller's session cookie to the generator so regeneration is authenticated", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        text: JSON.stringify(storedItinerary.itineraryData),
      }),
      text: async () => '',
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await callPost({ cookie: 'next-auth.session-token=abc123' });

    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toContain('/api/gemini/itinerary-generator');
    // The regression: without this header the generator answers 401.
    expect(init.headers.cookie).toBe('next-auth.session-token=abc123');
  });

  it('does not log the generated refresh prompt or raw upstream text', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: SENTINEL }),
      text: async () => SENTINEL,
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await callPost({ cookie: 'next-auth.session-token=abc123' });
    const serializedLogs = JSON.stringify(mockLogger.info.mock.calls.concat(mockLogger.error.mock.calls));

    expect(res.status).toBe(500);
    expect(serializedLogs).not.toContain(SENTINEL);
    expect(serializedLogs).not.toContain('Update the itinerary');
  });

  it('forwards one stable idempotency key for repeated refresh regeneration', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ text: JSON.stringify(storedItinerary.itineraryData) }),
      text: async () => '',
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await callPost({ cookie: 'next-auth.session-token=abc123', 'idempotency-key': 'refresh-op-1' });
    await callPost({ cookie: 'next-auth.session-token=abc123', 'idempotency-key': 'refresh-op-1' });

    const firstHeaders = (fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }])[1].headers;
    const secondHeaders = (fetchMock.mock.calls[1] as [string, { headers: Record<string, string> }])[1].headers;
    expect(firstHeaders['Idempotency-Key']).toBe('refresh-op-1');
    expect(secondHeaders['Idempotency-Key']).toBe('refresh-op-1');
  });

  it('does not synthesize a generator key when the caller is unkeyed', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ text: JSON.stringify(storedItinerary.itineraryData) }),
      text: async () => '',
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await callPost({ cookie: 'next-auth.session-token=abc123' });

    const headers = (fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }])[1].headers;
    expect(headers['Idempotency-Key']).toBeUndefined();
  });

  it('forwards a bench token ahead of the cookie when present', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ text: JSON.stringify(storedItinerary.itineraryData) }),
      text: async () => '',
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await callPost({ 'x-bench-token': '12345:deadbeef', cookie: 'irrelevant=1' });

    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(init.headers['x-bench-token']).toBe('12345:deadbeef');
    expect(init.headers.cookie).toBeUndefined();
  });

  it('reports an explicit failure when the generator rejects the internal call', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Authentication required' }),
      text: async () => '{"error":"Authentication required"}',
    }) as unknown as typeof fetch;

    const res = await callPost({ cookie: 'next-auth.session-token=abc123' });
    const body = (await res.json()) as { success: boolean; error: string };

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Failed to generate an updated itinerary');
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('never leaks raw upstream error text into the response body', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error(SENTINEL)) as unknown as typeof fetch;

    const res = await callPost({ cookie: 'next-auth.session-token=abc123' });
    const text = JSON.stringify(await res.json());

    expect(res.status).toBe(500);
    expect(text).not.toContain(SENTINEL);
    expect(text).not.toContain('originalError');
  });
});