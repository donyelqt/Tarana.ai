import { NextRequest } from 'next/server';
import { POST } from '../route';
import { logger } from '@/lib/observability/logger';
import { resetHttpMetrics } from '@/lib/observability/httpMetrics';
import { tomtomRoutingService } from '@/lib/services/tomtomRouting';
import { routeTrafficAnalyzer } from '@/lib/services/routeTrafficAnalysis';
import type { RouteData, RouteRequest, RouteTrafficAnalysis } from '@/types/route-optimization';

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
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/services/tomtomRouting', () => ({
  tomtomRoutingService: {
    calculateRoute: jest.fn(),
    getAlternativeRoutes: jest.fn(),
  },
}));

jest.mock('@/lib/services/routeTrafficAnalysis', () => ({
  routeTrafficAnalyzer: {
    analyzeRouteTraffic: jest.fn(),
    compareRouteTraffic: jest.fn(),
  },
}));

const mockLogger = logger as jest.Mocked<typeof logger>;
const mockCalculateRoute = tomtomRoutingService.calculateRoute as jest.MockedFunction<typeof tomtomRoutingService.calculateRoute>;
const mockGetAlternativeRoutes = tomtomRoutingService.getAlternativeRoutes as jest.MockedFunction<typeof tomtomRoutingService.getAlternativeRoutes>;
const mockAnalyzeRouteTraffic = routeTrafficAnalyzer.analyzeRouteTraffic as jest.MockedFunction<typeof routeTrafficAnalyzer.analyzeRouteTraffic>;
const requestId = '11111111-1111-4111-8111-111111111111';

const routeRequest: RouteRequest = {
  origin: { id: 'origin-1', name: 'Origin name', address: 'Origin address', lat: 16.4, lng: 120.6 },
  destination: { id: 'destination-1', name: 'Destination name', address: 'Destination address', lat: 16.5, lng: 120.7 },
  preferences: { routeType: 'fastest' },
};

const primaryRoute = {
  id: 'route-primary',
  summary: { travelTimeInSeconds: 600 },
} as unknown as RouteData;

const trafficAnalysis = {
  overallTrafficLevel: 'LOW',
  segmentAnalysis: [],
  estimatedDelay: 0,
  alternativeRecommendation: false,
  peakHourImpact: {
    isCurrentlyPeakHour: false,
    peakHourMultiplier: 1,
    expectedTrafficIncrease: 0,
  },
  historicalComparison: {
    typicalTravelTime: 600,
    currentVsTypical: 1,
    weekdayPattern: [],
    hourlyPattern: [],
  },
  congestionScore: 20,
  recommendationScore: 80,
  lastUpdated: new Date(),
} as unknown as RouteTrafficAnalysis;

function request(body: unknown): NextRequest {
  return {
    json: jest.fn().mockResolvedValue(body),
    headers: {
      get: (name: string) => name === 'x-request-id' ? requestId : null,
    },
  } as unknown as NextRequest;
}

describe('POST /api/routes/calculate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetHttpMetrics();
    mockCalculateRoute.mockResolvedValue(primaryRoute);
    mockGetAlternativeRoutes.mockResolvedValue([]);
    mockAnalyzeRouteTraffic.mockResolvedValue(trafficAnalysis);
  });

  it('returns the route response and logs bounded request metadata', async () => {
    const response = await POST(request(routeRequest));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.requestId).toEqual(expect.stringMatching(/^req_/));
    expect(mockLogger.info).toHaveBeenNthCalledWith(
      1,
      'Route calculation started',
      { entryPoint: '/api/routes/calculate', waypointCount: 0 },
      requestId
    );
    expect(mockLogger.info).toHaveBeenNthCalledWith(
      2,
      'Primary route calculated',
      { entryPoint: '/api/routes/calculate', routeIdLength: primaryRoute.id.length },
      requestId
    );
    expect(mockLogger.info).toHaveBeenNthCalledWith(
      3,
      'Route analysis completed',
      { entryPoint: '/api/routes/calculate', alternativeCount: 0, congestionScore: 20 },
      requestId
    );
    expect(mockLogger.info).toHaveBeenNthCalledWith(
      4,
      'Route calculation completed',
      { entryPoint: '/api/routes/calculate', alternativeCount: 0, hasAlternativeAnalyses: false, hasComparison: false },
      requestId
    );
    expect(JSON.stringify(mockLogger.info.mock.calls)).not.toContain('Origin name');
    expect(JSON.stringify(mockLogger.info.mock.calls)).not.toContain('Destination name');
    expect(JSON.stringify(mockLogger.info.mock.calls)).not.toContain(primaryRoute.id);
  });

  it('rejects invalid route input without logging', async () => {
    const response = await POST(request({ preferences: { routeType: 'fastest' } }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Origin and destination are required' });
    expect(mockLogger.info).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('uses the traffic fallback without logging upstream errors', async () => {
    mockGetAlternativeRoutes.mockRejectedValue(new Error('SENTINEL_UPSTREAM_ERROR'));
    mockAnalyzeRouteTraffic.mockRejectedValue(new Error('SENTINEL_TRAFFIC_ERROR'));

    const response = await POST(request(routeRequest));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.trafficAnalysis).toEqual(expect.objectContaining({
      overallTrafficLevel: 'MODERATE',
      congestionScore: 50,
    }));
    expect(mockLogger.warn).toHaveBeenNthCalledWith(
      1,
      'Alternative routes unavailable',
      { entryPoint: '/api/routes/calculate' },
      requestId
    );
    expect(mockLogger.warn).toHaveBeenNthCalledWith(
      2,
      'Traffic analysis unavailable; using fallback',
      { entryPoint: '/api/routes/calculate', fallback: true },
      requestId
    );
    expect(JSON.stringify(mockLogger.warn.mock.calls)).not.toContain('SENTINEL_UPSTREAM_ERROR');
    expect(JSON.stringify(mockLogger.warn.mock.calls)).not.toContain('SENTINEL_TRAFFIC_ERROR');
  });
});
