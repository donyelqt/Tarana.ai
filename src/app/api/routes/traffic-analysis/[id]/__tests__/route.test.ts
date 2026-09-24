import { NextRequest } from 'next/server'
import { POST } from '../route'
import { routeTrafficAnalyzer } from '@/lib/services/routeTrafficAnalysis'
import { logger } from '@/lib/observability/logger'
import { resetHttpMetrics } from '@/lib/observability/httpMetrics'

jest.mock('@/lib/services/routeTrafficAnalysis', () => ({
  routeTrafficAnalyzer: {
    analyzeRouteTraffic: jest.fn(),
  },
}))

jest.mock('@/lib/observability/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

const mockedResponse = globalThis.Response as unknown as {
  new (body?: unknown, init?: { status?: number; headers?: Record<string, string> }): InstanceType<typeof globalThis.Response>
  json(body: unknown, init?: { status?: number }): unknown
}
if (typeof mockedResponse.json !== 'function') {
  mockedResponse.json = (body: unknown, init?: { status?: number }) =>
    new mockedResponse(JSON.stringify(body), {
      status: init?.status ?? 200,
      headers: { 'content-type': 'application/json' },
    })
}

const mockedAnalyzer = routeTrafficAnalyzer.analyzeRouteTraffic as jest.Mock
const mockLogger = logger as jest.Mocked<typeof logger>
const requestId = '11111111-1111-4111-8111-111111111111'

const validRoute = {
  id: 'route-123',
  summary: { travelTimeInSeconds: 1_800 },
  geometry: {
    coordinates: [
      { lat: 16.4088, lng: 120.5979 },
      { lat: 16.4158, lng: 120.6122 },
    ],
  },
}

const analysis = {
  overallTrafficLevel: 'HEAVY',
  congestionScore: 82,
  lastUpdated: '2026-09-25T00:00:00.000Z',
}

function request(body: unknown = { route: validRoute }, contentLength = 512): NextRequest {
  return {
    headers: {
      get: (name: string) => {
        if (name === 'x-request-id') return requestId
        if (name === 'content-type') return 'application/json'
        if (name === 'content-length') return String(contentLength)
        return null
      },
    },
    json: jest.fn().mockResolvedValue(body),
  } as unknown as NextRequest
}

describe('POST /api/routes/traffic-analysis/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetHttpMetrics()
    mockedAnalyzer.mockResolvedValue(analysis)
  })

  it('returns live analyzer output and logs bounded request metadata', async () => {
    const response = await POST(request(), { params: { id: validRoute.id } })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(analysis)
    expect(mockLogger.info).toHaveBeenNthCalledWith(
      1,
      'Traffic analysis requested',
      { entryPoint: '/api/routes/traffic-analysis/[id]', routeIdLength: validRoute.id.length },
      requestId
    )
    expect(mockLogger.info).toHaveBeenNthCalledWith(
      2,
      'Traffic analysis refreshed',
      { entryPoint: '/api/routes/traffic-analysis/[id]', routeIdLength: validRoute.id.length },
      requestId
    )
  })

  it.each([
    ['missing route', { summary: validRoute.summary, geometry: validRoute.geometry }],
    ['invalid coordinates', { ...validRoute, geometry: { coordinates: [{ lat: 91, lng: 121 }] } }],
    ['too few coordinates', { ...validRoute, geometry: { coordinates: [validRoute.geometry.coordinates[0]] } }],
  ])('rejects %s', async (_name, route) => {
    const response = await POST(request({ route }), { params: { id: validRoute.id } })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid route data' })
    expect(mockedAnalyzer).not.toHaveBeenCalled()
  })

  it('rejects a route id that does not match the request path', async () => {
    const response = await POST(request(), { params: { id: 'different-route' } })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Route id does not match request path' })
    expect(mockedAnalyzer).not.toHaveBeenCalled()
  })

  it('rejects an oversized request before reading the body', async () => {
    const nextRequest = request(undefined, 300_000)
    const response = await POST(nextRequest, { params: { id: validRoute.id } })

    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({ error: 'Request body too large' })
    expect(nextRequest.json).not.toHaveBeenCalled()
    expect(mockedAnalyzer).not.toHaveBeenCalled()
  })

  it('returns a safe 500 when traffic analysis fails', async () => {
    mockedAnalyzer.mockRejectedValueOnce(new Error('TOMTOM_SECRET_LEAK'))

    const response = await POST(request(), { params: { id: validRoute.id } })

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to get traffic analysis' })
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Traffic analysis failed',
      {
        entryPoint: '/api/routes/traffic-analysis/[id]',
        routeIdLength: validRoute.id.length,
        errorName: 'Error',
      },
      requestId
    )
    expect(JSON.stringify(mockLogger.error.mock.calls)).not.toContain('TOMTOM_SECRET_LEAK')
  })
})
