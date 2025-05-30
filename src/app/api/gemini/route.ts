import { NextResponse } from 'next/server';

// Server-side API route to interact with Google Gemini API using the free model
export async function POST(request: Request) {
  try {
    // Parse the request body
    const { prompt, weatherData } = await request.json();
    
    if (!prompt) {
      return NextResponse.json(
        { error: 'Missing prompt in request' },
        { status: 400 }
      );
    }
    
    // Construct the prompt with weather data if available
    let fullPrompt = prompt;
    if (weatherData) {
      fullPrompt = `Current weather in Baguio: ${weatherData.weather[0].main}, ${weatherData.main.temp}°C. ${prompt}`;
    }
    
    // Call the Gemini API using the free model endpoint
    // This uses the free tier which doesn't require an API key
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details available');
      console.error(`Gemini API responded with status ${response.status}: ${errorText}`);
      return NextResponse.json(
        { error: `Gemini API error: ${response.status}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}