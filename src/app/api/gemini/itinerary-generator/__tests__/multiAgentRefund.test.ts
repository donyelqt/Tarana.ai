/**
 * @jest-environment node
 */
const MockedResponse = globalThis.Response as unknown as {
  new (body?: unknown, init?: { status?: number; headers?: Record<string, string> }): InstanceType<typeof globalThis.Response>;
  json(body: unknown, init?: { status?: number }): unknown;
};
if (typeof MockedResponse.json !== 'function') {
  MockedResponse.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponse(JSON.stringify(body), { status: init?.status ?? 200, headers: { 'content-type': 'application/json' } });
}

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { InsufficientCreditsError } from '@/lib/referral-system';

const mockHandleRequest = jest.fn();
const mockRefundCredits = jest.fn();
const mockClearSession = jest.fn();
const mockClaimIdempotency = jest.fn();
const mockCompleteIdempotency = jest.fn();
const mockHashIdempotencyPayload = jest.fn((_payload: unknown) => 'hash-1');

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/flags/flags', () => ({
  isFlagEnabled: () => true,
}));

jest.mock('@/agents/pipelineCoordinator', () => ({
  PipelineCoordinator: jest.fn().mockImplementation(() => ({
    handleRequest: mockHandleRequest,
  })),
}));

jest.mock('@/agents/conciergeAgent', () => ({ ConciergeAgent: jest.fn() }));
jest.mock('@/agents/contextScoutAgent', () => ({ ContextScoutAgent: jest.fn() }));
jest.mock('@/agents/retrievalStrategistAgent', () => ({ RetrievalStrategistAgent: jest.fn() }));
jest.mock('@/agents/itineraryComposerAgent', () => ({ ItineraryComposerAgent: jest.fn() }));
jest.mock('@/agents/providers/requestWeatherProvider', () => ({ RequestWeatherProvider: jest.fn() }));

jest.mock('@/lib/referral-system', () => ({
  CreditService: {
    consumeCredits: jest.fn(),
    getCurrentBalance: jest.fn(),
    refundCredits: (...args: unknown[]) => mockRefundCredits(...args),
  },
  InsufficientCreditsError: class InsufficientCreditsError extends Error {},
}));

jest.mock('@/lib/observability/refundMetrics', () => ({
  takeRefundSnapshot: jest.fn(() => ({ refunded: 0, failed: 0, noop: 0 })),
}));

jest.mock('@/lib/agentic/sessionStore', () => ({
  clearSession: mockClearSession,
}));

jest.mock('../lib/config', () => ({
  API_KEY: 'test-key',
  geminiModel: {},
}));

jest.mock('@/lib/services/idempotencyService', () => ({
  claimIdempotency: (...args: unknown[]) => mockClaimIdempotency(...args),
  completeIdempotency: (...args: unknown[]) => mockCompleteIdempotency(...args),
  getIdempotencyKey: (req: { headers: { get: (key: string) => string | null } }) =>
    req.headers.get('Idempotency-Key') ?? req.headers.get('X-Idempotency-Key'),
  hashIdempotencyPayload: (payload: unknown) => mockHashIdempotencyPayload(payload),
}));

import { POST } from '../route';

const sessionMock = getServerSession as unknown as jest.Mock;

function request(idempotencyKey?: string): NextRequest {
  const body = { prompt: 'Trip' };
  return {
    headers: {
      get: (name: string) => idempotencyKey && name === 'Idempotency-Key' ? idempotencyKey : null,
    },
    json: async () => body,
    clone: () => ({ json: async () => body }) as unknown as NextRequest,
    url: 'http://localhost/api/gemini/itinerary-generator',
    nextUrl: { searchParams: new URLSearchParams() },
  } as unknown as NextRequest;
}

describe('multi-agent refund outcome', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
    mockClaimIdempotency.mockResolvedValue({ kind: 'owner', rowId: 7 });
    mockCompleteIdempotency.mockResolvedValue(undefined);
    mockHashIdempotencyPayload.mockReturnValue('hash-1');
  });

  test('does not report a refund when the coordinator throws before returning a session', async () => {
    mockHandleRequest.mockRejectedValueOnce(Object.assign(new Error('generation failed'), { __galaRefunded: false }));

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({ error: 'Internal server error', refunded: false });
    expect(mockRefundCredits).not.toHaveBeenCalled();
  });

  test('reports a failed post-success fallback as not refunded', async () => {
    mockHandleRequest.mockResolvedValueOnce({
      id: 'session-1',
      userId: 'user-1',
      itinerary: { json: null },
    });
    mockRefundCredits.mockResolvedValueOnce(false);

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({ error: 'Internal server error', refunded: false });
    expect(mockRefundCredits).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      idempotencyKey: 'refund:session-1',
    }));
  });

  test('claims a keyed multi-agent request before invoking the coordinator', async () => {
    mockHandleRequest.mockResolvedValueOnce({
      id: 'session-1',
      userId: 'user-1',
      itinerary: { json: { title: 'Generated' } },
    });

    const response = await POST(request('key-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockClaimIdempotency).toHaveBeenCalledWith('user-1', '/api/gemini/itinerary-generator', 'key-1', 'hash-1');
    expect(mockHandleRequest).toHaveBeenCalledTimes(1);
    expect(mockCompleteIdempotency).toHaveBeenCalledWith(7, 200, body);
  });

  test('returns the successful result when completion persistence fails', async () => {
    mockHandleRequest.mockResolvedValueOnce({
      id: 'session-1',
      userId: 'user-1',
      itinerary: { json: { title: 'Generated' } },
    });
    mockCompleteIdempotency.mockRejectedValueOnce(new Error('idempotency store down'));

    const response = await POST(request('key-1'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: '{"title":"Generated"}' });
    expect(mockRefundCredits).not.toHaveBeenCalled();
    expect(mockCompleteIdempotency).toHaveBeenCalledTimes(1);
  });

  test.each([
    {
      name: 'invalid payload',
      error: Object.assign(new Error('invalid payload'), { details: { prompt: ['Required'] } }),
      status: 400,
    },
    { name: 'authentication', error: new Error('Authentication required'), status: 401 },
    { name: 'insufficient credits', error: new InsufficientCreditsError(1, 0, 'tarana_gala'), status: 402 },
  ])('does not complete a $name claim', async ({ error, status }) => {
    mockHandleRequest.mockRejectedValueOnce(error);

    const response = await POST(request('key-1'));

    expect(response.status).toBe(status);
    expect(mockCompleteIdempotency).not.toHaveBeenCalled();
  });

  test('replays a completed multi-agent response without invoking the coordinator', async () => {
    mockClaimIdempotency.mockResolvedValueOnce({
      kind: 'replay',
      replay: { status: 200, body: { text: '{"cached":true}' } },
    });

    const response = await POST(request('key-1'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: '{"cached":true}' });
    expect(mockHandleRequest).not.toHaveBeenCalled();
    expect(mockCompleteIdempotency).not.toHaveBeenCalled();
  });

  test('rejects an in-flight multi-agent duplicate before charging', async () => {
    mockClaimIdempotency.mockResolvedValueOnce({ kind: 'conflict' });

    const response = await POST(request('key-1'));

    expect(response.status).toBe(409);
    expect(response.headers.get('Retry-After')).toBe('1');
    expect(mockHandleRequest).not.toHaveBeenCalled();
  });

  test('rejects a multi-agent key reused with a different payload', async () => {
    mockClaimIdempotency.mockResolvedValueOnce({ kind: 'payload-mismatch' });

    const response = await POST(request('key-1'));

    expect(response.status).toBe(422);
    expect(mockHandleRequest).not.toHaveBeenCalled();
  });
});
