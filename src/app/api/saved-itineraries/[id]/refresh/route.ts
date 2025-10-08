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
    } catch (error) {
      // Empty body is acceptable - use defaults
      console.log('📥 No request body - using defaults');
    }

    const { force = false, evaluateOnly = false } = requestBody;

    // ========================================================================
    // 3. FETCH ITINERARY
    // ========================================================================
    console.log(`\n📂 Fetching itinerary ${id}...`);
    
    const allItineraries = await getSavedItineraries();
    const itinerary = allItineraries.find(i => i.id === id);

    if (!itinerary) {
      console.log(`❌ Itinerary not found: ${id}`);
      return NextResponse.json(
        { 
          success: false, 
          message: 'Itinerary not found', 
          error: 'The requested itinerary does not exist or you do not have access to it' 
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
          error: 'Could not fetch current weather data. Please try again later.' 
        },
        { status: 503 }
      );
    }

    console.log(`✅ Weather fetched: ${currentWeather.weather[0]?.main}, ${currentWeather.main.temp}°C`);

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
    console.log(`   Confidence: ${evaluation.confidence}%`);
    console.log(`   Reasons: ${evaluation.reasons.join(', ') || 'None'}`);

    // If evaluate-only mode, return evaluation without regenerating
    if (evaluateOnly) {
      console.log(`\n✅ Evaluation-only mode - returning results without regeneration`);
      
      return NextResponse.json({
        success: true,
        message: itineraryRefreshService.getChangeSummary(evaluation),
        evaluation
      });
    }

    // ========================================================================
    // 7. DECIDE WHETHER TO REFRESH
    // ========================================================================
    const shouldRefresh = force || evaluation.needsRefresh;

    if (!shouldRefresh) {
      console.log(`\n✅ No refresh needed - itinerary is still optimal`);
      
      return NextResponse.json({
        success: true,
        message: 'No significant changes detected. Your itinerary is still optimal.',
        evaluation
      });
    }

    console.log(`\n🔄 Proceeding with itinerary refresh...`);
    if (force) console.log(`   Reason: Force refresh requested`);
    if (evaluation.needsRefresh) console.log(`   Reason: Significant changes detected`);

    // ========================================================================
    // 8. REGENERATE ITINERARY
    // ========================================================================
    console.log(`\n🤖 Regenerating itinerary with current conditions...`);
    
    const regeneratedItinerary = await regenerateItinerary(
      itinerary,
      currentWeather,
      activityCoordinates,
      evaluation
    );

    if (!regeneratedItinerary) {
      console.log('❌ Failed to regenerate itinerary');
      return NextResponse.json(
        { 
          success: false, 
          message: 'Regeneration failed', 
          error: 'Failed to generate updated itinerary. Please try again.' 
        },
        { status: 500 }
      );
    }

    console.log(`✅ Itinerary regenerated successfully`);

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
            name: activity.title
          });
        }
      }
    }
  }

  // Remove duplicates
  const uniqueCoordinates = coordinates.filter((coord, index, self) =>
    index === self.findIndex(c => 
      Math.abs(c.lat - coord.lat) < 0.001 && Math.abs(c.lon - coord.lon) < 0.001
    )
  );

  return uniqueCoordinates;
}

/**
 * Regenerate itinerary using the enterprise generation pipeline
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

    // Call the enterprise itinerary generation endpoint
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/gemini/itinerary-generator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interests: formData.selectedInterests.length > 0 ? formData.selectedInterests : ['Random'],
        duration: parseInt(formData.duration) || 1,
        budget: formData.budget,
        pax: parseInt(formData.pax) || 1,
        weatherData: currentWeather,
        refreshContext: {
          isRefresh: true,
          previousItinerary: originalItinerary.itineraryData,
          changeReasons: evaluation.reasons,
          severity: evaluation.severity
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Generation API returned ${response.status}`);
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error);
    }

    console.log('✅ Itinerary generated successfully');
    return result.itinerary || result;

  } catch (error) {
    console.error('❌ Error regenerating itinerary:', error);
    return null;
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
