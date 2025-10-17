import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { FullMenu, RestaurantData } from "@/app/tarana-eats/data/taranaEatsData";
import { ResultMatch } from "@/types/tarana-eats";
import { RobustFoodJsonParser } from "@/lib/robustFoodJsonParser";
import { FoodRecommendationErrorHandler, FoodErrorType } from "@/lib/foodRecommendationErrorHandler";
import { recommendationEngine } from "@/app/tarana-eats/services/recommendationEngine";
import { menuIndexingService } from "@/app/tarana-eats/services/menuIndexingService";
import { budgetAllocator } from "@/app/tarana-eats/services/budgetAllocator";

interface EnhancedResultMatch extends ResultMatch {
  fullMenu?: FullMenu;
  reason?: string;
  recommendedMenuItems?: any[];
  budgetAllocation?: {
    totalCost: number;
    remainingBudget: number;
    utilizationRate: number;
    recommendations: string[];
  };
  matchScore?: number;
}

// Global initialization for Gemini model (matching itinerary-generator pattern)
const API_KEY = process.env.GOOGLE_GEMINI_API_KEY || "";
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// Use environment variable or fall back to default "gemini" model
const DEFAULT_MODEL_ID = "gemini";
const configuredModelId = process.env.GOOGLE_GEMINI_MODEL?.trim();
const MODEL_ID = configuredModelId && configuredModelId.length > 0 ? configuredModelId : DEFAULT_MODEL_ID;

if (!configuredModelId && API_KEY) {
  console.warn(`[Food Recommendations] GOOGLE_GEMINI_MODEL not set. Using default: ${DEFAULT_MODEL_ID}`);
}

const geminiModel = genAI ? genAI.getGenerativeModel({ model: MODEL_ID }) : null;

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

    // Parse preferences first to avoid block-scoped variable error
    const preferences = parseUserPreferences(prompt);

    // Initialize menu indexing service with restaurant data
    if (foodData?.restaurants && foodData.restaurants.length > 0) {
      try {
        menuIndexingService.indexRestaurants(foodData.restaurants);
        console.log('✅ Menu indexing initialized');
      } catch (indexError) {
        console.warn('⚠️ Menu indexing failed, continuing without index:', indexError);
      }
    }

    // Check and log API key presence
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY || "";
    if (!apiKey) {
      console.warn("⚠️ GOOGLE_GEMINI_API_KEY is missing! Using intelligent fallback with recommendation engine.");
      
      // Use intelligent recommendation engine instead of basic fallback
      const intelligentRecommendations = createIntelligentRecommendations(foodData, prompt, preferences);
      return NextResponse.json(intelligentRecommendations);
    }
    
    console.log("✓ Gemini AI enabled - generating personalized recommendations...");
    
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

    // Get menu statistics for context
    const menuStats = menuIndexingService.getIndexStats();
    
    const enhancedPrompt = `
    USER REQUEST: ${prompt}

    MENU DATABASE STATS:
    - Total menu items indexed: ${menuStats.totalItems}
    - Restaurants in database: ${menuStats.totalRestaurants}
    - Category breakdown: ${JSON.stringify(menuStats.categoryCounts)}

    RELEVANT RESTAURANTS WITH FULL MENU DATA:
    ${JSON.stringify(relevantRestaurants.map((r: RestaurantData) => {
      const menuItems = menuIndexingService.getRestaurantMenu(r.name);
      const popularItems = menuItems.slice(0, 5).map(item => ({
        name: item.name,
        category: item.category,
        price: item.price
      }));
      
      return {
        name: r.name,
        cuisine: r.cuisine,
        priceRange: r.priceRange,
        location: r.location,
        popularFor: r.popularFor,
        dietaryOptions: r.dietaryOptions,
        ratings: r.ratings || 0,
        totalMenuItems: menuItems.length,
        popularItems: popularItems
      };
    }), null, 2)}

    USER PREFERENCES: ${JSON.stringify(preferences)}

    CRITICAL INSTRUCTIONS:
    1. Return ONLY raw JSON - NO markdown code blocks, NO backticks, NO json wrapper
    2. Write UNIQUE, VARIED reasons in natural, conversational 2-3 sentences (like a friend recommending)
    3. Each restaurant should have DIFFERENT opening words and phrasing - be creative and diverse
    4. Include: restaurant atmosphere/vibe, 2-3 specific menu items with prices, and budget fit
    5. Ensure dietary restrictions are strictly met
    6. Make it personal, warm, and informative
    7. Return 3-5 restaurant matches maximum
    8. VARY your sentence structure - don't start every reason the same way

    RESPONSE FORMAT (raw JSON only):
    {
      "matches": [
        {
          "name": "Restaurant Name",
          "meals": <group size>,
          "price": <user's total budget>,
          "image": "image path",
          "reason": "Natural conversational recommendation with varied opening"
        }
      ]
    }
    
    VARIETY EXAMPLES (use different styles for each restaurant):
    Style 1: "Perfect for vegan lovers, this cozy Filipino cafe serves up authentic plant-based comfort food. Their Tofu Sisig (PHP 120) and Mushroom Adobo (PHP 150) are must-tries, and your PHP 9,000 gets you 24 amazing dishes!"
    Style 2: "You'll love the warm atmosphere at this family-run spot known for their creative vegetarian twists on classic dishes. Don't miss the Vegetable Lumpia (PHP 85) and Pinakbet (PHP 110) - great value with 27 items for your budget."
    Style 3: "Looking for authentic vegan Filipino food? This hidden gem delivers with their famous plant-based menu. Try their signature Laing (PHP 95) and Ginataang Sitaw (PHP 105), covering 30 delicious items within your PHP 9,000."
    
    IMPORTANT: Each restaurant's reason should START DIFFERENTLY and use UNIQUE phrasing!

    IMPORTANT: Your response must start with { and end with } - no other text before or after.
    `;

    try {
      // Call Gemini API with timeout and generation config
      const generationConfig = {
        temperature: 0.9, // Higher for more creative, varied responses
        topP: 0.95, // Broader sampling for diversity
        topK: 40,
        maxOutputTokens: 2048, // Limit response size for faster generation
      };
      
      const result = await Promise.race([
        model.generateContent({
          contents: [{ role: "user", parts: [{ text: enhancedPrompt }] }],
          generationConfig
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Gemini API timeout after 15s')), 15000)
        )
      ]) as any;
      
      const response = await result.response;
      const textResponse = response.text();
      
      // Only log in development
      if (process.env.NODE_ENV === 'development') {
        console.log("Gemini Raw Response:", textResponse.substring(0, 200) + "..."); // Truncated log
      }

      // Use robust JSON parser with multiple recovery strategies
      const parseResult = RobustFoodJsonParser.parseResponse(textResponse);
      let recommendations: { matches: EnhancedResultMatch[] };

      if (parseResult.success && parseResult.data) {
        recommendations = parseResult.data;
        console.log('✅ Gemini AI successfully generated recommendations');
        
        // Validate and enhance the response
        if (recommendations.matches && Array.isArray(recommendations.matches)) {
          recommendations.matches = validateAndEnhanceRecommendations(recommendations.matches, foodData, preferences);
        }
      } else {
        console.warn('⚠️ JSON parsing failed, using intelligent fallback recommendations');
        recommendations = createIntelligentRecommendations(foodData, prompt, preferences);
      }
      
      // Enhance each match with comprehensive menu data and smart suggestions
      if (recommendations && recommendations.matches && Array.isArray(recommendations.matches)) {
        recommendations.matches = recommendations.matches.map((match: EnhancedResultMatch) => {
          const restaurant = foodData.restaurants.find((r: RestaurantData) => r.name === match.name);
          if (restaurant) {
            // Get recommended menu items using smart algorithms
            const menuItems = menuIndexingService.getRestaurantMenu(restaurant.name);
            const allocation = budgetAllocator.allocateBudget(
              menuItems,
              match.price,
              preferences.pax || 2,
              preferences
            );

            // Enhance AI reasoning with specific allocation details (keep conversational)
            const topItems = allocation.selectedItems.slice(0, 3);
            const utilizationPercent = Math.round(allocation.utilizationRate);
            
            // Ensure match.reason exists with fallback
            const baseReason = match.reason || `Great ${restaurant.cuisine?.[0] || 'dining'} option for your group!`;
            
            // Only enhance if AI response seems incomplete (check if it already has budget info)
            const hasBudgetInfo = baseReason.toLowerCase().includes('budget') || baseReason.toLowerCase().includes('php');
            const hasItemCount = /\d+\s+(item|dish|option)/.test(baseReason);
            
            let enhancedReason = baseReason;
            
            // Add natural language enhancement if missing key info
            if (!hasBudgetInfo && allocation.selectedItems.length > 0) {
              enhancedReason += ` Plus, we've handpicked ${allocation.selectedItems.length} items that use ${utilizationPercent}% of your budget perfectly!`;
            } else if (!hasItemCount && topItems.length > 0) {
              const itemsList = topItems.map(i => i.name).join(', ');
              enhancedReason += ` Don't miss their ${itemsList}!`;
            }

            return {
              ...match,
              reason: enhancedReason,
              fullMenu: restaurant.fullMenu,
              recommendedMenuItems: allocation.selectedItems.slice(0, 8),
              budgetAllocation: {
                totalCost: allocation.totalCost,
                remainingBudget: allocation.remainingBudget,
                utilizationRate: allocation.utilizationRate,
                recommendations: allocation.recommendations
              }
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
      
      // Use intelligent recommendations on API failure
      console.log('⚠️ API error, falling back to intelligent recommendations');
      const intelligentRecommendations = createIntelligentRecommendations(foodData, prompt, preferences);
      return NextResponse.json(intelligentRecommendations);
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

// Intelligent recommendations using recommendation engine
function createIntelligentRecommendations(foodData: any, prompt: string, preferences: any): { matches: EnhancedResultMatch[] } {
  console.log('🧠 Using intelligent recommendation engine...');
  
  // Use recommendation engine for advanced scoring
  const recommendations = recommendationEngine.generateRecommendations(
    foodData.restaurants,
    preferences,
    5 // Top 5 recommendations
  );
  
  const matches: EnhancedResultMatch[] = recommendations.map(rec => {
    const userBudget = preferences.budget ? parseInt(preferences.budget.replace(/[^\d]/g, '')) : null;
    const finalPrice = userBudget || rec.estimatedTotal;

    // Get smart budget allocation for recommended items
    const allocation = budgetAllocator.allocateBudget(
      rec.recommendedItems,
      finalPrice,
      preferences.pax || 2,
      preferences
    );

    // Build conversational, human-friendly reasoning with VARIETY
    const topItems = allocation.selectedItems.slice(0, 3);
    const itemsList = topItems.length > 0 
      ? topItems.map(item => `${item.name} (PHP ${item.price})`).join(' and ')
      : 'delicious options';
    const utilizationPercent = Math.round(allocation.utilizationRate);
    
    // Get restaurant type/atmosphere
    const cuisineType = rec.restaurant.cuisine?.[0] || 'dining spot';
    const atmosphere = rec.restaurant.popularFor?.includes('cozy') ? 'cozy' 
      : rec.restaurant.popularFor?.includes('modern') ? 'modern'
      : rec.restaurant.popularFor?.includes('family') ? 'family-friendly'
      : 'welcoming';
    
    // Generate varied opening sentences (rotate through patterns)
    const restaurantIndex = recommendations.indexOf(rec);
    const openingTemplates = [
      `Perfect for ${rec.matchReasons[0]?.toLowerCase() || 'your group'}, this ${atmosphere} ${cuisineType} spot delivers authentic flavors.`,
      `You'll love this ${atmosphere} ${cuisineType} restaurant - it's ideal for ${rec.matchReasons[0]?.toLowerCase() || 'your group'}.`,
      `Looking for ${rec.matchReasons[0]?.toLowerCase() || 'great food'}? This ${atmosphere} ${cuisineType} gem is the answer.`,
      `This ${atmosphere} ${cuisineType} favorite is known for being perfect for ${rec.matchReasons[0]?.toLowerCase() || 'your group'}.`,
      `Craving ${cuisineType} food? This ${atmosphere} spot specializes in ${rec.matchReasons[0]?.toLowerCase() || 'delicious meals'}.`
    ];
    
    const dishTemplates = topItems.length > 0 ? [
      `Don't miss their ${itemsList} - all highly recommended!`,
      `Try their signature ${itemsList} for an amazing experience.`,
      `Their ${itemsList} are must-tries that won't disappoint.`,
      `Make sure to order ${itemsList} - customer favorites!`,
      `The ${itemsList} are absolutely worth trying.`
    ] : [`They offer great options that match what you're looking for.`];
    
    const budgetTemplates = [
      `Your PHP ${finalPrice.toLocaleString()} covers ${allocation.selectedItems.length} delicious items with ${utilizationPercent}% excellent value!`,
      `With your PHP ${finalPrice.toLocaleString()} budget, you'll get ${allocation.selectedItems.length} tasty dishes (${utilizationPercent}% great value).`,
      `Your PHP ${finalPrice.toLocaleString()} gets you ${allocation.selectedItems.length} amazing items - ${utilizationPercent}% of budget well spent!`,
      `Enjoy ${allocation.selectedItems.length} delicious choices for PHP ${finalPrice.toLocaleString()} (${utilizationPercent}% budget optimization).`
    ];
    
    // Select templates based on index to ensure variety
    const sentence1 = openingTemplates[restaurantIndex % openingTemplates.length];
    const sentence2 = dishTemplates[restaurantIndex % dishTemplates.length];
    const sentence3 = budgetTemplates[restaurantIndex % budgetTemplates.length];
    
    const detailedReason = `${sentence1} ${sentence2} ${sentence3}`;

    return {
      name: rec.restaurant.name,
      meals: preferences.pax || 2,
      price: finalPrice,
      image: rec.restaurant.image,
      reason: detailedReason,
      fullMenu: rec.restaurant.fullMenu,
      recommendedMenuItems: allocation.selectedItems.slice(0, 8), // Top 8 suggested items
      budgetAllocation: {
        totalCost: allocation.totalCost,
        remainingBudget: allocation.remainingBudget,
        utilizationRate: allocation.utilizationRate,
        recommendations: allocation.recommendations
      },
      matchScore: rec.score
    };
  });
  
  console.log(`✅ Generated ${matches.length} intelligent recommendations`);
  return { matches };
}

// Legacy fallback for compatibility
function createFallbackRecommendations(foodData: any, prompt: string): { matches: EnhancedResultMatch[] } {
  const preferences = parseUserPreferences(prompt);
  return createIntelligentRecommendations(foodData, prompt, preferences);
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
      reasons.push(`Fits PHP ${preferences.budget} budget`);
    }
  }
  
  if (restaurant.ratings >= 4.0) {
    reasons.push(`${restaurant.ratings} star rated`);
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