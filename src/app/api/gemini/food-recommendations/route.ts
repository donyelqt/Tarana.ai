import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { FullMenu, RestaurantData } from "@/app/tarana-eats/data/taranaEatsData";
import { ResultMatch } from "@/types/tarana-eats";
import { RobustFoodJsonParser } from "@/lib/robustFoodJsonParser";
import { FoodRecommendationErrorHandler, FoodErrorType } from "@/lib/foodRecommendationErrorHandler";

interface EnhancedResultMatch extends ResultMatch {
  fullMenu?: FullMenu;
  reason?: string;
}

// Global initialization for Gemini model
const API_KEY = process.env.GOOGLE_GEMINI_API_KEY || "";
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;
const geminiModel = genAI ? genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" }) : null;

// Optimized caching system
const responseCache = new Map<string, { response: any; timestamp: number }>();
const preprocessingCache = new Map<string, any>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes for better cache utilization

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

    // Parse preferences first to avoid block-scoped variable error
    const preferences = parseUserPreferences(prompt);
    
    // Generate optimized cache key
    const cacheKey = JSON.stringify({
      prompt: prompt?.substring(0, 30), // Further reduced for better hit rates
      budget: preferences.budget ? Math.floor(parseInt(preferences.budget) / 100) * 100 : null, // Round to nearest 100
      cuisine: preferences.cuisine,
      pax: preferences.pax || 2
    });
    
    // Check cache for recent similar requests
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.response);
    }
    const preprocessingKey = `${preferences.cuisine || 'all'}-${preferences.budget || 'all'}-${preferences.pax || 2}`;
    let relevantRestaurants = preprocessingCache.get(preprocessingKey);
    if (!relevantRestaurants) {
      relevantRestaurants = getRelevantRestaurants(foodData.restaurants, preferences);
      preprocessingCache.set(preprocessingKey, relevantRestaurants);
    }

    // Re-use the globally initialised model
    const model = geminiModel;
    if (!model) {
      console.error("Gemini model is not initialized – missing API key?");
      // Create a fallback response
      const fallbackRecommendations = createFallbackRecommendations(foodData, prompt);
      return NextResponse.json(fallbackRecommendations);
    }

    const enhancedPrompt = `
    USER REQUEST: ${prompt}

    RELEVANT RESTAURANTS:
    ${JSON.stringify(relevantRestaurants.map((r: RestaurantData) => ({
      name: r.name,
      cuisine: r.cuisine,
      priceRange: r.priceRange,
      location: r.location,
      popularFor: r.popularFor,
      dietaryOptions: r.dietaryOptions,
      ratings: r.ratings || 0
    })), null, 2)}

    USER PREFERENCES: ${JSON.stringify(preferences)}

    RESPONSE FORMAT:
    {
      "matches": [
        {
          "name": "Restaurant Name",
          "meals": <group size>,
          "price": <total price>,
          "image": "image path",
          "reason": "Why this restaurant matches"
        }
      ]
    }
    `;

    try {
      // Call Gemini API
      const result = await model.generateContent(enhancedPrompt);
      const response = await result.response;
      const textResponse = response.text();
      console.log("Gemini Raw Response for Debugging:", textResponse); // Temporary debug log

      // Use robust JSON parser with multiple recovery strategies
      const parseResult = RobustFoodJsonParser.parseResponse(textResponse);
      let recommendations: { matches: EnhancedResultMatch[] };

      if (parseResult.success && parseResult.data) {
        recommendations = parseResult.data;
        
        // Validate and enhance the response
        if (recommendations.matches && Array.isArray(recommendations.matches)) {
          recommendations.matches = validateAndEnhanceRecommendations(recommendations.matches, foodData, preferences);
        }
      } else {
        console.warn(`🔄 JSON parsing failed, using fallback recommendations`);
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
      const error = FoodRecommendationErrorHandler.createError(apiError, 'gemini_api_call');
      FoodRecommendationErrorHandler.logError(error);
      
      // Create a fallback response
      const fallbackRecommendations = createFallbackRecommendations(foodData, prompt);
      return NextResponse.json(fallbackRecommendations);
    }
  } catch (error) {
    const foodError = FoodRecommendationErrorHandler.createError(error, 'food_recommendations_api');
    FoodRecommendationErrorHandler.logError(foodError);
    
    const errorResponse = FoodRecommendationErrorHandler.createErrorResponse(foodError);
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// Validation and enhancement helper
function validateAndEnhanceRecommendations(matches: EnhancedResultMatch[], foodData: any, preferences: any): EnhancedResultMatch[] {
  return matches.map(match => {
    const restaurant = foodData.restaurants.find((r: RestaurantData) => r.name === match.name);
    if (!restaurant) return match;

    // CRITICAL: Override AI's price with user's actual budget
    let finalPrice = match.price; // Default to AI's price
    
    if (preferences.budget) {
      const userBudget = parseInt(preferences.budget.replace(/[^\d]/g, ''));
      if (userBudget && userBudget > 0) {
        finalPrice = userBudget; // Use user's budget as total budget
        
        // DEBUG LOGGING - Remove after fixing
        console.log("🔍 VALIDATION DEBUG - Overriding AI price with user budget:", {
          restaurantName: match.name,
          aiGeneratedPrice: match.price,
          userBudgetInput: preferences.budget,
          extractedUserBudget: userBudget,
          finalPriceUsed: finalPrice
        });
      }
    }

    return {
      ...match,
      price: finalPrice, // Use user budget instead of AI's price
      image: restaurant.image || match.image,
      fullMenu: restaurant.fullMenu
    };
  });
}

// Optimized fallback recommendations with simplified scoring
function createFallbackRecommendations(foodData: any, prompt: string): { matches: EnhancedResultMatch[] } {
  const preferences = parseUserPreferences(prompt);
  
  // Quick scoring with pre-filtered restaurants
  const scoredRestaurants = getRelevantRestaurants(foodData.restaurants, preferences)
    .map((restaurant: any) => ({
      ...restaurant,
      score: calculateQuickScore(restaurant, preferences),
      reason: generateQuickReason(restaurant, preferences)
    }));
  
  const topMatches = scoredRestaurants
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 3);
  
  const matches: EnhancedResultMatch[] = topMatches.map((restaurant: any) => ({
    name: restaurant.name,
    meals: preferences.pax || 2,
    price: calculateRecommendedPrice(restaurant, preferences.pax || 2, preferences.budget),
    image: restaurant.image,
    reason: restaurant.reason,
    fullMenu: restaurant.fullMenu
  }));
  
  return { matches };
}

// Parse user preferences from prompt
function parseUserPreferences(prompt: string): any {
  const preferences: any = {};
  
  // Extract budget
  const budgetMatch = prompt.match(/₱(\d+)/) || prompt.match(/budget.*?(\d+)/i);
  if (budgetMatch) {
    preferences.budget = budgetMatch[1];
  }
  
  // Extract cuisine
  const cuisineOptions = ['Filipino', 'Korean', 'Japanese', 'Cafe', 'Coffee', 'Vegetarian', 'Buffet'];
  for (const cuisine of cuisineOptions) {
    if (prompt.toLowerCase().includes(cuisine.toLowerCase())) {
      preferences.cuisine = cuisine;
      break;
    }
  }
  
  // Extract pax/group size
  const paxMatch = prompt.match(/(\d+)\s*people?/) || prompt.match(/(\d+)\s*pax/i);
  if (paxMatch) {
    preferences.pax = parseInt(paxMatch[1]);
  }
  
  // Extract dietary restrictions
  preferences.restrictions = [];
  if (prompt.toLowerCase().includes('vegetarian')) preferences.restrictions.push('Vegetarian');
  if (prompt.toLowerCase().includes('vegan')) preferences.restrictions.push('Vegan');
  if (prompt.toLowerCase().includes('halal')) preferences.restrictions.push('Halal');
  
  // Extract meal type
  preferences.mealType = [];
  if (prompt.toLowerCase().includes('breakfast')) preferences.mealType.push('Breakfast');
  if (prompt.toLowerCase().includes('lunch')) preferences.mealType.push('Lunch');
  if (prompt.toLowerCase().includes('dinner')) preferences.mealType.push('Dinner');
  if (prompt.toLowerCase().includes('snack')) preferences.mealType.push('Snack');
  
  // Extract location
  const locationMatch = prompt.match(/at\s+(.+?)(?:\s+for|$)/i);
  if (locationMatch) {
    preferences.location = locationMatch[1];
  }
  
  return preferences;
}

// Parse budget range
function parseBudgetRange(budgetStr: string): { min: number; max: number } {
  const budget = parseInt(budgetStr);
  if (budget <= 200) return { min: 0, max: 200 };
  if (budget <= 400) return { min: 201, max: 400 };
  if (budget <= 600) return { min: 401, max: 600 };
  return { min: 601, max: 1000 };
}

// Calculate recommended price based on user's budget input, fallback to restaurant pricing
function calculateRecommendedPrice(restaurant: any, groupSize: number, userBudget?: string): number {
  // If user provided a budget, use that as the total budget for the group
  if (userBudget) {
    const budgetNum = parseInt(userBudget.replace(/[^\d]/g, ''));
    if (budgetNum && budgetNum > 0) {
      // DEBUG LOGGING - Remove after fixing
      console.log("🔍 API ROUTE DEBUG - Using User Budget:", {
        restaurantName: restaurant.name,
        userBudgetInput: userBudget,
        extractedBudgetNum: budgetNum,
        groupSize: groupSize,
        finalPrice: budgetNum
      });
      return budgetNum; // Return user's budget as total budget for entire group
    }
  }
  
  // Fallback: use restaurant's average price × group size
  const avgPrice = (restaurant.priceRange.min + restaurant.priceRange.max) / 2;
  const fallbackPrice = Math.round(avgPrice * groupSize);
  
  // DEBUG LOGGING - Remove after fixing
  console.log("🔍 API ROUTE DEBUG - Using Restaurant Pricing:", {
    restaurantName: restaurant.name,
    userBudgetInput: userBudget,
    restaurantMinPrice: restaurant.priceRange.min,
    restaurantMaxPrice: restaurant.priceRange.max,
    avgPrice: avgPrice,
    groupSize: groupSize,
    finalPrice: fallbackPrice
  });
  
  return fallbackPrice;
}

// Pre-filter restaurants based on preferences
function getRelevantRestaurants(restaurants: RestaurantData[], preferences: any): RestaurantData[] {
  return restaurants.filter(restaurant => {
    // Budget filter
    if (preferences.budget) {
      const budgetRange = parseBudgetRange(preferences.budget);
      const avgPrice = (restaurant.priceRange.min + restaurant.priceRange.max) / 2;
      if (avgPrice > budgetRange.max + 100) return false; // Allow slight buffer
    }
    
    // Cuisine filter
    if (preferences.cuisine && preferences.cuisine !== 'Show All') {
      if (!restaurant.cuisine.some(c => c.toLowerCase().includes(preferences.cuisine.toLowerCase()))) {
        return false;
      }
    }
    
    // Dietary restrictions filter
    if (preferences.restrictions && preferences.restrictions.length > 0) {
      const hasRequiredRestrictions = preferences.restrictions.every((restriction: string) => 
        restaurant.dietaryOptions.includes(restriction)
      );
      if (!hasRequiredRestrictions) return false;
    }
    
    return true;
  }).slice(0, 5); // Limit to top 5 most relevant
}

// Quick scoring algorithm for fallback
function calculateQuickScore(restaurant: any, preferences: any): number {
  let score = 0;
  
  // Cuisine match
  if (preferences.cuisine && restaurant.cuisine.includes(preferences.cuisine)) {
    score += 50;
  }
  
  // Budget match
  if (preferences.budget) {
    const budgetRange = parseBudgetRange(preferences.budget);
    const avgPrice = (restaurant.priceRange.min + restaurant.priceRange.max) / 2;
    if (avgPrice <= budgetRange.max) {
      score += 30;
    } else if (avgPrice <= budgetRange.max + 100) {
      score += 15; // Partial match
    }
  }
  
  // Group size match
  const groupSize = preferences.pax || 2;
  const avgPrice = (restaurant.priceRange.min + restaurant.priceRange.max) / 2;
  const totalPrice = avgPrice * groupSize;
  
  if (groupSize <= 2 && totalPrice <= 500) score += 20;
  else if (groupSize <= 5 && totalPrice <= 1000) score += 20;
  else if (groupSize > 5 && restaurant.cuisine.includes('Buffet')) score += 25;
  
  // Rating bonus
  if (restaurant.ratings >= 4.0) score += 10;
  
  return score;
}

// Generate concise reason
function generateQuickReason(restaurant: any, preferences: any): string {
  const reasons: string[] = [];
  
  if (preferences.cuisine && restaurant.cuisine.includes(preferences.cuisine)) {
    reasons.push(`Perfect ${preferences.cuisine} cuisine`);
  }
  
  if (preferences.budget) {
    const budgetRange = parseBudgetRange(preferences.budget);
    const avgPrice = (restaurant.priceRange.min + restaurant.priceRange.max) / 2;
    if (avgPrice <= budgetRange.max) {
      reasons.push(`Fits ₱${preferences.budget} budget`);
    }
  }
  
  if (restaurant.ratings >= 4.0) {
    reasons.push(`${restaurant.ratings}★ rated`);
  }
  
  if (reasons.length === 0) {
    return `Popular ${restaurant.cuisine.join(', ')} restaurant`;
  }
  
  return reasons.join(' • ');
}


// Health check endpoint for monitoring
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  
  if (action === 'health') {
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'food-recommendations'
    });
  }
  
  if (action === 'stats') {
    const stats = FoodRecommendationErrorHandler.getStats();
    return NextResponse.json(stats);
  }
  
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}