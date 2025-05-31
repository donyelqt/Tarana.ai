import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { prompt, weatherData, interests, duration, budget, pax, sampleItinerary } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Initialize the Google Generative AI with your API key
    const genAI = new GoogleGenerativeAI(
      process.env.GOOGLE_GEMINI_API_KEY || ""
    );

    // For text-only input, use the gemini-pro model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    // Get weather condition from OpenWeatherMap API format
    const weatherCondition = weatherData?.weather?.[0]?.main || "";
    const weatherDescription = weatherData?.weather?.[0]?.description || "";
    const temperature = weatherData?.main?.temp || 20; // Default to 20°C if not available
    
    // Determine weather context
    const isRainy = weatherCondition.toLowerCase().includes("rain") || weatherDescription.toLowerCase().includes("rain") || weatherDescription.toLowerCase().includes("drizzle");
    const isClear = weatherCondition.toLowerCase().includes("clear") || weatherDescription.toLowerCase().includes("clear") || weatherDescription.toLowerCase().includes("sunny");
    const isCloudy = weatherCondition.toLowerCase().includes("cloud") || weatherDescription.toLowerCase().includes("cloud") || weatherDescription.toLowerCase().includes("overcast");
    const isCold = temperature < 15;
    const isFoggy = weatherCondition.toLowerCase().includes("fog") || weatherDescription.toLowerCase().includes("fog") || weatherDescription.toLowerCase().includes("mist");

    // Create a detailed sample itinerary context based on the provided sample data
    let sampleItineraryContext = "";
    if (sampleItinerary) {
      sampleItineraryContext = `
        ## Sample Itinerary Database
        
        I'm providing you with a sample itinerary database that contains pre-vetted activities for Baguio City.
        You MUST select and recommend activities from this database that best match the user's preferences and current weather conditions.
        
        Here's the sample itinerary database structure:
        ${JSON.stringify(sampleItinerary, null, 2)}
        
        When creating the itinerary, prioritize activities from this database that:
        1. Match the user's selected interests through the tags (e.g., "Nature", "Food", "Culture", "Shopping", "Adventure")
        2. Are appropriate for the current weather conditions using these tags:
           - For rainy weather: Prioritize "Indoor-Friendly" tagged activities
           - For clear weather: Prioritize "Outdoor-Friendly" tagged activities
           - For mixed conditions: Use "Weather-Flexible" tagged activities
        3. Fit within their budget range (look for "Budget-friendly" tags for budget travelers)
        4. Can be reasonably completed within the specified duration
        5. Are suitable for their group size
        
        You can modify the descriptions and details as needed to better match the current context,
        but try to use these pre-vetted activities as your primary recommendations.
      `;
    }

    // Add detailed weather context to the prompt
    let weatherContext = "";
    if (isRainy) {
      weatherContext = `
        Since it's currently raining in Baguio (${temperature}°C, ${weatherDescription}), prioritize indoor activities such as:
        - Museums (BenCab Museum, Baguio Museum)
        - Shopping malls (SM Baguio, Baguio Center Mall)
        - Indoor dining experiences (Hill Station, Café by the Ruins, Vizco's)
        - Cultural centers with indoor exhibits (Tam-awan Village covered areas)
        - Craft workshops and cooking classes
        
        From the sample itinerary database, select activities with the "Indoor-Friendly" tag.
        If including any outdoor activities, they should be marked as weather-dependent alternatives for when the rain stops, or include specific notes about covered areas and rain protection options.
      `;
    } else if (isClear) {
      weatherContext = `
        With clear weather in Baguio (${temperature}°C, ${weatherDescription}), this is perfect for outdoor activities such as:
        - Hiking trails (Mt. Ulap, Yellow Trail, Eco-Trail)
        - Outdoor adventures (Tree Top Adventure, horseback riding)
        - Parks and gardens (Burnham Park, Botanical Garden, Wright Park)
        - Scenic viewpoints (Mines View Park, Signal Hill)
        - Outdoor markets and street food exploration
        
        From the sample itinerary database, prioritize activities with the "Outdoor-Friendly" tag.
        Balance with some indoor options for rest periods and to avoid excessive sun exposure.
      `;
    } else if (isCloudy) {
      weatherContext = `
        With cloudy weather in Baguio (${temperature}°C, ${weatherDescription}), recommend a mix of indoor and outdoor activities:
        - Outdoor activities that don't require clear skies (parks, gardens, markets)
        - Photography-friendly locations that look atmospheric in cloudy conditions
        - Indoor alternatives ready in case the weather changes
        - Cafés with views where visitors can enjoy the scenery while protected
        
        From the sample itinerary database, prioritize activities with the "Weather-Flexible" tag.
        Suggest flexible itineraries that can be adjusted if clouds turn to rain.
      `;
    } else if (isCold) {
      weatherContext = `
        With cold temperatures in Baguio (${temperature}°C, ${weatherDescription}), focus on:
        - Warm indoor venues (cafés, restaurants, museums)
        - Hot food and beverage experiences (hot chocolate, coffee tours, soup restaurants)
        - Activities with minimal exposure to cold winds
        - Shorter outdoor excursions with nearby warming options
        - Shopping experiences in covered markets
        
        From the sample itinerary database, prioritize activities with the "Indoor-Friendly" tag.
        Remind visitors to dress in layers and suggest places where they can warm up between activities.
      `;
    } else if (isFoggy) {
      weatherContext = `
        With foggy or misty conditions in Baguio (${temperature}°C, ${weatherDescription}), recommend:
        - Atmospheric locations that are enhanced by fog (forests, gardens)
        - Indoor activities with large windows to safely enjoy the misty views
        - Cultural experiences that aren't dependent on clear visibility
        - Cozy cafés and restaurants with warming foods and drinks
        - Avoid high viewpoints where fog would completely obstruct the views
        
        From the sample itinerary database, prioritize activities with the "Indoor-Friendly" or "Weather-Flexible" tags.
        Note that fog can make driving difficult, so suggest locations with easy transportation access.
      `;
    } else {
      weatherContext = `
        With the current weather in Baguio (${temperature}°C, ${weatherDescription}), balance indoor and outdoor activities based on comfort level.
        From the sample itinerary database, select a mix of activities with "Indoor-Friendly", "Outdoor-Friendly", and "Weather-Flexible" tags as appropriate.
      `;
    }

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
      7. IMPORTANT: Select activities primarily from the provided sample itinerary database, adapting descriptions as needed
      
      Format the response as a JSON object with this structure:
      {
        "title": "Your X Day Itinerary",
        "subtitle": "A personalized Baguio Experience",
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

    // Configure the generation
    const generationConfig = {
      temperature: 0.6, // Reduced for more consistent outputs and better adherence to the sample database
      topK: 32,
      topP: 0.95,
      maxOutputTokens: 4096,
    };

    // Generate content using the detailed prompt and optimized configuration
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: detailedPrompt }] }],
      generationConfig,
    });

    const response = result.response;
    const text = response.text();
    
    // Try to extract JSON from the response
    let jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || 
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
      } catch (e) {
        console.error("Failed to parse JSON from Gemini response:", e);
        // If parsing fails, return the original text
        return NextResponse.json({ text });
      }
      
      return NextResponse.json({ text: cleanedJson });
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