import { NextResponse } from 'next/server';
import { fetchWeatherData } from '@/lib/core/utils';

// Server-side API route to fetch weather data
// This protects the API key by keeping it server-side only
export async function GET(request: Request) {
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
      console.error('Weather API key not configured');
      return NextResponse.json(
        { error: 'Weather service not configured' },
        { status: 500 }
      );
    }

    try {
      // Fetch weather data using the server-side API key
      const weatherData = await fetchWeatherData(lat, lon, apiKey);

      if (!weatherData) {
        console.error('Weather data returned null');
        return NextResponse.json(
          { error: 'Failed to fetch weather data' },
          { status: 500 }
        );
      }

      // Return the weather data to the client (without exposing the API key)
      return NextResponse.json(weatherData);
    } catch (fetchError) {
      // Upstream failure, not our bug: 502 (was 500) + upstream message so the
      // single client log line says WHY (e.g. "Invalid API key", rate limit).
      const upstreamMessage = fetchError instanceof Error
        ? fetchError.message
        : 'Unknown error occurred';
      const upstreamStatus = /error:\s*(\d{3})/.exec(upstreamMessage)?.[1] ?? 'unknown';
      console.error(`Weather upstream error (OpenWeather ${upstreamStatus}) for ${lat},${lon}: ${upstreamMessage}`);

      return NextResponse.json(
        {
          error: 'Weather upstream error',
          upstreamStatus,
          upstreamMessage,
        },
        { status: 502 }
      );
    }

  } catch (error) {
    console.error('Weather API route error:', error);
    const errorMessage = error instanceof Error
      ? error.message
      : 'Unknown error occurred';

    return NextResponse.json(
      { error: `Failed to fetch weather data: ${errorMessage}` },
      { status: 500 }
    );
  }
}