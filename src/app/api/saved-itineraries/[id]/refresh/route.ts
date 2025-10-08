/**
 * Enterprise-Grade Itinerary Refresh API Endpoint
 * Regenerates itineraries when weather/traffic conditions significantly change
 * 
 * @route POST /api/saved-itineraries/[id]/refresh
 * @author Tarana.ai Engineering Team
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { getSavedItineraries, updateItinerary, SavedItinerary } from '@/lib/data/savedItineraries';
import { fetchWeatherFromAPI } from '@/lib/core/utils';
import { 
  itineraryRefreshService, 
  ChangeDetectionResult 
} from '@/lib/services/itineraryRefreshService';

// ============================================================================
// TYPES
// ============================================================================

interface RefreshRequest {
  force?: boolean; // Force refresh even if no significant changes
  evaluateOnly?: boolean; // Only evaluate, don't regenerate
}

interface RefreshResponse {
  success: boolean;
  message: string;
  evaluation?: ChangeDetectionResult;
  updatedItinerary?: SavedItinerary;
  error?: string;
}

// ============================================================================
// GET /api/saved-itineraries/[id]/refresh (Evaluation Only)
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<RefreshResponse>> {
  const { id } = await params;
  console.log(`\n🔍 REFRESH EVALUATION REQUEST - ID: ${id}\n`);

  try {
    // Authentication
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized', error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Fetch itinerary
    const allItineraries = await getSavedItineraries();
    const itinerary = allItineraries.find(i => i.id === id);

    if (!itinerary) {
      return NextResponse.json(
        { success: false, message: 'Itinerary not found', error: 'Not found' },
        { status: 404 }
      );
    }

    // Extract coordinates
    const activityCoordinates = extractActivityCoordinates(itinerary);
    if (activityCoordinates.length === 0) {
      activityCoordinates.push({ lat: 16.4023, lon: 120.5960, name: 'Baguio City Center' });
    }

    // Fetch weather
    const currentWeather = await fetchWeatherFromAPI();
    if (!currentWeather) {
      return NextResponse.json(
        { success: false, message: 'Weather unavailable', error: 'Service unavailable' },
        { status: 503 }
      );
    }

    // Evaluate
    const evaluation = await itineraryRefreshService.evaluateRefreshNeed(
      itinerary,
      currentWeather,
      activityCoordinates
    );

    return NextResponse.json({
      success: true,
      message: itineraryRefreshService.getChangeSummary(evaluation),
      evaluation
    });

  } catch (error) {
    console.error('❌ Evaluation error:', error);
    return NextResponse.json(
      { success: false, message: 'Evaluation failed', error: 'Internal error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/saved-itineraries/[id]/refresh
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<RefreshResponse>> {
  const { id } = await params;
  const startTime = Date.now();
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔄 ITINERARY REFRESH REQUEST - ID: ${id}`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    // ========================================================================
    // 1. AUTHENTICATION
    // ========================================================================
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      console.log('❌ Unauthorized: No valid session');
      return NextResponse.json(
        { 
          success: false, 
          message: 'Unauthorized', 
          error: 'You must be logged in to refresh itineraries' 
        },
        { status: 401 }
      );
    }

    console.log(`✅ Authenticated user: ${session.user.email}`);

    // ========================================================================
    // 2. PARSE REQUEST BODY
    // ========================================================================
    let requestBody: RefreshRequest = {};
    
    try {
      requestBody = await request.json();
      console.log('📥 Request options:', requestBody);
    } catch (e) {
      // Empty body is OK for force refresh
      console.log('📥 Empty request body - using defaults');
    }

    // ========================================================================
    // 3. FETCH ITINERARY
    // ========================================================================
    console.log(`\n📂 Fetching itinerary ${id}...`);
    
    const allItineraries = await getSavedItineraries();
    const itinerary = allItineraries.find(i => i.id === id);

    if (!itinerary) {
      console.log('❌ Itinerary not found');
      return NextResponse.json(
        { 
          success: false, 
          message: 'Itinerary not found', 
          error: 'The requested itinerary could not be found' 
        },
        { status: 404 }
      );
    }

    console.log(`✅ Itinerary found: "${itinerary.title}"`);

    // ========================================================================
    // 4. EXTRACT ACTIVITY COORDINATES
    // ========================================================================
    console.log(`\n📍 Extracting activity coordinates...`);
    
    const activityCoordinates = extractActivityCoordinates(itinerary);
    
    if (activityCoordinates.length === 0) {
      console.log('⚠️ No activity coordinates found - using Baguio center');
      activityCoordinates.push({ lat: 16.4023, lon: 120.5960, name: 'Baguio City Center' });
    }
    
    console.log(`✅ Found ${activityCoordinates.length} activity locations`);

    // ========================================================================
    // 5. FETCH CURRENT WEATHER
    // ========================================================================
    console.log(`\n🌤️ Fetching current weather data...`);
    
    const currentWeather = await fetchWeatherFromAPI();
    
    if (!currentWeather) {
      console.log('❌ Failed to fetch weather data');
      return NextResponse.json(
        { 
          success: false, 
          message: 'Weather data unavailable', 
          error: 'Unable to fetch current weather conditions' 
        },
        { status: 503 }
      );
    }

    console.log(`✅ Weather fetched: ${currentWeather.weather[0]?.main || 'Unknown'}, ${currentWeather.main.temp}°C`);

    // ========================================================================
    // 6. EVALUATE REFRESH NEED
    // ========================================================================
    console.log(`\n🔍 Evaluating refresh need...`);
    
    const evaluation = await itineraryRefreshService.evaluateRefreshNeed(
      itinerary,
      currentWeather,
      activityCoordinates
    );

    console.log(`\n📊 Evaluation Results:`);
    console.log(`   Needs Refresh: ${evaluation.needsRefresh}`);
    console.log(`   Severity: ${evaluation.severity}`);
    console.log(`   Confidence: ${evaluation.confidence}`);
    console.log(`   Reasons: ${evaluation.reasons.join(', ')}`);

    // ========================================================================
    // 7. DETERMINE ACTION
    // ========================================================================
    const shouldRefresh = requestBody.force || evaluation.needsRefresh;
    
    if (!shouldRefresh) {
      console.log('✅ No refresh needed - returning evaluation only');
      return NextResponse.json({
        success: true,
        message: itineraryRefreshService.getChangeSummary(evaluation),
        evaluation
      });
    }

    console.log(`\n🔄 Proceeding with itinerary refresh...`);
    if (requestBody.force) console.log(`   Reason: Force refresh requested`);
    if (evaluation.needsRefresh) console.log(`   Reason: Significant changes detected`);

    // ========================================================================
    // 8. REGENERATE ITINERARY
    // ========================================================================
    console.log(`\n🤖 Regenerating itinerary with current conditions...`);
    
    let regeneratedItinerary;
    try {
      regeneratedItinerary = await regenerateItinerary(
        itinerary,
        currentWeather,
        activityCoordinates,
        evaluation
      );
    } catch (regenerationError) {
      console.error('❌ Regeneration failed:', regenerationError);
      const errorMessage = regenerationError instanceof Error 
        ? regenerationError.message 
        : 'Unknown generation error';
      
      return NextResponse.json(
        { 
          success: false, 
          message: 'Generation failed', 
          error: `Failed to generate updated itinerary: ${errorMessage}`,
          details: {
            phase: 'regeneration',
            originalError: errorMessage
          }
        },
        { status: 500 }
      );
    }

    if (!regeneratedItinerary || !regeneratedItinerary.items) {
      console.log('❌ Invalid regenerated itinerary structure');
      return NextResponse.json(
        { 
          success: false, 
          message: 'Generation failed', 
          error: 'Generated itinerary has invalid structure. Please try again.',
          details: {
            phase: 'validation',
            received: regeneratedItinerary ? 'partial data' : 'null'
          }
        },
        { status: 500 }
      );
    }

    console.log('✅ Itinerary regenerated successfully');

    // ========================================================================
    // 9. CREATE TRAFFIC SNAPSHOT
    // ========================================================================
    console.log(`\n📸 Creating traffic snapshot...`);
    
    const trafficSnapshot = await itineraryRefreshService.createTrafficSnapshot(
      activityCoordinates
    );

    console.log(`✅ Traffic snapshot created`);

    // ========================================================================
    // 10. UPDATE DATABASE
    // ========================================================================
    console.log(`\n💾 Updating itinerary in database...`);
    
    const updatedItinerary = await updateItinerary(id, {
      // ✅ Preserve original form data (essential for UI display)
      title: itinerary.title,
      date: itinerary.date,
      budget: itinerary.budget,
      tags: itinerary.tags,
      formData: itinerary.formData, // ✅ CRITICAL: Preserve original form data
      // Update with new generated data
      itineraryData: regeneratedItinerary,
      weatherData: currentWeather,
      trafficSnapshot,
      refreshMetadata: {
        lastEvaluatedAt: new Date(),
        lastRefreshedAt: new Date(),
        refreshReasons: evaluation.reasons,
        status: 'REFRESH_COMPLETED',
        weatherSnapshot: currentWeather,
        trafficSnapshot,
        refreshCount: ((itinerary.refreshMetadata?.refreshCount || 0) + 1),
        autoRefreshEnabled: itinerary.refreshMetadata?.autoRefreshEnabled ?? true
      },
      activityCoordinates
    });

    if (!updatedItinerary) {
      console.log('❌ Failed to update itinerary in database');
      return NextResponse.json(
        { 
          success: false, 
          message: 'Update failed', 
          error: 'Failed to save updated itinerary. Please try again.' 
        },
        { status: 500 }
      );
    }

    console.log(`✅ Itinerary updated in database`);

    // ========================================================================
    // 11. SUCCESS RESPONSE
    // ========================================================================
    const duration = Date.now() - startTime;
    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ REFRESH COMPLETED SUCCESSFULLY - Duration: ${duration}ms`);
    console.log(`${'='.repeat(80)}\n`);

    return NextResponse.json({
      success: true,
      message: itineraryRefreshService.getChangeSummary(evaluation),
      evaluation,
      updatedItinerary
    });

  } catch (error) {
    console.error('\n❌ REFRESH ERROR:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Refresh failed', 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Transform API response to frontend-compatible structure
 */
function transformItineraryStructure(apiResponse: any): any {
  try {
    let itineraryData;
    
    // Extract from different possible response formats
    if (apiResponse.text) {
      // Format 1: JSON string in "text" field
      itineraryData = JSON.parse(apiResponse.text);
    } else if (apiResponse.itinerary) {
      // Format 2: Direct "itinerary" field
      itineraryData = apiResponse.itinerary;
    } else {
      // Format 3: Direct structure
      itineraryData = apiResponse;
    }
    
    // Ensure it has the required structure for frontend
    if (!itineraryData.items || !Array.isArray(itineraryData.items)) {
      console.error('❌ Invalid itinerary structure - missing items array');
      return {
        title: "Refreshed Itinerary",
        subtitle: "Updated with current conditions",
        items: []
      };
    }
    
    // Ensure each item has the required fields
    const transformedItems = itineraryData.items.map((item: any) => ({
      period: item.period || "Unknown Period",
      activities: (item.activities || []).map((activity: any) => ({
        title: activity.title || "Activity",
        time: activity.time || "TBD",
        desc: activity.desc || activity.description || "No description available",
        tags: Array.isArray(activity.tags) ? activity.tags : ["General"],
        image: typeof activity.image === 'string' 
          ? activity.image 
          : (activity.image?.src || activity.image || "/images/default.jpg")
      }))
    }));
    
    return {
      title: itineraryData.title || "Refreshed Itinerary",
      subtitle: itineraryData.subtitle || "Updated with current conditions", 
      items: transformedItems
    };
    
  } catch (error) {
    console.error('❌ Error transforming itinerary structure:', error);
    return {
      title: "Refreshed Itinerary",
      subtitle: "Updated with current conditions",
      items: []
    };
  }
}

/**
 * Extract activity coordinates from itinerary
 */
function extractActivityCoordinates(
  itinerary: SavedItinerary
): Array<{ lat: number; lon: number; name: string }> {
  const coordinates: Array<{ lat: number; lon: number; name: string }> = [];

  // Check if coordinates are already stored
  if (itinerary.activityCoordinates && itinerary.activityCoordinates.length > 0) {
    return itinerary.activityCoordinates;
  }

  // Extract from itinerary data
  if (itinerary.itineraryData && itinerary.itineraryData.items) {
    for (const period of itinerary.itineraryData.items) {
      for (const activity of period.activities) {
        // Try to extract coordinates from activity data
        // This assumes activities have lat/lon stored (from previous implementations)
        const activityData = activity as any;
        
        if (activityData.lat && activityData.lon) {
          coordinates.push({
            lat: activityData.lat,
            lon: activityData.lon,
            name: activity.title || 'Unknown Activity'
          });
        }
      }
    }
  }

  // Remove duplicates and return
  const seen = new Set();
  const uniqueCoordinates = coordinates.filter(coord => {
    const key = `${coord.lat},${coord.lon}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return uniqueCoordinates;
}

/**
 * Regenerate itinerary using the enterprise generation pipeline
 * PRODUCTION-OPTIMIZED: Uses direct function import to avoid timeout issues
 */
async function regenerateItinerary(
  originalItinerary: SavedItinerary,
  currentWeather: any,
  activityCoordinates: Array<{ lat: number; lon: number; name: string }>,
  evaluation: ChangeDetectionResult
): Promise<any> {
  try {
    console.log('🔄 Calling itinerary generation API...');

    const { formData } = originalItinerary;
    
    // Build context-aware prompt
    const prompt = buildRefreshPrompt(originalItinerary, evaluation);

    // ✅ PRODUCTION FIX: Use correct API path (remove /route suffix)
    // ✅ PRODUCTION FIX: Construct base URL properly for internal API call
    const baseUrl = process.env.NEXTAUTH_URL 
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || 'http://localhost:3000';
    
    // Safety check to ensure baseUrl is valid
    if (!baseUrl || baseUrl === 'undefined' || baseUrl.includes('undefined')) {
      console.error('❌ Invalid baseUrl constructed:', baseUrl);
      console.error('Environment variables:', {
        NEXTAUTH_URL: process.env.NEXTAUTH_URL,
        VERCEL_URL: process.env.VERCEL_URL,
        NODE_ENV: process.env.NODE_ENV
      });
      throw new Error('Invalid base URL configuration. Please set NEXTAUTH_URL in your .env file to http://localhost:3000');
    }
    
    console.log(`📡 Calling generation API: ${baseUrl}/api/gemini/itinerary-generator`);
    console.log(`🔍 Environment - NEXTAUTH_URL: ${process.env.NEXTAUTH_URL ? 'SET' : 'NOT SET'}, VERCEL_URL: ${process.env.VERCEL_URL ? 'SET' : 'NOT SET'}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000); // 55s timeout (under Vercel limit)

    const response = await fetch(`${baseUrl}/api/gemini/itinerary-generator`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-refresh-request': 'true' // Flag for internal tracking
      },
      body: JSON.stringify({
        prompt: prompt,
        interests: formData.selectedInterests.length > 0 ? formData.selectedInterests : ['Random'],
        duration: parseInt(formData.duration) || 1,
        budget: formData.budget,
        pax: parseInt(formData.pax) || 1,
        weatherData: currentWeather,
        useVectorSearch: true,
        refreshContext: {
          isRefresh: true,
          previousItinerary: originalItinerary.itineraryData,
          changeReasons: evaluation.reasons,
          severity: evaluation.severity
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details');
      console.error(`❌ Generation API Error (${response.status}):`, errorText);
      console.error(`❌ Request URL: ${baseUrl}/api/gemini/itinerary-generator`);
      throw new Error(`Generation API returned ${response.status}: ${errorText.substring(0, 200)}`);
    }

    const result = await response.json();
    
    if (result.error) {
      console.error('❌ Generation API Error:', result.error);
      throw new Error(result.error);
    }

    console.log('✅ Itinerary generated successfully');
    
    // ✅ CRITICAL: Transform to frontend-compatible structure
    const transformedItinerary = transformItineraryStructure(result);
    console.log('✅ Itinerary transformed for frontend compatibility');
    
    return transformedItinerary;

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ Generation timeout after 55 seconds');
      throw new Error('Generation timeout - please try again');
    }
    console.error('❌ Error regenerating itinerary:', error);
    throw error; // Propagate error instead of returning null
  }
}

/**
 * Build context-aware prompt for refresh
 */
function buildRefreshPrompt(
  itinerary: SavedItinerary,
  evaluation: ChangeDetectionResult
): string {
  const parts: string[] = [
    `Update the itinerary for Baguio City, Philippines based on current conditions.`,
  ];

  if (evaluation.weatherChange) {
    parts.push(`Weather has changed to ${evaluation.weatherChange.currentCondition} (${evaluation.weatherChange.temperatureDelta.toFixed(1)}°C difference).`);
  }

  if (evaluation.trafficChange) {
    parts.push(`Traffic conditions have changed to ${evaluation.trafficChange.currentLevel} level.`);
  }

  parts.push(`Maintain the same interests and preferences, but optimize for current conditions.`);

  return parts.join(' ');
}
