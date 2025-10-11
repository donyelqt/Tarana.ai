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
import { parallelTrafficProcessor } from '@/lib/performance/parallelTrafficProcessor';

// ============================================================================
// ROUTE SEGMENT CONFIG (Next.js 13+ App Router)
// ============================================================================
export const maxDuration = 60; // 60 seconds (requires Vercel Pro plan)
export const dynamic = 'force-dynamic'; // Disable caching for fresh data
export const runtime = 'nodejs'; // Use Node.js runtime (default)

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
    
    // ✅ DEBUG: Log traffic metadata preservation
    const activitiesWithTraffic = regeneratedItinerary.items
      .flatMap((item: any) => item.activities || [])
      .filter((activity: any) => activity.trafficAnalysis || activity.trafficLevel);
    
    console.log(`📊 Traffic Metadata Check:`);
    console.log(`   Total activities: ${regeneratedItinerary.items.flatMap((item: any) => item.activities || []).length}`);
    console.log(`   Activities with traffic data: ${activitiesWithTraffic.length}`);
    
    if (activitiesWithTraffic.length > 0) {
      console.log(`   Sample traffic data:`, {
        title: activitiesWithTraffic[0].title,
        trafficLevel: activitiesWithTraffic[0].trafficAnalysis?.realTimeTraffic?.trafficLevel || activitiesWithTraffic[0].trafficLevel,
        tags: activitiesWithTraffic[0].tags,
        hasTrafficAnalysis: !!activitiesWithTraffic[0].trafficAnalysis
      });
    } else {
      console.warn(`⚠️ WARNING: No activities have traffic metadata after regeneration!`);
    }

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
    
    const enrichedItineraryData = await enrichItineraryWithTraffic(regeneratedItinerary);

    const updatedItinerary = await updateItinerary(id, {
      // ✅ Preserve original form data (essential for UI display)
      title: itinerary.title,
      date: itinerary.date,
      budget: itinerary.budget,
      tags: itinerary.tags,
      formData: itinerary.formData, // ✅ CRITICAL: Preserve original form data
      // Update with new generated data
      itineraryData: enrichedItineraryData,
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
    // 11. SUCCESS RESPONSE & METRICS
    // ========================================================================
    const duration = Date.now() - startTime;
    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ REFRESH COMPLETED SUCCESSFULLY - Duration: ${duration}ms`);
    console.log(`${'='.repeat(80)}`);
    
    // 📊 Production Metrics
    console.log('\n📊 REFRESH METRICS:');
    console.log(`   Total Duration: ${duration}ms`);
    console.log(`   Severity: ${evaluation.severity}`);
    console.log(`   Confidence: ${evaluation.confidence}%`);
    console.log(`   Reasons: ${evaluation.reasons.join(', ')}`);
    console.log(`   Activities Count: ${updatedItinerary.itineraryData?.items?.flatMap((i: any) => i.activities || []).length || 0}`);
    console.log(`   Refresh Count: ${updatedItinerary.refreshMetadata?.refreshCount || 0}`);
    console.log('');

    return NextResponse.json({
      success: true,
      message: itineraryRefreshService.getChangeSummary(evaluation),
      evaluation,
      updatedItinerary
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('\n❌ REFRESH ERROR:', error);
    console.error(`Duration before failure: ${duration}ms`);
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
    
    // Determine error category for better client handling
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('AbortError');
    const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('ECONNREFUSED');
    const isGenerationError = errorMessage.includes('Generation') || errorMessage.includes('Gemini');
    
    console.error('\n🔍 ERROR CLASSIFICATION:', {
      isTimeout,
      isNetworkError,
      isGenerationError,
      message: errorMessage.substring(0, 100)
    });
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Refresh failed', 
        error: errorMessage,
        details: {
          duration: `${duration}ms`,
          category: isTimeout ? 'timeout' : isNetworkError ? 'network' : isGenerationError ? 'generation' : 'unknown',
          timestamp: new Date().toISOString()
        }
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
    // ✅ CRITICAL: Preserve ALL traffic metadata for UI display
    const transformedItems = itineraryData.items.map((item: any) => ({
      period: item.period || "Unknown Period",
      activities: (item.activities || []).map((activity: any) => {
        const trafficAnalysis = activity.trafficAnalysis;
        const trafficLevel = trafficAnalysis?.realTimeTraffic?.trafficLevel || activity.trafficLevel;
        const trafficRecommendation = activity.trafficRecommendation || trafficAnalysis?.trafficRecommendation;
        const baseTags = Array.isArray(activity.tags) ? [...activity.tags] : ["General"];

        if (trafficLevel && !baseTags.includes('low-traffic') && !baseTags.includes('moderate-traffic')) {
          if (trafficLevel === 'VERY_LOW' || trafficLevel === 'LOW') {
            baseTags.push('low-traffic');
          } else if (trafficLevel === 'MODERATE') {
            baseTags.push('moderate-traffic');
          }
        }

        const description = harmonizeTrafficDescription(
          activity.desc || activity.description || "No description available",
          trafficLevel,
          trafficRecommendation
        );

        return {
          title: activity.title || "Activity",
          time: activity.time || "TBD",
          desc: description,
          tags: baseTags,
          image: typeof activity.image === 'string'
            ? activity.image
            : (activity.image?.src || activity.image || "/images/default.jpg"),
          trafficAnalysis,
          trafficData: activity.trafficData,
          trafficLevel,
          trafficRecommendation: trafficRecommendation,
          lat: activity.lat,
          lon: activity.lon
        };
      })
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

const normalizeTitle = (title: string) =>
  title
    ?.toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '')
    .trim();

const buildTrafficNarrative = (
  trafficLevel?: string,
  trafficRecommendation?: string
) => {
  if (!trafficLevel) {
    return '';
  }

  const level = trafficLevel.toUpperCase();
  const recommendation = (trafficRecommendation || '').toUpperCase();

  const recommendationSuffix = (() => {
    if (recommendation === 'VISIT_NOW') {
      return 'Plan to head there right away for the best experience.';
    }
    if (recommendation === 'VISIT_SOON') {
      return 'It is a great window to go in the next hour or so.';
    }
    if (recommendation === 'PLAN_AHEAD') {
      return 'A bit of planning will help you glide through smoothly.';
    }
    return '';
  })();

  const base = (() => {
    switch (level) {
      case 'VERY_LOW':
        return 'Real-time conditions are very low, so expect a quick trip with almost no congestion.';
      case 'LOW':
        return 'Real-time conditions are low, keeping the route relaxed and crowd levels light.';
      case 'MODERATE':
        return 'Traffic is moderate right now—allow a small buffer, but it remains comfortably manageable.';
      default:
        return '';
    }
  })();

  if (!base) {
    return '';
  }

  return recommendationSuffix ? `${base} ${recommendationSuffix}` : base;
};

const harmonizeTrafficDescription = (
  description: string,
  trafficLevel?: string,
  trafficRecommendation?: string
) => {
  if (!trafficLevel) {
    return description;
  }

  const narrative = buildTrafficNarrative(trafficLevel, trafficRecommendation);
  if (!narrative) {
    return description;
  }

  const baseText = (() => {
    if (!description) {
      return '';
    }

    const sentences = description
      .split(/(?<=[.!?])\s+/)
      .filter(sentence => !/(traffic|crowd|queue|congestion|rush hour|busy)/i.test(sentence));

    const sanitized = sentences.join(' ').trim();
    return sanitized;
  })();

  if (!baseText) {
    return narrative;
  }

  const normalizedBase = baseText.endsWith('.') ? baseText : `${baseText}.`;
  return `${normalizedBase} ${narrative}`.trim();
};

/**
 * Enrich itinerary with real-time traffic metadata
 * ✅ Production-optimized with comprehensive error handling and logging
 */
async function enrichItineraryWithTraffic(itinerary: any) {
  const enrichmentStartTime = Date.now();
  console.log('\n🚗 TRAFFIC ENRICHMENT: Starting...');
  
  if (!itinerary?.items || itinerary.items.length === 0) {
    console.log('⚠️ TRAFFIC ENRICHMENT: No items to enrich');
    return itinerary;
  }

  try {
    const uniqueActivities = new Map<string, any>();
    const trafficInput: any[] = [];

    itinerary.items.forEach((period: any) => {
      (period.activities || []).forEach((activity: any) => {
        const key = normalizeTitle(activity?.title || '');
        if (!key || uniqueActivities.has(key)) {
          return;
        }

        uniqueActivities.set(key, activity);
        trafficInput.push({
          title: activity.title,
          desc: activity.desc,
          tags: Array.isArray(activity.tags) ? activity.tags : [],
          image: typeof activity.image === 'string' ? activity.image : activity.image?.src || '',
          time: activity.time,
          peakHours: activity.peakHours || '',
        });
      });
    });

    if (trafficInput.length === 0) {
      console.log('ℹ️ enrichItineraryWithTraffic: No activities to enrich');
      return itinerary;
    }

    console.log(`🚦 Enriching ${trafficInput.length} unique activities with real-time traffic data...`);
    const trafficProcessStartTime = Date.now();
    const { enhancedActivities } = await parallelTrafficProcessor.processActivitiesUltraFast(trafficInput as any);
    const trafficProcessDuration = Date.now() - trafficProcessStartTime;
    console.log(`✅ Traffic processing completed in ${trafficProcessDuration}ms`);

    const metadataMap = new Map<string, any>();
    enhancedActivities.forEach((activity: any) => {
      const key = normalizeTitle(activity?.title || '');
      if (key) {
        metadataMap.set(key, activity);
      }
    });

    itinerary.items = itinerary.items.map((period: any) => {
      const activities = (period.activities || []).map((activity: any) => {
        const key = normalizeTitle(activity?.title || '');
        const metadata = key ? metadataMap.get(key) : undefined;

        if (!metadata) {
          return activity;
        }

        const trafficLevel = metadata.trafficAnalysis?.realTimeTraffic?.trafficLevel
          ?? activity.trafficAnalysis?.realTimeTraffic?.trafficLevel
          ?? activity.trafficLevel;

        const trafficRecommendation = metadata.trafficRecommendation
          ?? activity.trafficRecommendation
          ?? metadata.trafficAnalysis?.trafficRecommendation;

        const mergedTags = new Set<string>([
          ...(Array.isArray(activity.tags) ? activity.tags : []),
          ...(Array.isArray(metadata.tags) ? metadata.tags : []),
        ]);

        if (trafficLevel === 'VERY_LOW' || trafficLevel === 'LOW') {
          mergedTags.add('low-traffic');
          mergedTags.delete('moderate-traffic');
        } else if (trafficLevel === 'MODERATE') {
          mergedTags.add('moderate-traffic');
          mergedTags.delete('low-traffic');
        } else {
          mergedTags.delete('low-traffic');
          mergedTags.delete('moderate-traffic');
        }

        const description = harmonizeTrafficDescription(
          activity.desc || activity.description || metadata.desc || '',
          trafficLevel,
          trafficRecommendation
        );

        return {
          ...activity,
          trafficAnalysis: metadata.trafficAnalysis,
          trafficRecommendation,
          combinedTrafficScore: metadata.combinedTrafficScore ?? activity.combinedTrafficScore,
          crowdLevel: metadata.crowdLevel ?? activity.crowdLevel,
          lat: metadata.lat ?? activity.lat,
          lon: metadata.lon ?? activity.lon,
          trafficLevel,
          desc: description,
          tags: Array.from(mergedTags),
        };
      });

      return {
        ...period,
        activities,
      };
    });

    const enrichmentDuration = Date.now() - enrichmentStartTime;
    console.log(`✅ TRAFFIC ENRICHMENT: Completed in ${enrichmentDuration}ms`);
    console.log(`📊 Traffic Enhancement Stats:`, {
      totalActivities: itinerary.items.flatMap((p: any) => p.activities || []).length,
      uniqueProcessed: trafficInput.length,
      enhancedCount: enhancedActivities.length,
      metadataMapSize: metadataMap.size,
      duration: `${enrichmentDuration}ms`
    });
    
    return itinerary;
  } catch (error) {
    const enrichmentDuration = Date.now() - enrichmentStartTime;
    console.error(`❌ TRAFFIC ENRICHMENT FAILED after ${enrichmentDuration}ms:`, error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    // Return original itinerary without traffic enrichment rather than failing
    return itinerary;
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

    // ✅ PRODUCTION FIX: Robust base URL construction with multiple fallbacks
    const getBaseUrl = (): string => {
      // Priority 1: Explicit NEXTAUTH_URL (recommended for production)
      if (process.env.NEXTAUTH_URL) {
        return process.env.NEXTAUTH_URL;
      }
      
      // Priority 2: Vercel deployment URL
      if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
      }
      
      // Priority 3: Vercel branch deployment URL
      if (process.env.VERCEL === '1' && process.env.VERCEL_BRANCH_URL) {
        return `https://${process.env.VERCEL_BRANCH_URL}`;
      }
      
      // Priority 4: Development fallback
      return 'http://localhost:3000';
    };
    
    const baseUrl = getBaseUrl();
    
    // Enhanced safety validation
    if (!baseUrl || baseUrl === 'undefined' || baseUrl.includes('undefined') || baseUrl === 'null') {
      console.error('❌ Invalid baseUrl constructed:', baseUrl);
      console.error('Environment variables:', {
        NEXTAUTH_URL: process.env.NEXTAUTH_URL ? 'SET' : 'NOT SET',
        VERCEL_URL: process.env.VERCEL_URL ? 'SET' : 'NOT SET',
        VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL ? 'SET' : 'NOT SET',
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL
      });
      throw new Error('Critical: Base URL cannot be determined. Set NEXTAUTH_URL environment variable.');
    }
    
    console.log(`📡 Calling generation API: ${baseUrl}/api/gemini/itinerary-generator`);
    console.log(`🔍 Environment - NEXTAUTH_URL: ${process.env.NEXTAUTH_URL ? 'SET' : 'NOT SET'}, VERCEL_URL: ${process.env.VERCEL_URL ? 'SET' : 'NOT SET'}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000); // 55s timeout (under Vercel limit)

    console.log('📤 Refresh Request Payload:', {
      prompt: prompt.substring(0, 100) + '...',
      interests: formData.selectedInterests,
      duration: parseInt(formData.duration) || 1,
      weatherCondition: currentWeather?.weather?.[0]?.main,
      isRefresh: true
    });

    const response = await fetch(`${baseUrl}/api/gemini/itinerary-generator`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-refresh-request': 'true', // Flag for cache bypass
        'x-bypass-cache': 'true' // Additional cache bypass flag
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
      console.error('Error details:', {
        errorType: result.errorType,
        requestId: result.requestId,
        retryable: result.retryable
      });
      throw new Error(result.error);
    }

    console.log('✅ Itinerary generated successfully');
    console.log('📊 Generation Stats:', {
      hasText: !!result.text,
      resultType: typeof result,
      keys: Object.keys(result)
    });
    
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
