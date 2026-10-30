import { NextRequest, NextResponse } from 'next/server';
import { fetchWeatherData } from '@/lib/core/utils';
import { handleApiError } from '@/lib/errors/handleApiError';
import { logger } from '@/lib/observability/logger';
import { getRequestId } from '@/middleware/requestId';
import { timedHttp } from '@/lib/observability/httpMetrics';
import { createRateLimitMiddleware, rateLimitConfigs } from '@/lib/security/rateLimiter';

function safeUpstreamMessage(upstreamStatus: string): string {
  switch (upstreamStatus) {
    case '400':
      return 'Upstream rejected the request';
    case '401':
      return 'Upstream rejected the credentials';
    case '404':
      return 'Upstream found no matching data';
    case '429':
      return 'Upstream rate-limited the request';
    default:
      if (/^5\d\d$/.test(upstreamStatus)) return 'Upstream service unavailable';
      return 'Upstream request failed';
  }
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  return timedHttp('/api/weather', 'GET', async () => {
  const limited = createRateLimitMiddleware(rateLimitConfigs.api)(request);
  if (!limited.allowed) {
    const res = NextResponse.json({ error: 'Rate limit exceeded. Please slow down your requests.' }, { status: 429 });
    if (limited.retryAfter) res.headers.set('Retry-After', String(limited.retryAfter));
    return res;
  }
  try {
    const url = new URL(request.url);
    const lat = parseFloat(url.searchParams.get('lat') || '16.4023'); 
    const lon = parseFloat(url.searchParams.get('lon') || '120.5960');

    if (
      !Number.isFinite(lat) || !Number.isFinite(lon) ||
      lat < -90 || lat > 90 || lon < -180 || lon > 180
    ) {
      return NextResponse.json(
        { error: 'Invalid coordinates', details: `lat=${url.searchParams.get('lat')}, lon=${url.searchParams.get('lon')}` },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!apiKey) {
      logger.error('[weather] API key not configured', {}, requestId);
      return NextResponse.json(
        { error: 'Weather service not configured' },
        { status: 500 }
      );
    }

    try {
      const weatherData = await fetchWeatherData(lat, lon, apiKey);

      if (!weatherData) {
        logger.error('[weather] data returned null', { lat, lon }, requestId);
        return NextResponse.json(
          { error: 'Failed to fetch weather data' },
          { status: 500 }
        );
      }

      return NextResponse.json(weatherData);
    } catch (fetchError) {
      const rawMessage =
        fetchError instanceof Error ? fetchError.message : 'Unknown error occurred';
      const upstreamStatus = /error:\s*(\d{3})/.exec(rawMessage)?.[1] ?? 'unknown';
      logger.error(`[weather] upstream error (OpenWeather ${upstreamStatus})`, {
        upstreamStatus,
        upstreamDetail: rawMessage.slice(0, 300),
        lat,
        lon,
      }, requestId);

      return NextResponse.json(
        {
          error: 'Weather upstream error',
          upstreamStatus,
          upstreamMessage: safeUpstreamMessage(upstreamStatus),
        },
        { status: 502 }
      );
    }
  } catch (error) {
    return handleApiError(error, request);
  }
  }, (res) => res.status);
}