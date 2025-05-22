import { NextResponse } from 'next/server';
import { fetchWeatherData } from '@/lib/utils';

// Server-side API route to fetch weather data
// This protects the API key by keeping it server-side only
export async function GET(request: Request) {
  try {
    // Get coordinates from query parameters or use defaults
    const url = new URL(request.url);
    const lat = parseFloat(url.searchParams.get('lat') || '16.4023'); // Default to Baguio
    const lon = parseFloat(url.searchParams.get('lon') || '120.5960');
    
    // Use server-side environment variable (not exposed to client)
    const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
    
    if (!apiKey) {
      console.error('Weather API key not configured');
      return NextResponse.json(
        { error: 'Weather service not configured' },
        { status: 500 }
      );
    }
    
    console.log('Using API key:', apiKey ? 'API key is present' : 'API key is missing');
    
    console.log(`Fetching weather data for coordinates: ${lat}, ${lon}`);
    
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
      console.error('Error in fetchWeatherData:', fetchError);
      return NextResponse.json(
        { error: `Weather data fetch error: ${fetchError.message}` },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Weather API route error:', error);
    return NextResponse.json(
      { error: `Failed to fetch weather data: ${error.message}` },
      { status: 500 }
    );
  }
}