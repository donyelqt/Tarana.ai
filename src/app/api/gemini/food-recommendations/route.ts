import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { z } from "zod";
import { CreditService, InsufficientCreditsError } from "@/lib/referral-system";
import { FullMenu, RestaurantData } from "@/app/tarana-eats/data/taranaEatsData";
import { restaurants as serverRestaurants } from "@/app/tarana-eats/data/restaurants";
import { ResultMatch } from "@/types/tarana-eats";
import { RobustFoodJsonParser } from "@/lib/robustFoodJsonParser";
import { FoodRecommendationErrorHandler, FoodErrorType } from "@/lib/foodRecommendationErrorHandler";
import { recommendationEngine } from "@/app/tarana-eats/services/recommendationEngine";
import { menuIndexingService } from "@/app/tarana-eats/services/menuIndexingService";
import { budgetAllocator } from "@/app/tarana-eats/services/budgetAllocator";
import { withRetry } from "@/lib/upstream/withRetry";
import { timedHttp } from "@/lib/observability/httpMetrics";
import { logger } from "@/lib/observability/logger";
import { getRequestId } from "@/middleware/requestId";
import {
  claimIdempotency,
  completeIdempotency,
  getIdempotencyKey,
  hashIdempotencyPayload,
  type IdempotencyClaim,
} from "@/lib/services/idempotencyService";
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

// Use environment variable or fall back to valid Gemini model
const DEFAULT_MODEL_ID = "gemini-2.5-flash"; // Valid Gemini model
const configuredModelId = process.env.GOOGLE_GEMINI_MODEL?.trim();
const MODEL_ID = configuredModelId && configuredModelId.length > 0 ? configuredModelId : DEFAULT_MODEL_ID;

const LOG_ENTRY_POINT = "food-recommendations";
const IDEMPOTENCY_ROUTE = '/api/gemini/food-recommendations';

if (!configuredModelId && API_KEY) {
  logger.info(`[Food Recommendations] Using Gemini model: ${DEFAULT_MODEL_ID}`, { entryPoint: LOG_ENTRY_POINT, model: DEFAULT_MODEL_ID });
}

const geminiModel = genAI ? genAI.getGenerativeModel({ 
  model: MODEL_ID,
  generationConfig: {
    temperature: 0.8,
    topP: 0.9,
    topK: 40,
    maxOutputTokens: 8192,
  },
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
  ],
}) : null;

// Optimized caching system. Keys are user-scoped: without the userId a
// second user with the same prompt would be served the first user phrasing.
// Both maps are LRU-capped so 30-minute TTL entries cannot accumulate per
// instance without bound.
const CACHE_MAX_ENTRIES = 200;
const responseCache = new Map<string, { response: any; timestamp: number }>();
const preprocessingCache = new Map<string, any>();
function cacheSet<K, V>(map: Map<K, V>, key: K, value: V): void {
  if (map.has(key)) map.delete(key);
  map.set(key, value);
  while (map.size > CACHE_MAX_ENTRIES) {
    const oldest = map.keys().next();
    if (oldest.done) break;
    map.delete(oldest.value);
  }
}
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes for better cache utilization
const DEFAULT_PLACEHOLDER_IMAGE = "/images/placeholders/hero-placeholder.svg";
const MIN_RECOMMENDATIONS = 3;
const MAX_RECOMMENDATIONS = 5;

// Bounded input contract (Gala parity): prompt length, typed client
// preferences, and a bounded foodData envelope. Raw regex parsing below
// must never see unbounded text.
const eatsRequestSchema = z.object({
  prompt: z.string().min(1).max(5000),
  foodData: z.object({
    restaurants: z.array(z.unknown()).max(200).optional(),
  }).passthrough().optional(),
  preferences: z.object({
    pax: z.union([z.string().max(50), z.number().int().positive()]).optional(),
    budget: z.string().max(100).optional(),
    cuisine: z.string().max(100).optional(),
    restrictions: z.array(z.string().max(100)).max(25).optional(),
    mealType: z.array(z.string().max(100)).max(25).optional(),
  }).passthrough().optional(),
}).passthrough();

// Model reason strings render as UI text. Strip URLs, @-handles, and
// instruction-shaped lines so smuggled directives never reach the card.
function sanitizeReasonText(reason: string): string {
  if (typeof reason !== "string") return "";
  return reason
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0
      && !/https?:\/\//i.test(line)
      && !/www\./i.test(line)
      && !/^\s*[@#]/.test(line)
      && !/\b(ignore|disregard|forget|override|system|instruction|prompt)\b/i.test(line))
    .join(" ")
    .slice(0, 500);
}

// Trust boundary: the client ships a foodData catalog, but grounding must
// never certify names against that same client list. Cross-check every
// client restaurant name against the server registry; unknown names are
// dropped before indexing, relevance, and grounding ever see them.
function serverKnownRestaurants(clientRestaurants: unknown): RestaurantData[] {
  if (!Array.isArray(clientRestaurants)) return [...serverRestaurants];
  const known = new Set(serverRestaurants.map((r) => normalizeRestaurantName(r.name)));
  const kept = (clientRestaurants as Array<{ name?: unknown }>).filter((r) =>
    typeof r?.name === "string" && known.has(normalizeRestaurantName(r.name)));
  return kept.length > 0 ? (kept as unknown as RestaurantData[]) : [...serverRestaurants];
}

export const POST = withAuth(async (req: NextRequest, userId: string) => {
  const requestId = getRequestId(req);
  return timedHttp('/api/gemini/food-recommendations', 'POST', async () => {
  let claim: IdempotencyClaim | null = null;
  const completeClaim = async (status: number, body: unknown): Promise<void> => {
    const rowId = claim?.kind === 'owner' ? claim.rowId : null;
    if (rowId === null) return;
    try {
      await completeIdempotency(rowId, status, body);
    } catch (error) {
      logger.error('[idempotency] failed to complete key', {
        entryPoint: LOG_ENTRY_POINT,
        route: IDEMPOTENCY_ROUTE,
        rowId,
        errorName: error instanceof Error ? error.name : typeof error,
      }, requestId);
      throw error;
    }
  };
  try {
    // Hard 32KB body cap (Gala parity): the route interpolates the whole
    // foodData catalog into the model prompt, so an unbounded req.json()
    // lets any client push multi-MB payloads through parsing + indexing
    // compute before any charge decision. Reject loud with 413.
    const contentLength = Number(req.headers.get('content-length') ?? 0);
    if (contentLength > 32 * 1024) {
      return NextResponse.json(
        { error: "Request body too large" },
        { status: 413 }
      );
    }

    const requestBody = await req.json();
    const { prompt, foodData: clientFoodData, preferences: clientPreferences } = requestBody;
    const foodData = { ...((clientFoodData as Record<string, unknown> | undefined) ?? {}), restaurants: serverKnownRestaurants((clientFoodData as { restaurants?: unknown } | undefined)?.restaurants) };

    // Input validation
    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }
    const parsed = eatsRequestSchema.safeParse(requestBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload" },
        { status: 400 }
      );
    }
    const key = getIdempotencyKey(req);
    claim = key
      ? await claimIdempotency(userId, IDEMPOTENCY_ROUTE, key, hashIdempotencyPayload(requestBody))
      : null;

    if (claim?.kind === 'replay') {
      return NextResponse.json(claim.replay.body, { status: claim.replay.status });
    }

    if (claim?.kind === 'conflict') {
      const response = NextResponse.json(
        { error: 'Request is already being processed' },
        { status: 409 }
      );
      response.headers.set('Retry-After', '1');
      return response;
    }

    if (claim?.kind === 'payload-mismatch') {
      return NextResponse.json(
        { error: 'Idempotency key was already used with a different payload' },
        { status: 422 }
      );
    }
    // ✅ CREDIT SYSTEM: Charge first, atomically (H1-Eats). consumeCredits
    // throws InsufficientCreditsError when the balance cannot cover the
    // request, so no separate balance pre-check is needed — the pre-check
    // raced the charge (check-then-act) and the charge must not be skipped.
    // Fail-closed: a charge failure refuses service; the route never serves
    // output it could not bill for. Validation runs before the charge so a
    // malformed request never bills.
    //
    // Per-attempt refund identity: stable within this invocation (so
    // overlapping refund calls dedupe) but unique across retries (so a
    // retried request's legitimate second refund is never swallowed).
    const attemptId = randomUUID();
    let charged = false;
    try {
      await CreditService.consumeCredits({
        userId,
        amount: 1,
        service: 'tarana_eats',
        description: `Food recommendation: ${prompt?.substring(0, 50) || 'Food search'}`,
      });
    } catch (creditError) {
      if (creditError instanceof InsufficientCreditsError) {
        const responseBody = {
          error: 'Insufficient credits',
          required: 1,
          available: creditError.available,
        };
        await completeClaim(402, responseBody);
        return NextResponse.json(responseBody, { status: 402 });
      }
      throw creditError;
    }
    charged = true;

    // Parse preferences from prompt first
    const preferences = parseUserPreferences(prompt, requestId);
    
    // CRITICAL: Override with client preferences if provided (handles form data directly)
    if (clientPreferences) {
      if (clientPreferences.pax !== null && clientPreferences.pax !== undefined) {
        preferences.pax = clientPreferences.pax;
      }
      if (clientPreferences.budget) {
        preferences.budget = clientPreferences.budget;
      }
      if (clientPreferences.cuisine) {
        preferences.cuisine = clientPreferences.cuisine;
      }
      if (clientPreferences.restrictions) {
        preferences.restrictions = clientPreferences.restrictions;
      }
    }
    
    // DEBUG: Log all parsed preferences
    logger.info("📊 Parsed user preferences:", {
      entryPoint: LOG_ENTRY_POINT,
      pax: preferences.pax,
      budget: preferences.budget,
      cuisine: preferences.cuisine,
      restrictions: preferences.restrictions
    }, requestId);

    // Initialize menu indexing service with restaurant data
    if (foodData?.restaurants && foodData.restaurants.length > 0) {
      try {
        menuIndexingService.indexRestaurants(foodData.restaurants);
        logger.info('✅ Menu indexing initialized', { entryPoint: LOG_ENTRY_POINT }, requestId);
      } catch (indexError) {
        logger.warn('⚠️ Menu indexing failed, continuing without index:', {
          entryPoint: LOG_ENTRY_POINT,
          errorName: indexError instanceof Error ? indexError.name : typeof indexError
        }, requestId);
      }
    }

    // Check and log API key presence
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY || "";
    if (!apiKey) {
      logger.warn("⚠️ GOOGLE_GEMINI_API_KEY is missing! Using intelligent fallback with recommendation engine.", { entryPoint: LOG_ENTRY_POINT }, requestId);
      
      // Use intelligent recommendation engine instead of basic fallback
      const intelligentRecommendations = createIntelligentRecommendations(foodData, prompt, preferences, requestId);
      await completeClaim(200, intelligentRecommendations);
      return NextResponse.json(intelligentRecommendations);
    }
    
    logger.info("✓ Gemini AI enabled - generating personalized recommendations...", { entryPoint: LOG_ENTRY_POINT }, requestId);
    
    // Generate optimized cache key
    const cacheKey = JSON.stringify({
      user: userId,
      prompt: prompt?.substring(0, 30), // Further reduced for better hit rates
      budget: preferences.budget ? Math.floor(parseInt(preferences.budget) / 100) * 100 : null, // Round to nearest 100
      cuisine: preferences.cuisine,
      pax: preferences.pax || 2
    });
    
    // Check cache for recent similar requests
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      await completeClaim(200, cached.response);
      return NextResponse.json(cached.response);
    }
    const preprocessingKey = `${userId}:${preferences.cuisine || 'all'}-${preferences.budget || 'all'}-${preferences.pax || 2}`;
    let relevantRestaurants = preprocessingCache.get(preprocessingKey);
    if (!relevantRestaurants) {
      relevantRestaurants = getRelevantRestaurants(foodData.restaurants, preferences);
      cacheSet(preprocessingCache, preprocessingKey, relevantRestaurants);
    }

    // Re-use the globally initialised model
    const model = geminiModel;
    if (!model) {
      logger.error("Gemini model is not initialized – missing API key?", { entryPoint: LOG_ENTRY_POINT }, requestId);
      // Create a fallback response
      const fallbackRecommendations = createFallbackRecommendations(foodData, prompt, requestId);
      await completeClaim(200, fallbackRecommendations);
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

    RELEVANT RESTAURANTS (Top ${Math.min(relevantRestaurants.length, 15)}):
    ${JSON.stringify(relevantRestaurants.slice(0, 15).map((r: RestaurantData) => {
      const menuItems = menuIndexingService.getRestaurantMenu(r.name);
      const popularItems = menuItems.slice(0, 3).map(item => ({
        name: item.name,
        price: item.price
      }));
      
      return {
        name: r.name,
        cuisine: r.cuisine?.[0] || 'Filipino',
        priceRange: r.priceRange,
        location: r.location,
        popularFor: r.popularFor?.[0] || 'dining',
        dietaryOptions: r.dietaryOptions,
        ratings: r.ratings || 4.0,
        totalMenuItems: menuItems.length,
        topItems: popularItems
      };
    }))}

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
      // Retry Gemini API calls with exponential backoff + timeout per attempt.
      // maxAttempts=2: one initial call + one retry (matching the previous
      // maxRetries=2 behavior). 30s timeout per attempt. 1s fixed delay
      // between retries via jitter:'none'.
      const result = await withRetry(() => model.generateContent(enhancedPrompt), {
        maxAttempts: 2,
        baseDelayMs: 1000,
        factor: 2,
        maxDelayMs: 5000,
        jitter: 'none',
        timeoutMs: 30000,
        upstream: 'gemini-food-recommendations',
      });

      const response = await result.response;
      
      // Debug: Check prompt feedback and safety ratings
      if (response.promptFeedback) {
        logger.warn(`⚠️ Prompt Feedback:`, {
          entryPoint: LOG_ENTRY_POINT,
          promptFeedback: response.promptFeedback
        }, requestId);
        if (response.promptFeedback.blockReason) {
          logger.error(`❌ Content blocked by Gemini. Reason: ${response.promptFeedback.blockReason}`, {
            entryPoint: LOG_ENTRY_POINT,
            blockReason: response.promptFeedback.blockReason
          }, requestId);
          throw new Error(`Gemini blocked content: ${response.promptFeedback.blockReason}`);
        }
      }
      
      // Check if candidates exist
      if (!response.candidates || response.candidates.length === 0) {
        logger.error(`❌ No candidates in Gemini response`, { entryPoint: LOG_ENTRY_POINT }, requestId);
        logger.info(`Gemini response candidates omitted`, { entryPoint: LOG_ENTRY_POINT, candidateCount: 0 }, requestId);
        throw new Error('No candidates in Gemini response');
      }
      
      const textResponse = response.text();
      
      logger.info(`📊 Gemini response length: ${textResponse?.length || 0} characters`, {
        entryPoint: LOG_ENTRY_POINT,
        responseLength: textResponse?.length || 0
      }, requestId);
      
      // Check if response is empty or invalid
      if (!textResponse || textResponse.trim().length < 10) {
        logger.error(`❌ Gemini returned empty/invalid response (length: ${textResponse?.length || 0})`, {
          entryPoint: LOG_ENTRY_POINT,
          responseLength: textResponse?.length || 0
        }, requestId);
        logger.info(`Candidate finish reason:`, { entryPoint: LOG_ENTRY_POINT, finishReason: response.candidates[0]?.finishReason }, requestId);
        logger.info(`Candidate safety ratings:`, { entryPoint: LOG_ENTRY_POINT, safetyRatings: response.candidates[0]?.safetyRatings }, requestId);
        throw new Error('Empty Gemini response');
      }
      
      logger.info(`✅ Gemini returned valid response`, { entryPoint: LOG_ENTRY_POINT, responseLength: textResponse.length }, requestId);

      // Use robust JSON parser with multiple recovery strategies
      const parseResult = RobustFoodJsonParser.parseResponse(textResponse);
      let recommendations: { matches: EnhancedResultMatch[] };

      if (parseResult.success && parseResult.data && parseResult.data.matches && parseResult.data.matches.length > 0) {
        recommendations = parseResult.data;
        logger.info(`✅ Gemini AI successfully generated ${recommendations.matches.length} recommendations`, {
          entryPoint: LOG_ENTRY_POINT,
          recommendationCount: recommendations.matches.length
        }, requestId);
        
        // Validate and enhance the response
        if (recommendations.matches && Array.isArray(recommendations.matches)) {
          recommendations.matches = validateAndEnhanceRecommendations(
            recommendations.matches,
            foodData,
            preferences,
            prompt,
            requestId
          );
        }
      } else {
        logger.warn('⚠️ JSON parsing failed or no matches found, using intelligent fallback recommendations', { entryPoint: LOG_ENTRY_POINT }, requestId);
        throw new Error('Invalid parse result');
      }
      
      // Enhance each match with comprehensive menu data and smart suggestions
      // Cache the response
      cacheSet(responseCache, cacheKey, {
        response: recommendations,
        timestamp: Date.now()
      });

      await completeClaim(200, recommendations);
      return NextResponse.json(recommendations);

    } catch (apiError) {
      // Charged up front (H1-Eats): a generation we cannot deliver must be
      // refunded. The free-fallback path is gone — serving unbilled output
      // is exactly the leak this refactor closes. refundCredits never throws
      // (returns false on no-op), so the original failure still surfaces.
      if (charged) {
        await CreditService.refundCredits({
          userId,
          amount: 1,
          service: 'tarana_eats',
          description: `Refund: failed food recommendation for ${userId}`,
          idempotencyKey: `refund:eats:${attemptId}`,
        });
      }

      const foodError = FoodRecommendationErrorHandler.createError(apiError, 'gemini_api_call');
      logger.error('Food recommendation generation failed', {
        entryPoint: LOG_ENTRY_POINT,
        errorType: foodError.type,
        retryable: foodError.retryable
      }, requestId);
      const errorResponse = FoodRecommendationErrorHandler.createErrorResponse(foodError);
      await completeClaim(500, errorResponse);
      return NextResponse.json(errorResponse, { status: 500 });
    }
  } catch (error) {
    const foodError = FoodRecommendationErrorHandler.createError(error, 'food_recommendations_api');
    logger.error('Food recommendation request failed', {
      entryPoint: LOG_ENTRY_POINT,
      errorType: foodError.type,
      retryable: foodError.retryable
    }, requestId);

    const errorResponse = FoodRecommendationErrorHandler.createErrorResponse(foodError);
    await completeClaim(500, errorResponse);
    return NextResponse.json(errorResponse, { status: 500 });
  }
  }, (res) => res.status);
});

// Validation and enhancement helper
function validateAndEnhanceRecommendations(
  matches: EnhancedResultMatch[],
  foodData: any,
  preferences: any,
  prompt: string,
  requestId: string
): EnhancedResultMatch[] {
  if (!foodData?.restaurants || foodData.restaurants.length === 0) {
    return matches;
  }

  const restaurantLookup = buildRestaurantLookup(foodData.restaurants);
  const seenRestaurants = new Set<string>();
  const groundedMatches: EnhancedResultMatch[] = [];

  for (const match of matches) {
    const restaurant = findRestaurantByNormalizedName(restaurantLookup, match.name);
    if (!restaurant) {
      logger.warn(`⚠️ Skipping hallucinated restaurant from AI response: "${match.name}"`, {
        entryPoint: LOG_ENTRY_POINT,
        restaurantName: match.name
      }, requestId);
      continue;
    }

    const normalizedName = normalizeRestaurantName(restaurant.name);
    if (seenRestaurants.has(normalizedName)) {
      logger.info(`ℹ️ Ignoring duplicate recommendation for: ${restaurant.name}`, {
        entryPoint: LOG_ENTRY_POINT,
        restaurantName: restaurant.name
      }, requestId);
      continue;
    }

    groundedMatches.push(hydrateMatchFromRestaurant(match, restaurant, preferences));
    seenRestaurants.add(normalizedName);
    if (groundedMatches.length >= MAX_RECOMMENDATIONS) {
      break;
    }
  }

  if (groundedMatches.length < MIN_RECOMMENDATIONS) {
    logger.info(`⚠️ Only ${groundedMatches.length} grounded matches. Supplementing with retrieval engine.`, {
      entryPoint: LOG_ENTRY_POINT,
      groundedMatchCount: groundedMatches.length
    }, requestId);
    const fallbackMatches = createIntelligentRecommendations(foodData, prompt, preferences, requestId).matches;

    for (const fallbackMatch of fallbackMatches) {
      const fallbackRestaurant = findRestaurantByNormalizedName(restaurantLookup, fallbackMatch.name);
      if (!fallbackRestaurant) {
        continue;
      }
      const normalizedName = normalizeRestaurantName(fallbackRestaurant.name);
      if (seenRestaurants.has(normalizedName)) {
        continue;
      }

      groundedMatches.push(hydrateMatchFromRestaurant(fallbackMatch, fallbackRestaurant, preferences));
      seenRestaurants.add(normalizedName);

      if (groundedMatches.length >= MIN_RECOMMENDATIONS) {
        break;
      }
    }
  }

  if (groundedMatches.length === 0) {
    logger.error('❌ No valid recommendations after grounding. Falling back entirely to deterministic engine.', { entryPoint: LOG_ENTRY_POINT }, requestId);
    return createIntelligentRecommendations(foodData, prompt, preferences, requestId).matches.slice(0, MAX_RECOMMENDATIONS);
  }

  return groundedMatches.slice(0, MAX_RECOMMENDATIONS);
}

function hydrateMatchFromRestaurant(
  match: EnhancedResultMatch,
  restaurant: RestaurantData,
  preferences: any
): EnhancedResultMatch {
  if (typeof match.reason === "string") match.reason = sanitizeReasonText(match.reason);
  const meals = preferences?.pax || match.meals || 2;

  let finalPrice = Number(match.price) || 0;
  const userBudget = typeof preferences?.budget === 'string'
    ? parseInt(preferences.budget.replace(/[^\d]/g, ''), 10)
    : Number(preferences?.budget) || 0;

  if (userBudget && userBudget > 0) {
    finalPrice = userBudget;
  }

  if (!finalPrice || finalPrice <= 0) {
    const minPrice = restaurant.priceRange?.min || 0;
    const maxPrice = restaurant.priceRange?.max || 0;
    const avgPrice = maxPrice > 0 ? (minPrice + maxPrice) / 2 : minPrice;
    const fallbackPerPerson = avgPrice > 0 ? avgPrice : maxPrice || 300;
    finalPrice = Math.max(100, Math.round(fallbackPerPerson * meals));
  }

  const menuItems = menuIndexingService.getRestaurantMenu(restaurant.name);
  const allocation = menuItems.length > 0 && finalPrice > 0
    ? budgetAllocator.allocateBudget(menuItems, finalPrice, meals, preferences)
    : {
        selectedItems: [] as any[],
        totalCost: 0,
        remainingBudget: finalPrice,
        utilizationRate: 0,
        recommendations: [] as string[]
      };

  const topItems = allocation.selectedItems.slice(0, 3);
  const utilizationPercent = Math.round(allocation.utilizationRate || 0);
  const baseReason = match.reason || `Great ${restaurant.cuisine?.[0] || 'dining'} option for your group!`;
  const hasBudgetInfo = baseReason.toLowerCase().includes('budget') || baseReason.toLowerCase().includes('php');
  const hasItemInfo = /\b(item|dish|option)s?\b/i.test(baseReason);

  let enhancedReason = baseReason;
  if (!hasBudgetInfo && allocation.selectedItems.length > 0) {
    enhancedReason += ` Plus, we've curated ${allocation.selectedItems.length} picks that use ${utilizationPercent}% of your budget.`;
  } else if (!hasItemInfo && topItems.length > 0) {
    const itemsList = topItems.map(item => item.name).join(', ');
    enhancedReason += ` Be sure to try ${itemsList}.`;
  }

  const restaurantImage = restaurant.image && restaurant.image.trim().length > 0
    ? restaurant.image
    : match.image && match.image.trim().length > 0
      ? match.image
      : DEFAULT_PLACEHOLDER_IMAGE;

  return {
    ...match,
    name: restaurant.name,
    meals,
    price: finalPrice,
    image: restaurantImage,
    fullMenu: restaurant.fullMenu,
    recommendedMenuItems: allocation.selectedItems.slice(0, 8),
    budgetAllocation: {
      totalCost: allocation.totalCost,
      remainingBudget: allocation.remainingBudget,
      utilizationRate: allocation.utilizationRate,
      recommendations: allocation.recommendations
    },
    reason: enhancedReason
  };
}

function buildRestaurantLookup(restaurants: RestaurantData[]): Map<string, RestaurantData> {
  const lookup = new Map<string, RestaurantData>();
  restaurants.forEach(restaurant => {
    const normalized = normalizeRestaurantName(restaurant.name);
    if (!lookup.has(normalized)) {
      lookup.set(normalized, restaurant);
    }
  });
  return lookup;
}

function findRestaurantByNormalizedName(
  lookup: Map<string, RestaurantData>,
  name: string
): RestaurantData | undefined {
  if (!name) return undefined;
  const normalized = normalizeRestaurantName(name);
  return lookup.get(normalized);
}

function normalizeRestaurantName(name: string): string {
  return name
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Intelligent recommendations using recommendation engine
function createIntelligentRecommendations(foodData: any, prompt: string, preferences: any, requestId: string): { matches: EnhancedResultMatch[] } {
  logger.info('🧠 Using intelligent recommendation engine...', { entryPoint: LOG_ENTRY_POINT }, requestId);
  logger.info('🎯 Generating intelligent recommendations...', { entryPoint: LOG_ENTRY_POINT }, requestId);
  
  // Use recommendation engine for advanced scoring
  const recommendations = recommendationEngine.generateRecommendations(
    foodData.restaurants,
    preferences,
    5 // Top 5 recommendations
  );
  
  logger.info(`✅ Generated ${recommendations.length} recommendations`, {
    entryPoint: LOG_ENTRY_POINT,
    recommendationCount: recommendations.length
  }, requestId);
  
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
  
  logger.info(`✅ Generated ${matches.length} intelligent recommendations`, {
    entryPoint: LOG_ENTRY_POINT,
    recommendationCount: matches.length
  }, requestId);
  return { matches };
}

// Legacy fallback for compatibility
function createFallbackRecommendations(foodData: any, prompt: string, requestId: string): { matches: EnhancedResultMatch[] } {
  const preferences = parseUserPreferences(prompt, requestId);
  return createIntelligentRecommendations(foodData, prompt, preferences, requestId);
}

// Parse user preferences from prompt
function parseUserPreferences(prompt: string, requestId: string): any {
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
  
  // Extract pax/group size (handles "6 people", "6+ people", "6 pax", etc.)
  const paxMatch = prompt.match(/(\d+)\+?\s*(?:people?|pax)/i);
  if (paxMatch) {
    preferences.pax = parseInt(paxMatch[1]);
  }
  
  // DEBUG: Log parsed pax value
  if (preferences.pax) {
    logger.info(`✓ Parsed group size: ${preferences.pax} people from prompt`, {
      entryPoint: LOG_ENTRY_POINT,
      pax: preferences.pax
    }, requestId);
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
function calculateRecommendedPrice(restaurant: any, groupSize: number, userBudget?: string, requestId?: string): number {
  // If user provided a budget, use that as the total budget for the group
  if (userBudget) {
    const budgetNum = parseInt(userBudget.replace(/[^\d]/g, ''));
    if (budgetNum && budgetNum > 0) {
      // DEBUG LOGGING - Remove after fixing
      logger.info("🔍 API ROUTE DEBUG - Using User Budget:", {
        entryPoint: LOG_ENTRY_POINT,
        restaurantName: restaurant.name,
        userBudgetInput: userBudget,
        extractedBudgetNum: budgetNum,
        groupSize: groupSize,
        finalPrice: budgetNum
      }, requestId);
      return budgetNum; // Return user's budget as total budget for entire group
    }
  }
  
  // Fallback: use restaurant's average price × group size
  const avgPrice = (restaurant.priceRange.min + restaurant.priceRange.max) / 2;
  const fallbackPrice = Math.round(avgPrice * groupSize);
  
  // DEBUG LOGGING - Remove after fixing
  logger.info("🔍 API ROUTE DEBUG - Using Restaurant Pricing:", {
    entryPoint: LOG_ENTRY_POINT,
    restaurantName: restaurant.name,
    userBudgetInput: userBudget,
    restaurantMinPrice: restaurant.priceRange.min,
    restaurantMaxPrice: restaurant.priceRange.max,
    avgPrice: avgPrice,
    groupSize: groupSize,
    finalPrice: fallbackPrice
  }, requestId);
  
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


// Health check endpoint for monitoring. Stats exposes error-type counts and
// last-error metadata, so it sits behind auth; bare health stays open.
export const GET = withAuth(async (req: NextRequest) => {
  const requestId = getRequestId(req);
  return timedHttp('/api/gemini/food-recommendations', 'GET', async () => {
  try {
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
  } catch (error) {
    logger.error('Food recommendation monitoring request failed', {
      entryPoint: LOG_ENTRY_POINT,
      errorName: error instanceof Error ? error.name : typeof error
    }, requestId);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
  }, (res) => res.status);
});