import { NextRequest, NextResponse } from 'next/server';
import { fetchWeatherData } from '@/lib/core/utils';
import { handleApiError } from '@/lib/errors/handleApiError';
import { logger } from '@/lib/observability/logger';
import { getRequestId } from '@/middleware/requestId';
import { timedHttp } from '@/lib/observability/httpMetrics';

/**
 * Map an upstream status to a fixed client-safe class message.
 *
 * Raw OpenWeather bytes must never reach the response body (safe-error
 * boundary): the detail stays server-side in the structured log. The field
 * name `upstreamMessage` is kept so the `summariseProxyFailure` contract
 * (route JSON shape) is unchanged — only the value is now a class, not a
 * passthrough. Tradeoff: clients lose the verbatim upstream text (e.g.
 * "wrong latitude"); the class + upstreamStatus is enough for the UI badge.
 */
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

// Server-side API route to fetch weather data
// This protects the API key by keeping it server-side only
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  return timedHttp('/api/weather', 'GET', async () => {
  try {
    // Get coordinates from query parameters or use defaults
    const url = new URL(request.url);
    const lat = parseFloat(url.searchParams.get('lat') || '16.4023'); // Default to Baguio
    const lon = parseFloat(url.searchParams.get('lon') || '120.5960');

    // Reject garbage before proxying: OpenWeather answers out-of-range/NaN
    // coordinates with a bare 400 that used to surface as a mystery 500.
    if (
      !Number.isFinite(lat) || !Number.isFinite(lon) ||
      lat < -90 || lat > 90 || lon < -180 || lon > 180
    ) {
      return NextResponse.json(
        { error: 'Invalid coordinates', details: `lat=${url.searchParams.get('lat')}, lon=${url.searchParams.get('lon')}` },
        { status: 400 }
      );
    }

    // Use server-side environment variable (not exposed to client)
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!apiKey) {
      logger.error('[weather] API key not configured', {}, requestId);
      return NextResponse.json(
        { error: 'Weather service not configured' },
        { status: 500 }
      );
    }

    try {
      // Fetch weather data using the server-side API key
      const weatherData = await fetchWeatherData(lat, lon, apiKey);

      if (!weatherData) {
        logger.error('[weather] data returned null', { lat, lon }, requestId);
        return NextResponse.json(
          { error: 'Failed to fetch weather data' },
          { status: 500 }
        );
      }

      // Return the weather data to the client (without exposing the API key)
      return NextResponse.json(weatherData);
    } catch (fetchError) {
      // Upstream failure, not our bug: 502 with a sanitized class message.
      // Raw upstream bytes stay server-side (structured log only) — response
      // bodies must never carry raw upstream text (safe-error boundary).
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