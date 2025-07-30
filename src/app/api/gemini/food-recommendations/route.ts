import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { FullMenu, RestaurantData } from "@/app/tarana-eats/data/taranaEatsData";
import { ResultMatch } from "@/types/tarana-eats";

interface EnhancedResultMatch extends ResultMatch {
  fullMenu?: FullMenu;
  reason?: string;
}

// Global initialization for Gemini model
const API_KEY = process.env.GOOGLE_GEMINI_API_KEY || "";
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;
const geminiModel = genAI ? genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" }) : null;

// Simple in-memory cache for similar requests
const responseCache = new Map<string, { response: any; timestamp: number }>();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

export async function POST(req: NextRequest) {
  try {
    const { prompt, foodData } = await req.json();

    // Input validation
    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Check and log API key presence
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY || "";
    if (!apiKey) {
      console.log("GOOGLE_GEMINI_API_KEY is missing! Using fallback response.");
      
      // Create a fallback response with the available restaurant data
      // This will work even without the API key
      const fallbackRecommendations = createFallbackRecommendations(foodData, prompt);
      return NextResponse.json(fallbackRecommendations);
    }

    // Generate cache key based on request parameters
    const cacheKey = JSON.stringify({
      prompt: prompt?.substring(0, 100) // First 100 chars for similarity
    });
    
    // Check cache for recent similar requests
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.response);
    }

    // Re-use the globally initialised model
    const model = geminiModel;
    if (!model) {
      console.error("Gemini model is not initialized – missing API key?");
      // Create a fallback response
      const fallbackRecommendations = createFallbackRecommendations(foodData, prompt);
      return NextResponse.json(fallbackRecommendations);
    }

    // Create a more detailed prompt that includes the food data
    const enhancedPrompt = `
    ${prompt}

    Available restaurant data:
    ${JSON.stringify(foodData.restaurants.map((r: RestaurantData) => ({
      name: r.name,
      cuisine: r.cuisine,
      priceRange: r.priceRange,
      location: r.location,
      popularFor: r.popularFor,
      dietaryOptions: r.dietaryOptions,
      ratings: r.ratings,
      tags: r.tags
    })))}

    User saved meals history:
    ${JSON.stringify(foodData.savedMeals)}

    Available food options in form:
    ${JSON.stringify(foodData.formOptions)}

    Using the restaurant data and user preferences, provide recommendations for restaurants that best match the user's criteria.
    
    The response should be in the following format:
    {
      "matches": [
        {
          "name": "Restaurant Name",
          "meals": <number of people>,
          "price": <average price>,
          "image": "<image path>",
          "reason": "Brief explanation why this is a good match"
        },
        ...more matches
      ]
    }
    
    Only include restaurants from the available data. Return only the best matches (between 1-3 restaurants) - do not duplicate restaurants to reach exactly 3 recommendations.
    `;

    try {
      // Call Gemini API
      const result = await model.generateContent(enhancedPrompt);
      const response = await result.response;
      const textResponse = response.text();
      
      // Try to parse the JSON response
      let recommendations: { matches: EnhancedResultMatch[] };
      try {
        // Look for JSON in the response
        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          recommendations = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No valid JSON found in response");
        }
      } catch (parseError) {
        console.error("Failed to parse Gemini response:", parseError);
        
        // Fallback: Create a structured response based on the text
        recommendations = createFallbackRecommendations(foodData, prompt);
      }
      
      // Enhance each match with the full menu data
      if (recommendations && recommendations.matches && Array.isArray(recommendations.matches)) {
        recommendations.matches = recommendations.matches.map((match: EnhancedResultMatch) => {
          const restaurant = foodData.restaurants.find((r: RestaurantData) => r.name === match.name);
          if (restaurant) {
            return {
              ...match,
              fullMenu: restaurant.fullMenu
            };
          }
          return match;
        });
      }
      
      // Cache the response
      responseCache.set(cacheKey, {
        response: recommendations,
        timestamp: Date.now()
      });

      return NextResponse.json(recommendations);
    } catch (apiError) {
      console.error("Error calling Gemini API:", apiError);
      // Create a fallback response
      const fallbackRecommendations = createFallbackRecommendations(foodData, prompt);
      return NextResponse.json(fallbackRecommendations);
    }
  } catch (error) {
    console.error("Error in food recommendations API:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

// Helper function to create fallback recommendations
function createFallbackRecommendations(foodData: any, prompt: string): { matches: EnhancedResultMatch[] } {
  // Parse user preferences from prompt if possible
  const prefersCuisine = (prompt.includes('cuisine') && 
    (prompt.includes('Filipino') || prompt.includes('Korean') || prompt.includes('Japanese'))) 
    ? prompt.includes('Filipino') ? 'Filipino' 
    : prompt.includes('Korean') ? 'Korean' 
    : 'Japanese'
    : null;
  
  const isDietaryRestriction = prompt.includes('Vegetarian') || prompt.includes('Vegan') || prompt.includes('Halal');
  
  const isMealType = prompt.includes('Breakfast') || prompt.includes('Lunch') || prompt.includes('Dinner') || prompt.includes('Snack');
  
  // Filter restaurants based on the parsed preferences
  let filteredRestaurants = [...foodData.restaurants];
  
  if (prefersCuisine) {
    filteredRestaurants = filteredRestaurants.filter(r => 
      r.cuisine.includes(prefersCuisine)
    );
  }
  
  if (isDietaryRestriction) {
    if (prompt.includes('Vegetarian')) {
      filteredRestaurants = filteredRestaurants.filter(r => 
        r.dietaryOptions.includes('Vegetarian')
      );
    }
    if (prompt.includes('Vegan')) {
      filteredRestaurants = filteredRestaurants.filter(r => 
        r.dietaryOptions.includes('Vegan')
      );
    }
    if (prompt.includes('Halal')) {
      filteredRestaurants = filteredRestaurants.filter(r => 
        r.dietaryOptions.includes('Halal')
      );
    }
  }
  
  if (isMealType) {
    if (prompt.includes('Breakfast')) {
      filteredRestaurants = filteredRestaurants.filter(r => 
        r.popularFor.includes('Breakfast')
      );
    }
    if (prompt.includes('Lunch')) {
      filteredRestaurants = filteredRestaurants.filter(r => 
        r.popularFor.includes('Lunch')
      );
    }
    if (prompt.includes('Dinner')) {
      filteredRestaurants = filteredRestaurants.filter(r => 
        r.popularFor.includes('Dinner')
      );
    }
    if (prompt.includes('Snack')) {
      filteredRestaurants = filteredRestaurants.filter(r => 
        r.popularFor.includes('Snack')
      );
    }
  }
  
  // If we have no matches after filtering, use the original list
  if (filteredRestaurants.length === 0) {
    filteredRestaurants = foodData.restaurants.slice(0, 3);
  }
  
  // Create enhanced result matches - don't force exactly 3 matches
  const matches: EnhancedResultMatch[] = filteredRestaurants.map(restaurant => ({
    name: restaurant.name,
    meals: 2,  // Default value
    price: (restaurant.priceRange.min + restaurant.priceRange.max) / 2,
    image: restaurant.image,
    reason: `This restaurant offers ${restaurant.cuisine.join(', ')} cuisine and is popular for ${restaurant.popularFor.join(', ')}.`,
    fullMenu: restaurant.fullMenu
  }));
  
  return { matches };
} 