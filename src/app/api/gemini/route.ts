import { NextResponse } from 'next/server';

// Server-side API route to interact with Google Gemini API using the free model
export async function POST(request: Request) {
  try {
    // Parse the request body
    const { prompt, weatherData, interests, duration, budget, pax } = await request.json();
    
    if (!prompt) {
      return NextResponse.json(
        { error: 'Missing prompt in request' },
        { status: 400 }
      );
    }
    
    // Construct a detailed prompt with weather data and user preferences
    let fullPrompt = prompt;
    
    // Add weather context for weather-responsive planning
    if (weatherData) {
      const weatherCondition = weatherData.weather[0].main.toLowerCase();
      const weatherTemp = Math.round(weatherData.main.temp);
      
      // Weather-specific context
      let weatherContext = `Current weather in Baguio City: ${weatherData.weather[0].main}, ${weatherTemp}°C. `;
      
      // Add weather-specific recommendations
      if (weatherCondition.includes('rain') || weatherCondition.includes('drizzle') || weatherCondition.includes('thunderstorm')) {
        weatherContext += `Since it's rainy, prioritize indoor activities like BenCab Museum, cafes, and shopping malls. Include some covered outdoor activities if possible, but minimize exposure to rain. `;
      } else if (weatherCondition.includes('clear') || weatherCondition.includes('sun')) {
        weatherContext += `Since the weather is clear, prioritize outdoor activities like Camp John Hay Eco-Trail, Tree Top Adventure, hiking trails, and parks. `;
      } else if (weatherCondition.includes('cloud')) {
        weatherContext += `Since it's cloudy, include a mix of indoor and outdoor activities, but have backup indoor options in case of sudden rain. `;
      } else if (weatherTemp < 15) {
        weatherContext += `Since it's quite cold, recommend activities that don't require long exposure to the cold, and suggest warm clothing and hot food options. `;
      }
      
      fullPrompt = weatherContext + fullPrompt;
    }
    
    // Add detailed instructions for the AI
    const detailedInstructions = `
    Create a detailed Baguio City itinerary with the following specifications:
    
    1. Structure the itinerary into morning (8AM-12NN), afternoon (12NN-6PM), and evening (6PM onwards) periods.
    2. For each activity, include:
       - A brief description highlighting key features
       - Estimated duration
       - Relevant tags matching user interests
       - Weather-appropriate suggestions
    
    3. Provide realistic time allocations and travel times between locations.
    4. Recommend budget-appropriate options.
    5. Organize activities with appropriate pacing for the specified duration.
    6. Include specific Baguio City attractions based on these interests:
       - Nature & Scenery: Burnham Park, Mines View Park, Wright Park, Camp John Hay
       - Food & Culinary: Good Taste Restaurant, Café by the Ruins, Hill Station, Vizco's for strawberry shortcake
       - Culture & Arts: BenCab Museum, Tam-awan Village, Baguio Museum
       - Shopping & Local Finds: Night Market on Harrison Road, Baguio City Market, Session Road shops
       - Adventure: Tree Top Adventure with ziplines and canopy rides, Yellow Trail hiking, Mt. Ulap
    
    7. Format the response as a structured JSON object with the following format:
    {
      "title": "Your [Duration] Itinerary",
      "subtitle": "A personalized Baguio Experience",
      "items": [
        {
          "period": "Morning (8AM-12NN)",
          "activities": [
            {
              "title": "Activity Name",
              "time": "Time Range",
              "desc": "Description",
              "tags": ["Interest Category"]
            }
          ]
        }
      ]
    }
    `;
    
    fullPrompt = detailedInstructions + fullPrompt;
    
    console.log('Sending prompt to Gemini:', fullPrompt);
    
    // Get the API key from environment variables
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error('Gemini API key not configured');
      return NextResponse.json(
        { error: 'Gemini service not configured' },
        { status: 500 }
      );
    }
    
    // Call the Gemini API using the free model endpoint
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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
          maxOutputTokens: 4096,
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