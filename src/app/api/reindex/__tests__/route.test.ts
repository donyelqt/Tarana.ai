import { NextRequest } from 'next/server';
import { resetHttpMetrics } from '@/lib/observability/httpMetrics';
import { sampleItinerary } from '@/app/itinerary-generator/data/itineraryData';

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

jest.mock('@/lib/search', () => ({
  upsertActivityEmbedding: jest.fn(),
}));

jest.mock('@/lib/observability/logger', () => ({
  logger: { error: jest.fn() },
}));

const requestId = '11111111-1111-4111-8111-111111111111';
const originalSecret = process.env.REINDEX_SECRET;
let postHandler: (request: NextRequest) => Promise<Response>;
let upsertMock: jest.Mock;
let mockLogger: { error: jest.Mock };
let consoleErrorSpy: jest.SpyInstance;

function request(token: string | null): NextRequest {
  return {
    headers: {
      get: (name: string) => {
        if (name === 'x-admin-token') return token;
        if (name === 'x-request-id') return requestId;
        return null;
      },
    },
  } as unknown as NextRequest;
}

const activities = sampleItinerary.items.flatMap((item) => item.activities);

beforeAll(async () => {
  process.env.REINDEX_SECRET = 'test-secret';
  const route = await import('../route');
  const search = await import('@/lib/search');
  const observability = await import('@/lib/observability/logger');
  postHandler = route.POST as (request: NextRequest) => Promise<Response>;
  upsertMock = search.upsertActivityEmbedding as jest.Mock;
  mockLogger = observability.logger as unknown as { error: jest.Mock };
});
// REINDEX_SECRET is captured when the route module loads; this test intentionally
// imports after setting the environment so the auth configuration is exercised.

afterAll(() => {
  if (originalSecret === undefined) delete process.env.REINDEX_SECRET;
  else process.env.REINDEX_SECRET = originalSecret;
});

beforeEach(() => {
  jest.clearAllMocks();
  resetHttpMetrics();
  upsertMock.mockResolvedValue(undefined);
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

describe('POST /api/reindex', () => {
  it('rejects a wrong admin token without upserts', async () => {
    const response = await postHandler(request('wrong-secret'));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('indexes the fixed activity set and preserves the response contract', async () => {
    const response = await postHandler(request('test-secret'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ total: activities.length, indexed: activities.length, failed: 0 });
    expect(upsertMock).toHaveBeenCalledTimes(activities.length);
  });

  it('logs a failed embedding with bounded metadata and no raw title or reason', async () => {
    upsertMock.mockRejectedValueOnce(new Error('SENTINEL_EMBEDDING_ERROR'));

    const response = await postHandler(request('test-secret'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ total: activities.length, indexed: activities.length - 1, failed: 1 });
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Reindex embedding failed',
      { entryPoint: '/api/reindex', activityIndex: 0, errorName: 'Error' },
      requestId
    );
    expect(JSON.stringify(mockLogger.error.mock.calls)).not.toContain('SENTINEL_EMBEDDING_ERROR');
    expect(JSON.stringify(mockLogger.error.mock.calls)).not.toContain(activities[0].title);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
