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

import { NextRequest } from 'next/server';
import { GET } from '../route';
import { tomtomRoutingService } from '@/lib/services/tomtomRouting';
import { logger } from '@/lib/observability/logger';

jest.mock('@/lib/services/tomtomRouting', () => ({
  tomtomRoutingService: { searchLocations: jest.fn() },
}));
jest.mock('@/lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const searchMock = tomtomRoutingService.searchLocations as jest.Mock;
const mockLogger = logger as jest.Mocked<typeof logger>;

function request(query: string, bounds?: string): NextRequest {
  const url = new URL('http://localhost/api/locations/search');
  url.searchParams.set('q', query);
  if (bounds !== undefined) url.searchParams.set('bounds', bounds);
  return { url: url.toString(), headers: new Headers() } as unknown as NextRequest;
}

describe('GET /api/locations/search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    searchMock.mockResolvedValue([]);
  });

  it('logs bounded search metadata and returns results', async () => {
    searchMock.mockResolvedValue([
      {
        name: 'Session Road',
        coordinates: { lat: 16.4, lon: 120.6 },
        address: 'Session Road',
        category: 'tourist_attraction',
      },
    ]);

    const response = await GET(request('Baguio'));

    expect(response.status).toBe(200);
    expect(mockLogger.info).toHaveBeenNthCalledWith(
      1,
      'Location search started',
      expect.objectContaining({ entryPoint: '/api/locations/search', queryLength: 6 }),
      expect.any(String)
    );
    expect(mockLogger.info).toHaveBeenNthCalledWith(
      2,
      'Location search completed',
      expect.objectContaining({ entryPoint: '/api/locations/search', resultCount: 1 }),
      expect.any(String)
    );
    expect(searchMock).toHaveBeenCalledWith('Baguio', undefined, undefined);
  });

  it('logs malformed bounds without logging the raw parameter', async () => {
    const response = await GET(request('Baguio', '{invalid-json'));

    expect(response.status).toBe(200);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Invalid location bounds',
      { entryPoint: '/api/locations/search', hasBounds: true },
      expect.any(String)
    );
    expect(mockLogger.warn.mock.calls[0]).not.toContain('{invalid-json');
  });

  it('rejects short queries before calling the upstream service', async () => {
    const response = await GET(request('x'));

    expect(response.status).toBe(400);
    expect(searchMock).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled();
  });
});
