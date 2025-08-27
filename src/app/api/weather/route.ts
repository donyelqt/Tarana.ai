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
    const apiKey = process.env.OPENWEATHER_API_KEY || process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
    
    if (!apiKey) {
      console.warn('Weather API key not configured - using fallback data');
      // Return fallback weather data instead of throwing error
      return NextResponse.json({
        weather: [{ id: 800, main: 'Clear', description: 'clear sky' }],
        main: { temp: 20, feels_like: 20, humidity: 60 },
        wind: { speed: 2 },
        name: 'Baguio City',
        fallback: true
      });
    }
    
    console.log('Using API key:', apiKey ? 'API key is present' : 'API key is missing');
    
    console.log(`Fetching weather data for coordinates: ${lat}, ${lon}`);
    
    try {
      // Fetch weather data using the server-side API key
      const weatherData = await fetchWeatherData(lat, lon, apiKey);
      
      if (!weatherData) {
        console.warn('Weather data returned null - using fallback');
        return NextResponse.json({
          weather: [{ id: 800, main: 'Clear', description: 'clear sky' }],
          main: { temp: 20, feels_like: 20, humidity: 60 },
          wind: { speed: 2 },
          name: 'Baguio City',
          fallback: true
        });
      }
      
      // Return the weather data to the client (without exposing the API key)
      return NextResponse.json(weatherData);
    } catch (fetchError) {
      console.warn('Error in fetchWeatherData, using fallback:', fetchError);
      
      // Return fallback weather data instead of error
      return NextResponse.json({
        weather: [{ id: 800, main: 'Clear', description: 'clear sky' }],
        main: { temp: 20, feels_like: 20, humidity: 60 },
        wind: { speed: 2 },
        name: 'Baguio City',
        fallback: true
      });
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