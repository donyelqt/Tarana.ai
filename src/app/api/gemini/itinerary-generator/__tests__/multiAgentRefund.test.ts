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

const mockHandleRequest = jest.fn();
const mockRefundCredits = jest.fn();
const mockClearSession = jest.fn();

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

import { POST } from '../route';

const sessionMock = getServerSession as unknown as jest.Mock;

function request(): NextRequest {
  return {
    headers: { get: () => null },
    json: async () => ({ prompt: 'Trip' }),
    url: 'http://localhost/api/gemini/itinerary-generator',
    nextUrl: { searchParams: new URLSearchParams() },
  } as unknown as NextRequest;
}

describe('multi-agent refund outcome', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionMock.mockResolvedValue({ user: { id: 'user-1' } });
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
});
