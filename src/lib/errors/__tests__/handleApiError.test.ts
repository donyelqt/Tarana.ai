import { NextRequest } from 'next/server';
import { handleApiError } from '../handleApiError';
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

jest.mock('@/lib/observability/logger', () => ({
  logger: { error: jest.fn() },
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

describe('handleApiError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not log an unknown error message', () => {
    const response = handleApiError(new Error('SENTINEL_RAW_ERROR'), request());

    expect(response.status).toBe(500);
    expect(JSON.stringify(mockLogger.error.mock.calls)).not.toContain('SENTINEL_RAW_ERROR');
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Internal server error',
      { code: 'UNKNOWN', retryable: false },
      requestId
    );
  });
});
