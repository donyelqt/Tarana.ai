import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

// Simple in-memory cache for similar requests
const responseCache = new Map<string, { response: any; timestamp: number }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Define a type for the keys of WEATHER_CONTEXTS
type WeatherCondition = keyof typeof WEATHER_CONTEXTS;

// Pre-computed weather context lookup for faster processing
const WEATHER_CONTEXTS = {
  thunderstorm: (temp: number, desc: string) => `WARNING: Thunderstorm (${temp}°C). ONLY indoor activities: Museums, malls, indoor dining. Select "Indoor-Friendly" tagged activities only.`,
  rainy: (temp: number, desc: string) => `Rainy weather (${temp}°C). Prioritize "Indoor-Friendly" tagged activities: Museums, malls, covered dining.`,
  snow: (temp: number, desc: string) => `Rare snow (${temp}°C)! Focus on "Indoor-Friendly" activities: warm venues, hot beverages, brief safe outdoor viewing.`,
  foggy: (temp: number, desc: string) => `Foggy conditions (${temp}°C). Use "Indoor-Friendly" or "Weather-Flexible" activities. Avoid viewpoints.`,
  cloudy: (temp: number, desc: string) => `Cloudy weather (${temp}°C). Mix of "Weather-Flexible" activities. Good for photography.`,
  clear: (temp: number, desc: string) => `Clear weather (${temp}°C). Perfect for "Outdoor-Friendly" activities: hiking, parks, viewpoints.`,
  cold: (temp: number, desc: string) => `Cold weather (${temp}°C). Prioritize "Indoor-Friendly" activities with warming options.`,
  default: (temp: number, desc: string) => `Weather: ${desc} at ${temp}°C. Balance indoor/outdoor activities."`
};

// Interest mapping for faster lookup
const INTEREST_TAGS = {
  "Nature & Scenery": "Nature",
  "Food & Culinary": "Food", 
  "Culture & Arts": "Culture",
  "Shopping & Local Finds": "Shopping",
  "Adventure": "Adventure"
};

export async function POST(req: NextRequest) {
  try {
    const { prompt, weatherData, interests, duration, budget, pax, sampleItinerary } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }
    
    // Generate cache key based on request parameters
    const cacheKey = JSON.stringify({
      prompt: prompt?.substring(0, 100), // First 100 chars for similarity
      weatherId: weatherData?.weather?.[0]?.id,
      temp: Math.round(weatherData?.main?.temp || 0),
      interests: interests?.sort(),
      duration,
      budget,
      pax
    });
    
    // Check cache for recent similar requests
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.response);
    }

    // Initialize the Google Generative AI with your API key
    const genAI = new GoogleGenerativeAI(
      process.env.GOOGLE_GEMINI_API_KEY || ""
    );

    // Use optimized model for faster responses
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Optimized weather processing
    const weatherId = weatherData?.weather?.[0]?.id || 0;
    const weatherDescription = weatherData?.weather?.[0]?.description || "";
    const temperature = weatherData?.main?.temp || 20;
    
    // Fast weather type determination
    const getWeatherType = (id: number, temp: number): WeatherCondition => {
      if (id >= 200 && id <= 232) return 'thunderstorm';
      if ((id >= 300 && id <= 321) || (id >= 500 && id <= 531)) return 'rainy';
      if (id >= 600 && id <= 622) return 'snow';
      if (id >= 701 && id <= 781) return 'foggy';
      if (id === 800) return 'clear';
      if (id >= 801 && id <= 804) return 'cloudy';
      if (temp < 15) return 'cold';
      return 'default';
    };
    
    const weatherType: WeatherCondition = getWeatherType(weatherId, temperature);
    const weatherContext = WEATHER_CONTEXTS[weatherType](temperature, weatherDescription);

    // Streamlined sample itinerary context
    const sampleItineraryContext = sampleItinerary ? 
      `Database: ${JSON.stringify(sampleItinerary)}\nRULE: Only use activities from this database. Match user interests and weather tags.` : "";

    // Weather context is now handled by the lookup table above

    // Add user preference context
    let interestsContext = "";
    if (interests && Array.isArray(interests) && interests.length > 0 && !interests.includes("Random")) {
      interestsContext = `
        The visitor has expressed specific interest in: ${interests.join(", ")}.
        From the sample itinerary database, prioritize activities that have tags matching these interests:
        ${interests.map((interest: string) => {
          switch(interest) {
            case "Nature & Scenery":
              return "- Nature & Scenery: Burnham Park, Mines View Park, Wright Park, Camp John Hay, Botanical Garden";
            case "Food & Culinary":
              return "- Food & Culinary: Good Taste Restaurant, Café by the Ruins, Hill Station, Vizco's, Baguio Craft Brewery";
            case "Culture & Arts":
              return "- Culture & Arts: BenCab Museum, Tam-awan Village, Baguio Museum, Ili-Likha Artist Village";
            case "Shopping & Local Finds":
              return "- Shopping & Local Finds: Night Market on Harrison Road, Baguio City Market, Session Road shops, Baguio Craft Market";
            case "Adventure":
              return "- Adventure: Tree Top Adventure, Yellow Trail hiking, Mt. Ulap, Mines View Park horseback riding";
            default:
              return `- ${interest}: Select appropriate activities from the sample database`;
          }
        }).join("\n")}
        
        Ensure these activities are also appropriate for the current weather conditions.
      `;
    } else {
      interestsContext = `
        The visitor hasn't specified particular interests, so provide a balanced mix of Baguio's highlights across different categories.
        Select a variety of activities from the sample itinerary database that cover different interest areas.
      `;
    }

    // Add duration context
    let durationContext = "";
    if (duration) {
      durationContext = `
        This is a ${duration}-day trip, so pace the itinerary accordingly:
        ${duration === "1" ? "Focus on must-see highlights and efficient time management. Select 2-3 activities per time period (morning, afternoon, evening) from the sample database." : ""}
        ${duration === "2" ? "Balance major attractions with some deeper local experiences. Select 2-3 activities per time period per day from the sample database." : ""}
        ${duration === "3" ? "Include major attractions and allow time to explore local neighborhoods. Select 2 activities per time period per day from the sample database, allowing for more relaxed pacing." : ""}
        ${duration >= "4" ? "Include major attractions, local experiences, and some day trips to nearby areas. Select 1-2 activities per time period per day from the sample database, allowing for a very relaxed pace." : ""}
      `;
    }

    // Add budget context
    let budgetContext = "";
    if (budget) {
      budgetContext = `
        The visitor's budget preference is ${budget}, so recommend:
        ${budget === "Budget" ? "From the sample itinerary database, prioritize activities with the 'Budget-friendly' tag. Focus on affordable dining, free/low-cost attractions, public transportation, and budget accommodations." : ""}
        ${budget === "Mid-range" ? "From the sample itinerary database, select a mix of budget and premium activities. Include moderate restaurants, standard attraction fees, occasional taxis, and mid-range accommodations." : ""}
        ${budget === "Luxury" ? "From the sample itinerary database, include premium experiences where available. Recommend fine dining options, premium experiences, private transportation, and luxury accommodations." : ""}
      `;
    }

    // Add group size context
    let paxContext = "";
    if (pax) {
      paxContext = `
        The group size is ${pax}, so consider:
        ${pax === "Solo" ? "From the sample itinerary database, select activities that are enjoyable for solo travelers. Include solo-friendly activities, social opportunities, and safety considerations." : ""}
        ${pax === "Couple" ? "From the sample itinerary database, prioritize activities suitable for couples. Include romantic settings, couple-friendly activities, and intimate dining options." : ""}
        ${pax === "Family" ? "From the sample itinerary database, prioritize activities with the 'Family-friendly' tag if available. Include family-friendly activities, child-appropriate options, and group dining venues." : ""}
        ${pax === "Group" ? "From the sample itinerary database, select activities that can accommodate larger parties. Include group-friendly venues, activities that accommodate larger parties, and group dining options." : ""}
      `;
    }

    // Construct a detailed prompt for the AI
    const detailedPrompt = `
      ${prompt}
      
      ${sampleItineraryContext}
      ${weatherContext}
      ${interestsContext}
      ${durationContext}
      ${budgetContext}
      ${paxContext}
      
      Please generate a detailed itinerary for Baguio City by selecting and adapting activities from the provided sample itinerary database.
      IMPORTANT: Do NOT invent, create, or recommend any activities, places, or experiences that are not present in the provided sample itinerary database. Only select, adapt, and recommend from the given sample database. If no suitable activity exists for a time slot or condition, leave it empty or state "No suitable activity available from the sample database for this slot."
      Follow these guidelines:
      
      1. Organize activities by time periods: Morning (8AM-12NN), Afternoon (12NN-6PM), and Evening (6PM onwards)
      2. For each activity, include:
         - Title (use the exact title from the sample database when possible)
         - Time slot with realistic durations (e.g., "9:00AM-10:30AM")
         - Detailed description that includes:
           * Key features and what makes it special
           * Approximate costs (entrance fees, meal prices, activity costs)
           * Location details and travel time from city center
           * Duration information (how long visitors typically spend)
           * Any special notes about weather considerations
         - Tags that match user interests (e.g., "Nature & Scenery", "Food & Culinary", etc.)
         - Weather appropriateness tags (e.g., "Indoor-Friendly", "Outdoor-Friendly", "Weather-Flexible")
      3. Recommend budget-appropriate options that match the user's specified budget level
      4. Ensure realistic time allocations including travel time between locations
      5. For multi-day itineraries, pace activities appropriately (more activities for shorter trips, more relaxed pace for longer trips)
      6. IMPORTANT: Match activities with both user interests AND current weather conditions
      7. IMPORTANT: Select activities strictly from the provided sample itinerary database, adapting descriptions as needed. Do NOT generate or invent any new activities.
      
      Format the response as a JSON object with this structure:
      {
        "title": "Your X Day Itinerary",
        "subtitle": "A personalized Baguio Experience weather for",
        "items": [
          {
            "period": "Morning (8AM-12NN)",
            "activities": [
              {
                "title": "Activity Name",
                "time": "Start-End Time",
                "desc": "Detailed description",
                "tags": ["Interest Tag", "Weather Appropriateness Tag"]
              }
            ]
          }
        ]
      }
    `;

    // Optimized generation parameters for faster response
    const generationConfig = {
      temperature: 0.6,  // Slightly lower for more focused responses
      topK: 20,          // Reduced for faster token selection
      topP: 0.9,         // Slightly lower for more deterministic output
      maxOutputTokens: 4096, // Reduced for faster generation
    };

    // Generate the itinerary with streaming for better UX and retry on failure
    const MAX_RETRIES = 3;
    let result;

    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: detailedPrompt }] }],
          generationConfig,
        });
        // If successful, break out of the loop
        if (result) {
          break;
        }
      } catch (error: any) {
        console.error(`Gemini API call failed on attempt ${i + 1}`, error.message);
        // If it's a service unavailable error and not the last retry
        if (error.status === 503 && i < MAX_RETRIES - 1) {
          const delay = Math.pow(2, i) * 1000; // Exponential backoff
          console.log(`Service unavailable, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // For other errors or on the last attempt, re-throw to be caught by the outer try-catch
          throw error;
        }
      }
    }

    if (!result) {
      console.error("Failed to generate content from Gemini after multiple retries.");
      return NextResponse.json(
        { error: "AI service is currently unavailable. Please try again later." },
        { status: 503 }
      );
    }

    const response = result.response;
    const text = response.text();
    
    // Try to extract JSON from the response
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || 
                  text.match(/```([\s\S]*?)```/) ||
                  text.match(/{[\s\S]*?}/);
                  
    let cleanedJson = "";
    
    if (jsonMatch) {
      // Extract the JSON content
      const jsonContent = jsonMatch[1] || jsonMatch[0];
      
      // Remove any comments (both // and /* */ style) from the JSON
      cleanedJson = jsonContent
        .replace(/\/\/.*$/gm, '') // Remove single line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
        .trim();
        
      try {
        // Validate that it's proper JSON by parsing and stringifying
        const parsed = JSON.parse(cleanedJson);
        cleanedJson = JSON.stringify(parsed);
        
        // Cache the successful response
        const responseData = { text: cleanedJson };
        responseCache.set(cacheKey, {
          response: responseData,
          timestamp: Date.now()
        });
        
        // Clean old cache entries periodically
        if (responseCache.size > 100) {
          const now = Date.now();
          for (const [key, value] of responseCache.entries()) {
            if (now - value.timestamp > CACHE_DURATION) {
              responseCache.delete(key);
            }
          }
        }
        
        return NextResponse.json(responseData);
      } catch (e) {
        console.error("Failed to parse JSON from Gemini response:", e);
        // If parsing fails, return the original text
        return NextResponse.json({ text });
      }
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500 }
    );
  }
}