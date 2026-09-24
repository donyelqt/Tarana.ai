/**
 * Enterprise-Grade Itinerary Refresh API Endpoint
 * Regenerates itineraries when weather/traffic conditions significantly change
 * 
 * @route POST /api/saved-itineraries/[id]/refresh
 * @author Tarana.ai Engineering Team
 */
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { BENCH_TOKEN_HEADER } from '@/lib/auth/benchToken';
import { logger } from '@/lib/observability/logger';
import { getRequestId } from '@/middleware/requestId';
import { getSavedItineraries, updateItinerary, SavedItinerary } from '@/lib/data/savedItineraries';
import { fetchWeatherFromAPI } from '@/lib/core/utils';
import { timedHttp } from '@/lib/observability/httpMetrics';
import { 
  itineraryRefreshService, 
  ChangeDetectionResult 
} from '@/lib/services/itineraryRefreshService';
import { parallelTrafficProcessor } from '@/lib/performance/parallelTrafficProcessor';

// ============================================================================
// CROSS-ROUTE CREDENTIAL FORWARDING
// ============================================================================

/**
 * Build the auth headers for an internal server-to-server call.
 *
 * The generator enforces its own auth boundary (`withAuth`), and Node's
 * `fetch` does not attach the browser's cookies to an outbound server call.
 * Without this, the internal POST carries no credential, the generator
 * returns 401, and the refresh path can never regenerate.
 *
 * Only the caller's own credential is forwarded — never a service token —
 * so the downstream call is scoped to the requesting user exactly as their
 * own browser request would be. Session cookies are still validated
 * upstream by NextAuth on the generator side.
 */
function forwardCallerCredential(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  const benchToken = request.headers.get(BENCH_TOKEN_HEADER);
  if (benchToken) {
    // Bench requests carry no session cookie; the HMAC token is their proof.
    headers[BENCH_TOKEN_HEADER] = benchToken;
    return headers;
  }
  const cookie = request.headers.get('cookie');
  if (cookie) headers.cookie = cookie;
  return headers;
}

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

export const GET = withAuth(async (
  request: NextRequest,
  userId: string,
  ...args: unknown[]
): Promise<NextResponse<RefreshResponse>> => {
  const { params } = (args[0] ?? {}) as { params: Promise<{ id: string }> };
  const { id } = await params;
  const requestId = getRequestId(request);
  logger.info('Refresh evaluation requested', { itineraryId: id }, requestId);

  return timedHttp('/api/saved-itineraries/[id]/refresh', 'GET', async () => {
  try {

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
    logger.error('Refresh evaluation failed', { error: error instanceof Error ? error.message : String(error) }, requestId);
    return NextResponse.json(
      { success: false, message: 'Evaluation failed', error: 'Internal error' },
      { status: 500 }
    );
  }
  }, (res) => res.status);
});

// ============================================================================
// POST /api/saved-itineraries/[id]/refresh
// ============================================================================

export const POST = withAuth(async (
  request: NextRequest,
  userId: string,
  ...args: unknown[]
): Promise<NextResponse<RefreshResponse>> => {
  const { params } = (args[0] ?? {}) as { params: Promise<{ id: string }> };
  const { id } = await params;
  const startTime = Date.now();
  const requestId = getRequestId(request);
  logger.info('Itinerary refresh requested', { itineraryId: id }, requestId);

  return timedHttp('/api/saved-itineraries/[id]/refresh', 'POST', async () => {
  try {
    // ========================================================================
    // 1. AUTHENTICATION (withAuth resolved the session identity)
    // ========================================================================

    // ========================================================================
    // 2. PARSE REQUEST BODY
    // ========================================================================
    let requestBody: RefreshRequest = {};
    
    try {
      requestBody = await request.json();
      logger.info('Refresh request options received', { options: requestBody }, requestId);
    } catch {
      // Empty body is OK for force refresh
      logger.info('Empty refresh request body - using defaults', {}, requestId);
    }

    // ========================================================================
    // 3. FETCH ITINERARY
    // ========================================================================
    logger.info(`\n📂 Fetching itinerary ${id}...`, {}, requestId);
    
    const allItineraries = await getSavedItineraries();
    const itinerary = allItineraries.find(i => i.id === id);

    if (!itinerary) {
      logger.info('❌ Itinerary not found', {}, requestId);
      return NextResponse.json(
        { 
          success: false, 
          message: 'Itinerary not found', 
          error: 'The requested itinerary could not be found' 
        },
        { status: 404 }
      );
    }

    logger.info(`✅ Itinerary found: "${itinerary.title}"`, {}, requestId);

    // ========================================================================
    // 4. EXTRACT ACTIVITY COORDINATES
    // ========================================================================
    logger.info(`\n📍 Extracting activity coordinates...`, {}, requestId);
    
    const activityCoordinates = extractActivityCoordinates(itinerary);
    
    if (activityCoordinates.length === 0) {
      logger.info('⚠️ No activity coordinates found - using Baguio center', {}, requestId);
      activityCoordinates.push({ lat: 16.4023, lon: 120.5960, name: 'Baguio City Center' });
    }
    
    logger.info(`✅ Found ${activityCoordinates.length} activity locations`, {}, requestId);

    // ========================================================================
    // 5. FETCH CURRENT WEATHER
    // ========================================================================
    logger.info(`\n🌤️ Fetching current weather data...`, {}, requestId);
    
    const currentWeather = await fetchWeatherFromAPI();
    
    if (!currentWeather) {
      logger.error('Failed to fetch weather data', {}, requestId);
      return NextResponse.json(
        { 
          success: false, 
          message: 'Weather data unavailable', 
          error: 'Unable to fetch current weather conditions' 
        },
        { status: 503 }
      );
    }

    logger.info(`✅ Weather fetched: ${currentWeather.weather[0]?.main || 'Unknown'}, ${currentWeather.main.temp}°C`, {}, requestId);

    // ========================================================================
    // 6. EVALUATE REFRESH NEED
    // ========================================================================
    logger.info(`\n🔍 Evaluating refresh need...`, {}, requestId);
    
    const evaluation = await itineraryRefreshService.evaluateRefreshNeed(
      itinerary,
      currentWeather,
      activityCoordinates
    );

    logger.info(`\n📊 Evaluation Results:`, {}, requestId);
    logger.info(`   Needs Refresh: ${evaluation.needsRefresh}`, {}, requestId);
    logger.info(`   Severity: ${evaluation.severity}`, {}, requestId);
    logger.info(`   Confidence: ${evaluation.confidence}`, {}, requestId);
    logger.info(`   Reasons: ${evaluation.reasons.join(', ')}`, {}, requestId);

    // ========================================================================
    // 7. DETERMINE ACTION
    // ========================================================================
    const shouldRefresh = requestBody.force || evaluation.needsRefresh;
    
    if (!shouldRefresh) {
      logger.info('✅ No refresh needed - returning evaluation only', {}, requestId);
      return NextResponse.json({
        success: true,
        message: itineraryRefreshService.getChangeSummary(evaluation),
        evaluation
      });
    }

    logger.info(`\n🔄 Proceeding with itinerary refresh...`, {}, requestId);
    if (requestBody.force) logger.info(`   Reason: Force refresh requested`, {}, requestId);
    if (evaluation.needsRefresh) logger.info(`   Reason: Significant changes detected`, {}, requestId);

    // ========================================================================
    // 8. REGENERATE ITINERARY
    // ========================================================================
    logger.info(`\n🤖 Regenerating itinerary with current conditions...`, {}, requestId);
    
    let regeneratedItinerary;
    try {
      regeneratedItinerary = await regenerateItinerary(
        itinerary,
        currentWeather,
        activityCoordinates,
        evaluation,
        request
      );
    } catch (regenerationError) {
      const errorMessage = regenerationError instanceof Error
        ? regenerationError.message
        : 'Unknown generation error';
      // Server log only: response bodies must not carry raw upstream detail.
      logger.error('Regeneration failed', { detail: errorMessage }, requestId);
      return NextResponse.json(
        { 
          success: false, 
          message: 'Generation failed', 
          error: 'Failed to generate an updated itinerary',
          details: { phase: 'regeneration' }
        },
        { status: 500 }
      );
    }

    if (!regeneratedItinerary || !regeneratedItinerary.items) {
      logger.info('❌ Invalid regenerated itinerary structure', {}, requestId);
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

    logger.info('✅ Itinerary regenerated successfully', {}, requestId);
    
    // ✅ DEBUG: Log traffic metadata preservation
    const activitiesWithTraffic = regeneratedItinerary.items
      .flatMap((item: any) => item.activities || [])
      .filter((activity: any) => activity.trafficAnalysis || activity.trafficLevel);
    
    logger.info(`📊 Traffic Metadata Check:`, {}, requestId);
    logger.info(`   Total activities: ${regeneratedItinerary.items.flatMap((item: any) => item.activities || []).length}`, {}, requestId);
    logger.info(`   Activities with traffic data: ${activitiesWithTraffic.length}`, {}, requestId);
    
    if (activitiesWithTraffic.length > 0) {
      logger.info(`   Sample traffic data:`, {
        title: activitiesWithTraffic[0].title,
        trafficLevel: activitiesWithTraffic[0].trafficAnalysis?.realTimeTraffic?.trafficLevel || activitiesWithTraffic[0].trafficLevel,
        tags: activitiesWithTraffic[0].tags,
        hasTrafficAnalysis: !!activitiesWithTraffic[0].trafficAnalysis
      }, requestId);
    } else {
      logger.warn(`⚠️ WARNING: No activities have traffic metadata after regeneration!`, {}, requestId);
    }

    // ========================================================================
    // 9. CREATE TRAFFIC SNAPSHOT
    // ========================================================================
    logger.info(`\n📸 Creating traffic snapshot...`, {}, requestId);
    
    const trafficSnapshot = await itineraryRefreshService.createTrafficSnapshot(
      activityCoordinates
    );

    logger.info(`✅ Traffic snapshot created`, {}, requestId);

    // ========================================================================
    // 10. ENRICH WITH TRAFFIC & UPDATE DATABASE
    // ========================================================================
    logger.info(`\n💾 Preparing database update...`, {}, requestId);
    
    const enrichedItineraryData = await enrichItineraryWithTraffic(regeneratedItinerary);
    
    // 🔍 CRITICAL DEBUG: Log data before database update
    logger.info('\n📝 DATA BEING SENT TO DATABASE:', {}, requestId);
    logger.info('Database update payload shapes', { trafficSnapshot: trafficSnapshot ? 'EXISTS' : 'NULL', trafficSnapshotPreview: trafficSnapshot ? JSON.stringify(trafficSnapshot).substring(0, 100) : '' }, requestId);
    logger.info('   activityCoordinates:', { detail: activityCoordinates ? `EXISTS (${activityCoordinates.length} coords)` : 'NULL/UNDEFINED' }, requestId);
    logger.info('   refreshMetadata.trafficSnapshot:', { detail: trafficSnapshot ? 'EXISTS' : 'NULL/UNDEFINED' }, requestId);
    logger.info('   refreshMetadata.refreshCount:', { detail: ((itinerary.refreshMetadata?.refreshCount || 0) + 1) }, requestId);

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
        autoRefreshEnabled: itinerary.refreshMetadata?.autoRefreshEnabled ?? false
      },
      activityCoordinates
    });

    if (!updatedItinerary) {
      logger.info('❌ Failed to update itinerary in database', {}, requestId);
      return NextResponse.json(
        { 
          success: false, 
          message: 'Update failed', 
          error: 'Failed to save updated itinerary. Please try again.' 
        },
        { status: 500 }
      );
    }

    logger.info(`✅ Itinerary updated in database`, {}, requestId);

    // ========================================================================
    // 11. SUCCESS RESPONSE & METRICS
    // ========================================================================
    const duration = Date.now() - startTime;
    logger.info(`\n${'='.repeat(80)}`, {}, requestId);
    logger.info(`✅ REFRESH COMPLETED SUCCESSFULLY - Duration: ${duration}ms`, {}, requestId);
    logger.info(`${'='.repeat(80)}`, {}, requestId);
    
    // 📊 Production Metrics
    logger.info('\n📊 REFRESH METRICS:', {}, requestId);
    logger.info(`   Total Duration: ${duration}ms`, {}, requestId);
    logger.info(`   Severity: ${evaluation.severity}`, {}, requestId);
    logger.info(`   Confidence: ${evaluation.confidence}%`, {}, requestId);
    logger.info(`   Reasons: ${evaluation.reasons.join(', ')}`, {}, requestId);
    logger.info(`   Activities Count: ${updatedItinerary.itineraryData?.items?.flatMap((i: any) => i.activities || []).length || 0}`, {}, requestId);
    logger.info(`   Refresh Count: ${updatedItinerary.refreshMetadata?.refreshCount || 0}`, {}, requestId);
    logger.info('', {}, requestId);

    return NextResponse.json({
      success: true,
      message: itineraryRefreshService.getChangeSummary(evaluation),
      evaluation,
      updatedItinerary
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Refresh failed', { durationMs: duration, errorType: error instanceof Error ? error.constructor.name : typeof error, stack: error instanceof Error ? error.stack : 'none' }, requestId);
    
    // Determine error category for better client handling
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('AbortError');
    const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('ECONNREFUSED');
    const isGenerationError = errorMessage.includes('Generation') || errorMessage.includes('Gemini');
    
    logger.error('Refresh error classification', { isTimeout, isNetworkError, isGenerationError, message: errorMessage.substring(0, 100) }, requestId);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Refresh failed', 
        error: 'Internal server error',
        details: {
          duration: `${duration}ms`,
          category: isTimeout ? 'timeout' : isNetworkError ? 'network' : isGenerationError ? 'generation' : 'unknown',
          timestamp: new Date().toISOString()
        }
      },
      { status: 500 }
    );
  }
  }, (res) => res.status);
});

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
      logger.error('❌ Invalid itinerary structure - missing items array', { entryPoint: 'refresh' });
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
    logger.error('❌ Error transforming itinerary structure:', { entryPoint: 'refresh', detail: error });
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
  logger.info('\n🚗 TRAFFIC ENRICHMENT: Starting...', { entryPoint: 'refresh' });
  
  if (!itinerary?.items || itinerary.items.length === 0) {
    logger.info('⚠️ TRAFFIC ENRICHMENT: No items to enrich', { entryPoint: 'refresh' });
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
      logger.info('ℹ️ enrichItineraryWithTraffic: No activities to enrich', { entryPoint: 'refresh' });
      return itinerary;
    }

    logger.info(`🚦 Enriching ${trafficInput.length} unique activities with real-time traffic data...`, { entryPoint: 'refresh' });
    const trafficProcessStartTime = Date.now();
    const { enhancedActivities } = await parallelTrafficProcessor.processActivitiesUltraFast(trafficInput as any);
    const trafficProcessDuration = Date.now() - trafficProcessStartTime;
    logger.info(`✅ Traffic processing completed in ${trafficProcessDuration}ms`, { entryPoint: 'refresh' });

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
    logger.info(`✅ TRAFFIC ENRICHMENT: Completed in ${enrichmentDuration}ms`, { entryPoint: 'refresh' });
    logger.info(`📊 Traffic Enhancement Stats:`, { entryPoint: 'refresh', totalActivities: itinerary.items.flatMap((p: any) => p.activities || []).length,
      uniqueProcessed: trafficInput.length,
      enhancedCount: enhancedActivities.length,
      metadataMapSize: metadataMap.size,
      duration: `${enrichmentDuration}ms`
    });
    
    return itinerary;
  } catch (error) {
    const enrichmentDuration = Date.now() - enrichmentStartTime;
    logger.error(`❌ TRAFFIC ENRICHMENT FAILED after ${enrichmentDuration}ms:`, { entryPoint: 'refresh', detail: error });
    logger.error('Stack trace:', { entryPoint: 'refresh', detail: error instanceof Error ? error.stack : 'No stack trace' });
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
 * Regenerate itinerary via the authenticated generation endpoint.
 * Internal HTTP call: the caller's credential is forwarded (see
 * forwardCallerCredential) because server-to-server fetch attaches nothing.
 */
async function regenerateItinerary(
  originalItinerary: SavedItinerary,
  currentWeather: any,
  activityCoordinates: Array<{ lat: number; lon: number; name: string }>,
  evaluation: ChangeDetectionResult,
  request: NextRequest
): Promise<any> {
  try {
    logger.info('🔄 Calling itinerary generation API...', { entryPoint: 'refresh' });

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
      logger.error('❌ Invalid baseUrl constructed:', { entryPoint: 'refresh', detail: baseUrl });
      logger.error('Environment variables:', { entryPoint: 'refresh', NEXTAUTH_URL: process.env.NEXTAUTH_URL ? 'SET' : 'NOT SET',
        VERCEL_URL: process.env.VERCEL_URL ? 'SET' : 'NOT SET',
        VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL ? 'SET' : 'NOT SET',
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL
      });
      throw new Error('Critical: Base URL cannot be determined. Set NEXTAUTH_URL environment variable.');
    }
    
    logger.info(`📡 Calling generation API: ${baseUrl}/api/gemini/itinerary-generator`, { entryPoint: 'refresh' });
    logger.info(`🔍 Environment - NEXTAUTH_URL: ${process.env.NEXTAUTH_URL ? 'SET' : 'NOT SET'}, VERCEL_URL: ${process.env.VERCEL_URL ? 'SET' : 'NOT SET'}`, { entryPoint: 'refresh' });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000); // 55s timeout (under Vercel limit)

    logger.info('📤 Refresh Request Payload:', { entryPoint: 'refresh', prompt: prompt.substring(0, 100) + '...',
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
        'x-bypass-cache': 'true', // Additional cache bypass flag
        // The generator is an authenticated endpoint (withAuth). This is a
        // server-to-server call, so the browser's session cookie is not
        // attached automatically — forward the caller's credential or the
        // request 401s and every refresh fails. Bench tokens win when
        // present (k6 path); otherwise the session cookie is forwarded.
        ...forwardCallerCredential(request),
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
      logger.error(`❌ Generation API Error (${response.status}):`, { entryPoint: 'refresh', detail: errorText });
      logger.error(`❌ Request URL: ${baseUrl}/api/gemini/itinerary-generator`, { entryPoint: 'refresh' });
      throw new Error(`Generation API returned ${response.status}: ${errorText.substring(0, 200)}`);
    }

    const result = await response.json();
    
    if (result.error) {
      logger.error('❌ Generation API Error:', { entryPoint: 'refresh', detail: result.error });
      logger.error('Error details:', { entryPoint: 'refresh', errorType: result.errorType,
        requestId: result.requestId,
        retryable: result.retryable
      });
      throw new Error(result.error);
    }

    logger.info('✅ Itinerary generated successfully', { entryPoint: 'refresh' });
    logger.info('📊 Generation Stats:', { entryPoint: 'refresh', hasText: !!result.text,
      resultType: typeof result,
      keys: Object.keys(result)
    });
    
    // ✅ CRITICAL: Transform to frontend-compatible structure
    const transformedItinerary = transformItineraryStructure(result);
    logger.info('✅ Itinerary transformed for frontend compatibility', { entryPoint: 'refresh' });
    
    return transformedItinerary;

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error('❌ Generation timeout after 55 seconds', { entryPoint: 'refresh' });
      throw new Error('Generation timeout - please try again');
    }
    logger.error('❌ Error regenerating itinerary:', { entryPoint: 'refresh', detail: error });
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
