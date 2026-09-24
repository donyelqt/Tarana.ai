import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { timedHttp } from '@/lib/observability/httpMetrics'
import { logger } from '@/lib/observability/logger'
import { getRequestId } from '@/middleware/requestId'
import { routeTrafficAnalyzer } from '@/lib/services/routeTrafficAnalysis'

const MAX_REQUEST_BYTES = 256 * 1024
const MAX_COORDINATES = 1_000

const routeSnapshotSchema = z.object({
  id: z.string().trim().min(1).max(200),
  summary: z.object({
    travelTimeInSeconds: z.number().finite().positive().max(86_400),
  }).strict(),
  geometry: z.object({
    coordinates: z.array(
      z.object({
        lat: z.number().finite().min(-90).max(90),
        lng: z.number().finite().min(-180).max(180),
      }).strict()
    ).min(2).max(MAX_COORDINATES),
  }).strict(),
}).strict()

const requestBodySchema = z.object({ route: routeSnapshotSchema }).strict()

/**
 * POST /api/routes/traffic-analysis/[id]
 * Recompute traffic for a route already held by the caller.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const routeId = params.id
  const requestId = getRequestId(request)

  return timedHttp('/api/routes/traffic-analysis/[id]', 'POST', async () => {
    const contentLengthHeader = request.headers.get('content-length')
    const contentLength = contentLengthHeader ? Number(contentLengthHeader) : 0

    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 })
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = requestBodySchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid route data' }, { status: 400 })
    }

    const { route } = parsed.data
    if (route.id !== routeId) {
      return NextResponse.json({ error: 'Route id does not match request path' }, { status: 400 })
    }

    try {
      logger.info(
        'Traffic analysis requested',
        { entryPoint: '/api/routes/traffic-analysis/[id]', routeIdLength: routeId.length },
        requestId
      )

      const analysis = await routeTrafficAnalyzer.analyzeRouteTraffic(route)
      logger.info(
        'Traffic analysis refreshed',
        { entryPoint: '/api/routes/traffic-analysis/[id]', routeIdLength: routeId.length },
        requestId
      )

      return NextResponse.json(analysis)
    } catch (error) {
      logger.error(
        'Traffic analysis failed',
        {
          entryPoint: '/api/routes/traffic-analysis/[id]',
          routeIdLength: routeId.length,
          errorName: error instanceof Error ? error.name : typeof error,
        },
        requestId
      )

      return NextResponse.json({ error: 'Failed to get traffic analysis' }, { status: 500 })
    }
  }, (res) => res.status)
}
