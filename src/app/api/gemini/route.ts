import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

// Global initialization for Gemini model to avoid re-creating the client on every request.
const API_KEY = process.env.GOOGLE_GEMINI_API_KEY || "";
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;
const geminiModel = genAI ? genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" }) : null;

// Simple in-memory cache for similar requests
const responseCache = new Map<string, { response: any; timestamp: number }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Define a type for the keys of WEATHER_CONTEXTS
type WeatherCondition = keyof typeof WEATHER_CONTEXTS;

// Pre-computed weather context lookup for faster processing
const WEATHER_CONTEXTS = {
  thunderstorm: (temp: number, desc: string) =>
    `WARNING: ${desc} (${temp}°C). ONLY indoor activities: Museums, malls, indoor dining. Select "Indoor-Friendly" tagged activities only.`,
  rainy: (temp: number, desc: string) =>
    `${desc} (${temp}°C). Prioritize "Indoor-Friendly" tagged activities: Museums, malls, covered dining.`,
  snow: (temp: number, desc: string) =>
    `${desc} (${temp}°C)! Focus on "Indoor-Friendly" activities: warm venues, hot beverages, brief safe outdoor viewing.`,
  foggy: (temp: number, desc: string) =>
    `${desc} (${temp}°C). Use "Indoor-Friendly" or "Weather-Flexible" activities. Avoid viewpoints.`,
  cloudy: (temp: number, desc: string) =>
    `${desc} (${temp}°C). Mix of "Weather-Flexible" activities. Good for photography.`,
  clear: (temp: number, desc: string) =>
    `${desc} (${temp}°C). Perfect for "Outdoor-Friendly" activities: hiking, parks, viewpoints.`,
  cold: (temp: number, desc: string) =>
    `${desc} (${temp}°C). Prioritize "Indoor-Friendly" activities with warming options.`,
  default: (temp: number, desc: string) =>
    `Weather: ${desc} at ${temp}°C. Balance indoor/outdoor activities.`,
};

// Mapping of weather types to acceptable activity tags – used to pre-filter the sample DB sent to Gemini
const WEATHER_TAG_FILTERS = {
  thunderstorm: ["Indoor-Friendly"],
  rainy: ["Indoor-Friendly"],
  snow: ["Indoor-Friendly"],
  foggy: ["Indoor-Friendly", "Weather-Flexible"],
  cloudy: ["Outdoor-Friendly", "Weather-Flexible"],
  clear: ["Outdoor-Friendly"],
  cold: ["Indoor-Friendly"],
  default: []
} as const;

// Interest mapping for faster lookup
const INTEREST_DETAILS = {
  "Nature & Scenery": "- Nature & Scenery: Burnham Park, Mines View Park, Wright Park, Camp John Hay, Botanical Garden, Mirador Heritage & Eco Park, Valley of Colors, Mt. Kalugong, Mt. Yangbew, Great Wall of Baguio, Camp John Hay Yellow Trail, Lions Head",
  "Food & Culinary": "- Food & Culinary: Good Taste Restaurant, Café by the Ruins, Hill Station, Vizco's, Baguio Craft Brewery, Oh My Gulay, Choco-late de Batirol, Ili-Likha Food Hub, Canto Bogchi Joint, Arca's Yard, Amare La Cucina, Le Chef at The Manor, Lemon and Olives, Grumpy Joe, Luisa's Cafe, Agara Ramen, 50's Diner, Balajadia Kitchenette, Wagner Cafe, Pizza Volante",
  "Culture & Arts": "- Culture & Arts: BenCab Museum, Tam-awan Village, Baguio Museum, Ili-Likha Artist Village, Baguio Cathedral, The Mansion, Diplomat Hotel, Philippine Military Academy, Igorot Stone Kingdom, Laperal White House, Mt. Cloud Bookshop, Mirador Heritage & Eco Park, Oh My Gulay",
  "Shopping & Local Finds": "- Shopping & Local Finds: Night Market on Harrison Road, Baguio Public Market, Session Road shops, SM City Baguio, Good Shepherd Convent, Easter Weaving Room, Baguio Craft Market, Ili-Likha Food Hub",
  "Adventure": "- Adventure: Tree Top Adventure, Mt. Ulap Eco-Trail, Mines View Park horseback riding, Wright Park horseback riding, Camp John Hay Yellow Trail, Great Wall of Baguio, Mt. Kalugong, Mt. Yangbew, Camp John Hay, Valley of Colors"
};

export async function POST(req: NextRequest) {
  try {
    const { prompt, weatherData, interests, duration, budget, pax, sampleItinerary } = await req.json();

    // Log the incoming request body for debugging
    console.log("Gemini API request body:", { prompt, weatherData, interests, duration, budget, pax, sampleItinerary });

    // Check and log API key presence
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY || "";
    if (!apiKey) {
      console.error("GOOGLE_GEMINI_API_KEY is missing!");
      return NextResponse.json({ text: "", error: "GOOGLE_GEMINI_API_KEY is missing on the server." }, { status: 500 });
    }

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

    // Re-use the globally initialised model (created once per lambda / server instance)
    const model = geminiModel;
    if (!model) {
      console.error("Gemini model is not initialized – missing API key?");
      return NextResponse.json({ text: "", error: "Gemini model not available." }, { status: 500 });
    }

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

    // Normalize UI inputs to internal categories for consistent prompt building
    const durationDays = (() => {
      if (!duration) return null;
      const match = duration.toString().match(/\d+/); // extract first number
      return match ? parseInt(match[0], 10) : null;
    })();

    const budgetCategory = (() => {
      if (!budget) return null;
      if (budget === "less than ₱3,000/day" || budget === "₱3,000 - ₱5,000/day") return "Budget";
      if (budget === "₱5,000 - ₱10,000/day") return "Mid-range";
      if (budget === "₱10,000+/day") return "Luxury";
      return budget; // fallback to the raw value
    })();

    const paxCategory = (() => {
      if (!pax) return null;
      if (pax === "1") return "Solo";
      if (pax === "2") return "Couple";
      if (pax === "3-5") return "Family";
      if (pax === "6+") return "Group";
      return pax; // fallback to the raw value
    })();

    // ------------------
    // Prefilter sample itinerary to reduce prompt size and latency
    // ------------------
    let filteredSampleItinerary = sampleItinerary;
    if (sampleItinerary && typeof sampleItinerary === "object") {
      const allowedWeatherTags: string[] = (WEATHER_TAG_FILTERS as any)[weatherType] ?? [];
      const interestSet = new Set(
        interests && Array.isArray(interests) && !interests.includes("Random") ? interests : []
      );
      filteredSampleItinerary = {
        ...sampleItinerary,
        items: sampleItinerary.items.map((section: any) => ({
          ...section,
          activities: section.activities.filter((act: any) => {
            const interestMatch =
              interestSet.size === 0 || act.tags.some((t: string) => interestSet.has(t));
            const weatherMatch =
              allowedWeatherTags.length === 0 || act.tags.some((t: string) => allowedWeatherTags.includes(t));
            return interestMatch && weatherMatch;
          }),
        })),
      };
    }

    // Streamlined sample itinerary context – send the filtered DB only
    const sampleItineraryContext = filteredSampleItinerary
      ? `Database: ${JSON.stringify(filteredSampleItinerary)}\nRULE: Only use activities from this database. Match user interests and weather tags.`
      : "";

    // Weather context is now handled by the lookup table above

    // Add user preference context
    let interestsContext = "";
    if (interests && Array.isArray(interests) && interests.length > 0 && !interests.includes("Random")) {
      interestsContext = `
        The visitor has expressed specific interest in: ${interests.join(", ")}.
        From the sample itinerary database, prioritize activities that have tags matching these interests:
        ${interests.map((interest: string) => INTEREST_DETAILS[interest as keyof typeof INTEREST_DETAILS] || `- ${interest}: Select appropriate activities from the sample database`).join("\n")}
        
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
    if (durationDays) {
      durationContext = `
        This is a ${durationDays}-day trip, so pace the itinerary accordingly:
        ${durationDays === 1 ? "Focus on must-see highlights and efficient time management. Select 2-3 activities per time period (morning, afternoon, evening) from the sample database." : ""}
        ${durationDays === 2 ? "Balance major attractions with some deeper local experiences. Select 2-3 activities per time period per day from the sample database." : ""}
        ${durationDays === 3 ? "Include major attractions and allow time to explore local neighborhoods. Select 2 activities per time period per day from the sample database, allowing for more relaxed pacing." : ""}
        ${durationDays >= 4 ? "Include major attractions, local experiences, and some day trips to nearby areas. Select 1-2 activities per time period per day from the sample database, allowing for a very relaxed pace." : ""}
      `;
    }

    // Add budget context
    let budgetContext = "";
    if (budgetCategory) {
      budgetContext = `
        The visitor's budget preference is ${budget}, so recommend:
        ${budgetCategory === "Budget" ? "From the sample itinerary database, prioritize activities with the 'Budget-friendly' tag. Focus on affordable dining, free/low-cost attractions, public transportation, and budget accommodations." : ""}
        ${budgetCategory === "Mid-range" ? "From the sample itinerary database, select a mix of budget and premium activities. Include moderate restaurants, standard attraction fees, occasional taxis, and mid-range accommodations." : ""}
        ${budgetCategory === "Luxury" ? "From the sample itinerary database, include premium experiences where available. Recommend fine dining options, premium experiences, private transportation, and luxury accommodations." : ""}
      `;
    }

    // Add group size context
    let paxContext = "";
    if (paxCategory) {
      paxContext = `
        The group size is ${pax}, so consider:
        ${paxCategory === "Solo" ? "From the sample itinerary database, select activities that are enjoyable for solo travelers. Include solo-friendly activities, social opportunities, and safety considerations." : ""}
        ${paxCategory === "Couple" ? "From the sample itinerary database, prioritize activities suitable for couples. Include romantic settings, couple-friendly activities, and intimate dining options." : ""}
        ${paxCategory === "Family" ? "From the sample itinerary database, prioritize activities with the 'Family-friendly' tag if available. Include family-friendly activities, child-appropriate options, and group dining venues." : ""}
        ${paxCategory === "Group" ? "From the sample itinerary database, select activities that can accommodate larger parties. Include group-friendly venues, activities that accommodate larger parties, and group dining options." : ""}
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
      
      Generate a detailed Baguio City itinerary.

      Rules:
      1. **Be concise.**
      2. **Strictly use the provided sample itinerary database.** Do NOT invent, suggest, or mention any activity, place, or experience that is not present in the provided database. If no suitable activity exists for a time slot, omit that time slot entirely and do not output any placeholder.
      3. Match activities to user interests and weather.
      4. Organize by Morning (8AM-12NN), Afternoon (12NN-6PM), Evening (6PM onwards).
      5. Pace the itinerary based on trip duration.
      6. For each activity, include: title, time slot (e.g., "9:00-10:30AM"), a **brief** description (features, costs, location, duration, weather notes), and tags (interest and weather).
      7. Adhere to the user's budget.
      8. Output a JSON object with this structure: { "title": "Your X Day Itinerary", "subtitle": "...", "items": [{"period": "...", "activities": [{"title": "...", "time": "...", "desc": "...", "tags": [...]}]}] }
    `;

    // Optimized generation parameters for faster response
    const generationConfig = {
      responseMimeType: "application/json",
      temperature: 0,  // Lowered for faster, more deterministic responses
      topK: 1,          // Further reduced for faster token selection
      topP: 0.9,         // Kept the same to maintain quality
      maxOutputTokens: 8192 // Increased to prevent incomplete JSON which causes API errors.
    };

    // Generate the itinerary with retry logic to gracefully handle temporary overloads (e.g., 503 Service Unavailable) or rate limits (429).
    const MAX_RETRIES = 3;
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    let result: any = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: detailedPrompt }] }],
          generationConfig,
        });
        break; // Success – exit retry loop.
      } catch (err: any) {
        const status = err?.status || err?.response?.status;
        // Retry only for transient errors
        if (attempt < MAX_RETRIES && (status === 503 || status === 429)) {
          const delay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
          console.warn(`Gemini transient error (status ${status}). Retry ${attempt} of ${MAX_RETRIES} after ${delay}ms`);
          await sleep(delay);
          continue;
        }
        // If not retryable or retries exhausted, rethrow to be handled by outer catch.
        throw err;
      }
    }

    // If result is still null here, all retries failed.
    if (!result) {
      return NextResponse.json(
        { text: "", error: "Failed to generate content after multiple retries due to service unavailability." },
        { status: 503 }
      );
    }

    // Log the result object for debugging
    console.log("Gemini result object:", result);
    // Log the full response object for debugging
    console.log("Gemini full response object:", result.response);

    const response = result.response;
    const text = response.text();
    
    // Log the raw Gemini response for debugging
    console.log("Gemini raw response text:", text);
    
    // If text is empty, return the full response object for debugging
    let finalText = text;
    if (!finalText) {
      // Try to manually extract text from candidates[0].content.parts
      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts;
      if (Array.isArray(parts)) {
        finalText = parts.map(p => p.text || '').join('');
        console.log("Manually extracted Gemini text:", finalText);
      }
      if (!finalText) {
        return NextResponse.json({ text: "", error: "Gemini response.text() and manual extraction are empty", fullResponse: response });
      }
    }
    
    // Try to extract and clean JSON from the response
    let cleanedJson = finalText;

    // Use a more robust regex to extract from markdown code blocks
    const codeBlockMatch = cleanedJson.match(/```(?:json)?\n?([\s\S]*?)\n?```/i);
    if (codeBlockMatch) {
      cleanedJson = codeBlockMatch[1];
    }

    // Further cleaning: remove comments and trailing commas
    cleanedJson = cleanedJson
      .replace(/\/\/.*$/gm, '')       // Remove single line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .replace(/,\s*([\]}])/g, '$1')   // Remove trailing commas
      .trim();

    // Log the cleaned JSON before parsing
    console.log("Cleaned JSON to parse:", cleanedJson);

    try {
      // Validate that it's proper JSON by parsing
      const parsed = JSON.parse(cleanedJson);

      // Remove placeholder activities titled "No available activity" and drop periods with no remaining activities
      if (parsed && typeof parsed === "object" && Array.isArray((parsed as any).items)) {
        (parsed as any).items = (parsed as any).items
          .map((period: any) => {
            const filteredActivities = Array.isArray(period.activities)
              ? period.activities.filter((act: any) => act.title && act.title.toLowerCase() !== "no available activity")
              : [];
            return { ...period, activities: filteredActivities };
          })
          .filter((period: any) => period.activities.length > 0);
      }

      const responseData = { text: JSON.stringify(parsed) };

      // Cache the successful response
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
      // Parsing failed – attempt to salvage JSON between first '{' and last '}'
      try {
        const firstBrace = cleanedJson.indexOf('{');
        const lastBrace = cleanedJson.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const potentialJson = cleanedJson.slice(firstBrace, lastBrace + 1);
          const parsed = JSON.parse(potentialJson);

          if (parsed && typeof parsed === "object" && Array.isArray((parsed as any).items)) {
            (parsed as any).items = (parsed as any).items
              .map((period: any) => {
                const filteredActivities = Array.isArray(period.activities)
                  ? period.activities.filter((act: any) => act.title && act.title.toLowerCase() !== "no available activity")
                  : [];
                return { ...period, activities: filteredActivities };
              })
              .filter((period: any) => period.activities.length > 0);
          }

          const responseData = { text: JSON.stringify(parsed) };
          responseCache.set(cacheKey, { response: responseData, timestamp: Date.now() });
          return NextResponse.json(responseData);
        }
      } catch (inner) {
        // fallthrough to final error handling
      }
      console.error("Failed to parse JSON from Gemini response:", e, cleanedJson);
      return NextResponse.json({ text: "", error: "Failed to parse JSON from Gemini response.", raw: finalText });
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);

    // Handle rate limit errors
    if (typeof error === 'object' && error !== null && 'status' in error && (error as any).status === 429) {
      return NextResponse.json(
        { text: "", error: "API quota exceeded. Please check your plan and billing details, or try again later." },
        { status: 429 }
      );
    } else if (typeof error === 'object' && error !== null && 'status' in error && (error as any).status === 503) {
      return NextResponse.json(
        { text: "", error: "The Gemini model is currently overloaded. Please try again shortly." },
        { status: 503 }
      );
    }
    
    // Handle other errors
    return NextResponse.json(
      { text: "", error: "Failed to generate content." },
      { status: 500 }
    );
  }
}