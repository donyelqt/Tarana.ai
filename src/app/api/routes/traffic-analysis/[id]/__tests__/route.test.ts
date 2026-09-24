import { NextRequest } from 'next/server';
import { GET } from '../route';
import { logger } from '@/lib/observability/logger';
import { resetHttpMetrics } from '@/lib/observability/httpMetrics';


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
jest.mock('@/lib/observability/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const mockLogger = logger as jest.Mocked<typeof logger>;
const requestId = '11111111-1111-4111-8111-111111111111';

function request(): NextRequest {
  return {
    headers: {
      get: (name: string) => name === 'x-request-id' ? requestId : null,
    },
  } as unknown as NextRequest;
}

describe('GET /api/routes/traffic-analysis/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetHttpMetrics();
  });

  it('returns the mock analysis and logs bounded request metadata', async () => {
    const response = await GET(request(), { params: { id: 'test-route' } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({
      overallTrafficLevel: 'MODERATE',
      congestionScore: 45,
      recommendationScore: 75,
    }));
    expect(mockLogger.info).toHaveBeenNthCalledWith(
      1,
      'Getting traffic analysis',
      { entryPoint: '/api/routes/traffic-analysis/[id]', routeIdLength: 10 },
      requestId
    );
    expect(mockLogger.info).toHaveBeenNthCalledWith(
      2,
      'Traffic analysis retrieved',
      { entryPoint: '/api/routes/traffic-analysis/[id]', routeIdLength: 10 },
      requestId
    );
  });

  it('rejects a missing route id without logging route data', async () => {
    const response = await GET(request(), { params: { id: '' } });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Route ID is required' });
    expect(mockLogger.info).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
