import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import {
  evaluateAllItineraries,
  notifyUsersOfRefreshNeeds,
} from '@/lib/services/refreshScheduler';
import {
  claimIdempotency,
  completeIdempotency,
  getIdempotencyKey,
  hashIdempotencyPayload,
} from '@/lib/services/idempotencyService';
import { logger } from '@/lib/observability/logger';

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

jest.mock('@/lib/services/refreshScheduler', () => ({
  evaluateAllItineraries: jest.fn(),
  notifyUsersOfRefreshNeeds: jest.fn(),
}));

jest.mock('@/lib/services/idempotencyService', () => ({
  claimIdempotency: jest.fn(),
  completeIdempotency: jest.fn(),
  getIdempotencyKey: jest.fn((request: Request) => request.headers.get('idempotency-key')),
  hashIdempotencyPayload: jest.fn((value: unknown) => JSON.stringify(value)),
}));

jest.mock('@/lib/observability/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockEvaluate = evaluateAllItineraries as jest.MockedFunction<typeof evaluateAllItineraries>;
const mockNotify = notifyUsersOfRefreshNeeds as jest.MockedFunction<typeof notifyUsersOfRefreshNeeds>;
const mockClaim = claimIdempotency as jest.MockedFunction<typeof claimIdempotency>;
const mockComplete = completeIdempotency as jest.MockedFunction<typeof completeIdempotency>;
const mockGetKey = getIdempotencyKey as jest.MockedFunction<typeof getIdempotencyKey>;
const mockHash = hashIdempotencyPayload as jest.MockedFunction<typeof hashIdempotencyPayload>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const requestId = '11111111-1111-4111-8111-111111111111';

const stats = {
  totalItineraries: 3,
  evaluatedCount: 2,
  needsRefreshCount: 1,
  skippedCount: 1,
  errorCount: 0,
  duration: 12,
  results: [{
    itineraryId: 'itinerary-1',
    itineraryTitle: 'Sensitive itinerary title',
    needsRefresh: true,
    severity: 'HIGH' as const,
    reasons: ['weather changed'],
    confidence: 80,
    evaluatedAt: new Date('2026-01-01T00:00:00.000Z'),
  }],
};

const realSecret = process.env.CRON_SECRET;
const realNodeEnv = process.env.NODE_ENV;

function request(options: {
  body?: string;
  auth?: string | null;
  idempotencyKey?: string;
  contentLength?: number;
} = {}): NextRequest {
  const auth = options.auth === undefined ? 'test-secret' : options.auth;
  return {
    text: jest.fn().mockResolvedValue(options.body ?? ''),
    headers: {
      get: (name: string) => {
        const normalized = name.toLowerCase();
        if (normalized === 'authorization') return auth === null ? null : `Bearer ${auth}`;
        if (normalized === 'idempotency-key') return options.idempotencyKey ?? null;
        if (normalized === 'x-request-id') return requestId;
        if (normalized === 'content-length') return options.contentLength?.toString() ?? null;
        return null;
      },
    },
  } as unknown as NextRequest;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CRON_SECRET = 'test-secret';
  (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
  mockEvaluate.mockResolvedValue(stats);
  mockNotify.mockResolvedValue(undefined);
  mockComplete.mockResolvedValue(undefined);
  mockGetKey.mockImplementation((req: Request) => req.headers.get('idempotency-key'));
  mockHash.mockImplementation((value: unknown) => JSON.stringify(value));
  mockClaim.mockResolvedValue({ kind: 'owner', rowId: 1 });
});

afterAll(() => {
  if (realSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = realSecret;
  (process.env as Record<string, string | undefined>).NODE_ENV = realNodeEnv;
});

describe('cron refresh authentication and validation', () => {
  it('fails closed when CRON_SECRET is unset outside production', async () => {
    delete process.env.CRON_SECRET;

    const response = await GET(request());

    expect(response.status).toBe(500);
    expect(mockEvaluate).not.toHaveBeenCalled();
    expect(await response.json()).toEqual(expect.objectContaining({ message: 'Cron authentication is not configured' }));
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Cron authentication rejected',
      { entryPoint: '/api/cron/evaluate-refreshes', reason: 'missing_config' },
      requestId
    );
    expect(JSON.stringify(mockLogger.warn.mock.calls)).not.toContain('test-secret');
  });

  it('rejects an invalid bearer token', async () => {
    const response = await GET(request({ auth: 'wrong-secret' }));

    expect(response.status).toBe(401);
    expect(mockEvaluate).not.toHaveBeenCalled();
  });

  it('runs a valid scheduled GET once and returns counts without itinerary results', async () => {
    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({
      success: true,
      message: 'Evaluation completed successfully',
      stats: {
        totalItineraries: 3,
        evaluatedCount: 2,
        needsRefreshCount: 1,
        skippedCount: 1,
        errorCount: 0,
        duration: 12,
      },
    }));
    expect(body.results).toBeUndefined();
    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenNthCalledWith(
      1,
      'Scheduled refresh evaluation started',
      { entryPoint: '/api/cron/evaluate-refreshes' },
      requestId
    );
    expect(mockLogger.info).toHaveBeenNthCalledWith(
      2,
      'Scheduled refresh evaluation completed',
      { entryPoint: '/api/cron/evaluate-refreshes', status: 200 },
      requestId
    );
    expect(mockClaim).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      '/api/cron/evaluate-refreshes',
      expect.stringMatching(/^scheduled:/),
      expect.any(String),
      60 * 60 * 1000
    );
    expect(mockComplete).toHaveBeenCalledWith(1, 200, expect.any(Object));
  });

  it('requires the same bearer secret for manual POST requests', async () => {
    const response = await POST(request({ auth: null, body: '{}' }));

    expect(response.status).toBe(401);
    expect(mockEvaluate).not.toHaveBeenCalled();
  });

  it('rejects unknown fields and non-boolean notify values', async () => {
    const invalidNotify = await POST(request({ body: JSON.stringify({ notify: 'yes' }) }));
    const unknownField = await POST(request({ body: JSON.stringify({ foo: 1 }) }));

    expect(invalidNotify.status).toBe(400);
    expect(unknownField.status).toBe(400);
    expect(mockEvaluate).not.toHaveBeenCalled();
  });

  it('skips notifications when notify is false', async () => {
    const response = await POST(request({ body: JSON.stringify({ notify: false }) }));

    expect(response.status).toBe(200);
    expect(mockEvaluate).toHaveBeenCalledTimes(1);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('replays a completed idempotent POST without re-evaluating or re-notifying', async () => {
    const cachedBody = {
      success: true,
      message: 'Manual evaluation completed',
      stats: {
        totalItineraries: 3,
        evaluatedCount: 2,
        needsRefreshCount: 1,
        skippedCount: 1,
        errorCount: 0,
        duration: 12,
      },
      timestamp: '2026-01-01T00:00:00.000Z',
    };
    mockClaim
      .mockResolvedValueOnce({ kind: 'owner', rowId: 7 })
      .mockResolvedValueOnce({ kind: 'replay', replay: { status: 200, body: cachedBody } });

    const first = await POST(request({ body: JSON.stringify({ notify: true }), idempotencyKey: 'manual-1' }));
    const second = await POST(request({ body: JSON.stringify({ notify: true }), idempotencyKey: 'manual-1' }));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(cachedBody);
    expect(mockEvaluate).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockComplete).toHaveBeenCalledTimes(1);
  });

  it('rejects a pending duplicate with conflict and Retry-After', async () => {
    mockClaim.mockResolvedValueOnce({ kind: 'conflict' });

    const response = await POST(request({ body: '{}', idempotencyKey: 'pending-1' }));

    expect(response.status).toBe(409);
    expect(response.headers.get('Retry-After')).toBe('1');
    expect(mockEvaluate).not.toHaveBeenCalled();
  });

  it('rejects reuse of a manual key with a different payload', async () => {
    mockClaim
      .mockResolvedValueOnce({ kind: 'owner', rowId: 8 })
      .mockResolvedValueOnce({ kind: 'payload-mismatch' });

    const first = await POST(request({ body: JSON.stringify({ notify: true }), idempotencyKey: 'manual-2' }));
    const second = await POST(request({ body: JSON.stringify({ notify: false }), idempotencyKey: 'manual-2' }));

    expect(first.status).toBe(200);
    expect(second.status).toBe(422);
    expect(mockEvaluate).toHaveBeenCalledTimes(1);
    expect(mockClaim).toHaveBeenNthCalledWith(
      1,
      '00000000-0000-0000-0000-000000000001',
      '/api/cron/evaluate-refreshes',
      'manual:manual-2',
      expect.any(String),
      60 * 60 * 1000
    );
  });

  it('returns a generic failure and caches it when evaluation throws', async () => {
    mockEvaluate.mockRejectedValueOnce(new Error('SENTINEL_EVALUATION_ERROR'));

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual(expect.objectContaining({ error: 'Internal server error', message: 'Evaluation failed' }));
    expect(JSON.stringify(body)).not.toContain('SENTINEL_EVALUATION_ERROR');
    expect(mockNotify).not.toHaveBeenCalled();
    expect(mockComplete).toHaveBeenCalledWith(1, 500, expect.any(Object));
  });

  it('rejects an oversized declared request body before parsing it', async () => {
    const oversized = request({ body: '{}', contentLength: 17 * 1024 });

    const response = await POST(oversized);

    expect(response.status).toBe(413);
    expect(oversized.text).not.toHaveBeenCalled();
    expect(mockEvaluate).not.toHaveBeenCalled();
  });
});
