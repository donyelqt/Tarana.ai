
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
import {
  claimIdempotency,
  completeIdempotency,
  getIdempotencyKey,
  hashIdempotencyPayload,
  type IdempotencyClaim,
} from '@/lib/services/idempotencyService';
import { z } from 'zod';
import { getSafeErrorMetadata } from '@/lib/observability/safeErrorMetadata';






function forwardCallerCredential(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  const benchToken = request.headers.get(BENCH_TOKEN_HEADER);
  if (benchToken) {
    
    headers[BENCH_TOKEN_HEADER] = benchToken;
    return headers;
  }
  const cookie = request.headers.get('cookie');
  if (cookie) headers.cookie = cookie;
  return headers;
}




export const maxDuration = 60; 
export const dynamic = 'force-dynamic'; 
export const runtime = 'nodejs'; 





interface RefreshRequest {
  force?: boolean; 
  evaluateOnly?: boolean; 
}

const IDEMPOTENCY_ROUTE = '/api/saved-itineraries/[id]/refresh';
const refreshBodySchema = z.object({ force: z.boolean().optional(), evaluateOnly: z.boolean().optional() }).strict();

interface RefreshResponse {
  success: boolean;
  message: string;
  evaluation?: ChangeDetectionResult;
  updatedItinerary?: SavedItinerary;
  error?: string;
}

type RefreshErrorCategory = 'timeout' | 'network' | 'generation' | 'unknown';

function classifyRefreshError(error: unknown): RefreshErrorCategory {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('timeout') || message.includes('aborted')) return 'timeout';
  if (message.includes('fetch') || message.includes('econnrefused')) return 'network';
  if (message.includes('generation') || message.includes('gemini')) return 'generation';
  return 'unknown';
}





export const GET = withAuth(async (
  request: NextRequest,
  userId: string,
  ...args: unknown[]
): Promise<NextResponse<RefreshResponse>> => {
  const { params } = (args[0] ?? {}) as { params: Promise<{ id: string }> };
  const { id } = await params;
  const requestId = getRequestId(request);
  logger.info('Refresh evaluation requested', { itineraryIdLength: id.length }, requestId);

  return timedHttp('/api/saved-itineraries/[id]/refresh', 'GET', async () => {
  try {

    
    const allItineraries = await getSavedItineraries();
    const itinerary = allItineraries.find(i => i.id === id);

    if (!itinerary) {
      return NextResponse.json(
        { success: false, message: 'Itinerary not found', error: 'Not found' },
        { status: 404 }
      );
    }

    
    const activityCoordinates = extractActivityCoordinates(itinerary);
    if (activityCoordinates.length === 0) {
      activityCoordinates.push({ lat: 16.4023, lon: 120.5960, name: 'Baguio City Center' });
    }

    
    const currentWeather = await fetchWeatherFromAPI();
    if (!currentWeather) {
      return NextResponse.json(
        { success: false, message: 'Weather unavailable', error: 'Service unavailable' },
        { status: 503 }
      );
    }

    
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
    logger.error('Refresh evaluation failed', { entryPoint: 'refresh', ...getSafeErrorMetadata(error) }, requestId);
    return NextResponse.json(
      { success: false, message: 'Evaluation failed', error: 'Internal error' },
      { status: 500 }
    );
  }
  }, (res) => res.status);
});





export const POST = withAuth(async (
  request: NextRequest,
  userId: string,
  ...args: unknown[]
): Promise<NextResponse<RefreshResponse>> => {
  const { params } = (args[0] ?? {}) as { params: Promise<{ id: string }> };
  const { id } = await params;
  const startTime = Date.now();
  const requestId = getRequestId(request);
  logger.info('Itinerary refresh requested', { itineraryIdLength: id.length }, requestId);

  return timedHttp('/api/saved-itineraries/[id]/refresh', 'POST', async () => {
  
  let refreshClaim: IdempotencyClaim | null = null;
  const completeRefresh = async (status: number, body: unknown): Promise<void> => {
    if (refreshClaim?.kind === 'owner') {
      try {
        await completeIdempotency(refreshClaim.rowId, status, body);
      } catch (error) {
        logger.error('[idempotency] failed to complete refresh key', { entryPoint: 'refresh', ...getSafeErrorMetadata(error) }, requestId);
        throw error;
      }
    }
  };
  try {
    
    
    

    
    
    
    let requestBody: RefreshRequest = {};

    try {
      const raw = await request.json();
      const parsed = refreshBodySchema.safeParse(raw);
      if (!parsed.success) {
        return NextResponse.json({ success: false, message: 'Invalid input', error: 'Invalid refresh options' }, { status: 400 });
      }
      requestBody = parsed.data;
      logger.info('Refresh request options received', { force: requestBody.force === true, evaluateOnly: requestBody.evaluateOnly === true }, requestId);
    } catch {
      
      logger.info('Empty refresh request body - using defaults', {}, requestId);
    }

    
    
    const refreshKey = getIdempotencyKey(request);
    refreshClaim = refreshKey
      ? await claimIdempotency(userId, IDEMPOTENCY_ROUTE, refreshKey, hashIdempotencyPayload({ id, ...requestBody }))
      : null;
    if (refreshClaim?.kind === 'replay') {
      return NextResponse.json(refreshClaim.replay.body as RefreshResponse, { status: refreshClaim.replay.status });
    }
    if (refreshClaim?.kind === 'conflict') {
      const res = NextResponse.json({ success: false, message: 'Request is already being processed' } as RefreshResponse, { status: 409 });
      res.headers.set('Retry-After', '1');
      return res;
    }
    if (refreshClaim?.kind === 'payload-mismatch') {
      return NextResponse.json({ success: false, message: 'Idempotency key was already used with a different payload' } as RefreshResponse, { status: 422 });
    }

    
    
    
    logger.info('Fetching itinerary', { itineraryIdLength: id.length }, requestId);
    
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

    logger.info('Itinerary found', { itineraryIdLength: id.length }, requestId);

    
    
    
    logger.info(`\n📍 Extracting activity coordinates...`, {}, requestId);
    
    const activityCoordinates = extractActivityCoordinates(itinerary);
    
    if (activityCoordinates.length === 0) {
      logger.info('⚠️ No activity coordinates found - using Baguio center', {}, requestId);
      activityCoordinates.push({ lat: 16.4023, lon: 120.5960, name: 'Baguio City Center' });
    }
    
    logger.info(`✅ Found ${activityCoordinates.length} activity locations`, {}, requestId);

    
    
    
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

    logger.info('Weather fetched', { entryPoint: 'refresh', available: true }, requestId);

    
    
    
    logger.info(`\n🔍 Evaluating refresh need...`, {}, requestId);
    
    const evaluation = await itineraryRefreshService.evaluateRefreshNeed(
      itinerary,
      currentWeather,
      activityCoordinates
    );

    logger.info('Refresh evaluation completed', {
      entryPoint: 'refresh',
      needsRefresh: evaluation.needsRefresh,
      severity: evaluation.severity,
      confidence: evaluation.confidence,
      reasonCount: evaluation.reasons.length,
    }, requestId);

    
    
    
    if (requestBody.evaluateOnly) {
      const body = { success: true, message: itineraryRefreshService.getChangeSummary(evaluation), evaluation };
      await completeRefresh(200, body);
      return NextResponse.json(body);
    }
    const shouldRefresh = requestBody.force || evaluation.needsRefresh;

    if (!shouldRefresh) {
      const body = { success: true, message: itineraryRefreshService.getChangeSummary(evaluation), evaluation };
      logger.info('✅ No refresh needed - returning evaluation only', {}, requestId);
      await completeRefresh(200, body);
      return NextResponse.json(body);
    }

    logger.info(`\n🔄 Proceeding with itinerary refresh...`, {}, requestId);
    if (requestBody.force) logger.info(`   Reason: Force refresh requested`, {}, requestId);
    if (evaluation.needsRefresh) logger.info(`   Reason: Significant changes detected`, {}, requestId);

    
    
    
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
      logger.error('Regeneration failed', { entryPoint: 'refresh', ...getSafeErrorMetadata(regenerationError) }, requestId);
      const regenFailure = {
        success: false,
        message: 'Generation failed',
        error: 'Failed to generate an updated itinerary',
        details: { phase: 'regeneration' }
      };
      await completeRefresh(500, regenFailure);
      return NextResponse.json(regenFailure, { status: 500 });
    }

    if (!regeneratedItinerary || !regeneratedItinerary.items) {
      logger.error('Invalid regenerated itinerary structure', {}, requestId);
      const invalidBody = {
        success: false,
        message: 'Generation failed',
        error: 'Generated itinerary has invalid structure. Please try again.',
        details: {
          phase: 'validation',
          received: regeneratedItinerary ? 'partial data' : 'null'
        }
      };
      await completeRefresh(500, invalidBody);
      return NextResponse.json(invalidBody, { status: 500 });
    }

    logger.info('✅ Itinerary regenerated successfully', {}, requestId);
    
    
    const activitiesWithTraffic = regeneratedItinerary.items
      .flatMap((item: any) => item.activities || [])
      .filter((activity: any) => activity.trafficAnalysis || activity.trafficLevel);
    
    logger.info('Traffic metadata check', {
      entryPoint: 'refresh',
      totalActivities: regeneratedItinerary.items.flatMap((item: any) => item.activities || []).length,
      activitiesWithTraffic: activitiesWithTraffic.length,
    }, requestId);

    if (activitiesWithTraffic.length > 0) {
      logger.info('Traffic metadata present', {
        entryPoint: 'refresh',
        trafficLevel: activitiesWithTraffic[0].trafficAnalysis?.realTimeTraffic?.trafficLevel || activitiesWithTraffic[0].trafficLevel,
        hasTrafficAnalysis: !!activitiesWithTraffic[0].trafficAnalysis,
      }, requestId);
    } else {
      logger.warn('No activities have traffic metadata after regeneration', { entryPoint: 'refresh' }, requestId);
    }


    
    
    
    logger.info(`\n📸 Creating traffic snapshot...`, {}, requestId);
    
    const trafficSnapshot = await itineraryRefreshService.createTrafficSnapshot(
      activityCoordinates
    );

    logger.info(`✅ Traffic snapshot created`, {}, requestId);

    
    
    
    logger.info(`\n💾 Preparing database update...`, {}, requestId);
    
    const enrichedItineraryData = await enrichItineraryWithTraffic(regeneratedItinerary);
    
    
    logger.info('\n📝 DATA BEING SENT TO DATABASE:', {}, requestId);
    logger.info('Database update payload validated', {
      entryPoint: 'refresh',
      hasTrafficSnapshot: Boolean(trafficSnapshot),
      activityCoordinateCount: activityCoordinates.length,
      hasTrafficSnapshotMetadata: Boolean(trafficSnapshot),
      nextRefreshCount: (itinerary.refreshMetadata?.refreshCount || 0) + 1,
    }, requestId);

    const updatedItinerary = await updateItinerary(id, {
      
      title: itinerary.title,
      date: itinerary.date,
      budget: itinerary.budget,
      tags: itinerary.tags,
      formData: itinerary.formData, 
      
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
      const updateFailure = {
        success: false,
        message: 'Update failed',
        error: 'Failed to save updated itinerary. Please try again.'
      };
      await completeRefresh(500, updateFailure);
      return NextResponse.json(updateFailure, { status: 500 });
    }

    logger.info(`✅ Itinerary updated in database`, {}, requestId);

    
    
    
    const duration = Date.now() - startTime;
    logger.info(`\n${'='.repeat(80)}`, {}, requestId);
    logger.info(`✅ REFRESH COMPLETED SUCCESSFULLY - Duration: ${duration}ms`, {}, requestId);
    logger.info(`${'='.repeat(80)}`, {}, requestId);
    
    
    logger.info('\n📊 REFRESH METRICS:', {}, requestId);
    logger.info(`   Total Duration: ${duration}ms`, {}, requestId);
    logger.info(`   Severity: ${evaluation.severity}`, {}, requestId);
    logger.info(`   Confidence: ${evaluation.confidence}%`, {}, requestId);
    logger.info('Refresh metrics', { entryPoint: 'refresh', reasonCount: evaluation.reasons.length }, requestId);
    logger.info(`   Activities Count: ${updatedItinerary.itineraryData?.items?.flatMap((i: any) => i.activities || []).length || 0}`, {}, requestId);
    logger.info(`   Refresh Count: ${updatedItinerary.refreshMetadata?.refreshCount || 0}`, {}, requestId);
    logger.info('', {}, requestId);

    const successBody: RefreshResponse = {
      success: true,
      message: itineraryRefreshService.getChangeSummary(evaluation),
      evaluation,
      updatedItinerary
    };
    await completeRefresh(200, successBody);
    return NextResponse.json(successBody);

  } catch (error) {
    const duration = Date.now() - startTime;
    const category = classifyRefreshError(error);
    logger.error('Refresh failed', { entryPoint: 'refresh', durationMs: duration, category, ...getSafeErrorMetadata(error) }, requestId);

    const safeDetails = {
      duration: `${duration}ms`,
      category,
      timestamp: new Date().toISOString()
    };

    const failureBody = {
      success: false,
      message: 'Refresh failed',
      error: 'Internal server error',
      details: safeDetails
    };
    await completeRefresh(500, failureBody);
    return NextResponse.json(failureBody, { status: 500 });
  }
  }, (res) => res.status);
});






function transformItineraryStructure(apiResponse: any): any {
  try {
    let itineraryData;
    
    
    if (apiResponse.text) {
      
      itineraryData = JSON.parse(apiResponse.text);
    } else if (apiResponse.itinerary) {
      
      itineraryData = apiResponse.itinerary;
    } else {
      
      itineraryData = apiResponse;
    }
    
    
    if (!itineraryData.items || !Array.isArray(itineraryData.items)) {
      logger.error('❌ Invalid itinerary structure - missing items array', { entryPoint: 'refresh' });
      return {
        title: "Refreshed Itinerary",
        subtitle: "Updated with current conditions",
        items: []
      };
    }
    
    
    
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
            : (activity.image?.src || activity.image || "/images/placeholders/default-itinerary.jpg"),
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
    logger.error('Error transforming itinerary structure', { entryPoint: 'refresh', ...getSafeErrorMetadata(error) });
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
    logger.error('Traffic enrichment failed', { entryPoint: 'refresh', durationMs: enrichmentDuration, ...getSafeErrorMetadata(error) });
    
    return itinerary;
  }
}


function extractActivityCoordinates(
  itinerary: SavedItinerary
): Array<{ lat: number; lon: number; name: string }> {
  const coordinates: Array<{ lat: number; lon: number; name: string }> = [];

  
  if (itinerary.activityCoordinates && itinerary.activityCoordinates.length > 0) {
    return itinerary.activityCoordinates;
  }

  
  if (itinerary.itineraryData && itinerary.itineraryData.items) {
    for (const period of itinerary.itineraryData.items) {
      for (const activity of period.activities) {
        
        
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

  
  const seen = new Set();
  const uniqueCoordinates = coordinates.filter(coord => {
    const key = `${coord.lat},${coord.lon}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return uniqueCoordinates;
}


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
    
    
    const prompt = buildRefreshPrompt(originalItinerary, evaluation);

    
    const getBaseUrl = (): string => {
      
      if (process.env.NEXTAUTH_URL) {
        return process.env.NEXTAUTH_URL;
      }
      
      
      if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
      }
      
      
      if (process.env.VERCEL === '1' && process.env.VERCEL_BRANCH_URL) {
        return `https://${process.env.VERCEL_BRANCH_URL}`;
      }
      
      
      return 'http://localhost:3000';
    };
    
    const baseUrl = getBaseUrl();
    
    
    if (!baseUrl || baseUrl === 'undefined' || baseUrl.includes('undefined') || baseUrl === 'null') {
      logger.error('Invalid base URL constructed', { entryPoint: 'refresh', hasBaseUrl: Boolean(baseUrl) });
      logger.error('Refresh environment configuration incomplete', {
        entryPoint: 'refresh',
        nextAuthUrlConfigured: Boolean(process.env.NEXTAUTH_URL),
        vercelUrlConfigured: Boolean(process.env.VERCEL_URL),
        vercelBranchUrlConfigured: Boolean(process.env.VERCEL_BRANCH_URL),
      });
      throw new Error('Critical: Base URL cannot be determined. Set NEXTAUTH_URL environment variable.');
    }
    
    logger.info('Calling itinerary generator', { entryPoint: 'refresh', target: 'itinerary-generator' });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000); 

    logger.info('Refresh generation request prepared', {
      entryPoint: 'refresh',
      promptLength: prompt.length,
      interestCount: formData.selectedInterests?.length ?? 0,
      duration: parseInt(formData.duration) || 1,
      hasWeather: Boolean(currentWeather),
      isRefresh: true,
    });

    const idempotencyKey = getIdempotencyKey(request);

    const response = await fetch(`${baseUrl}/api/gemini/itinerary-generator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-refresh-request': 'true', 
        'x-bypass-cache': 'true', 
        
        
        
        
        
        ...forwardCallerCredential(request),
        
        
        
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
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
      
      logger.error('Generation API request failed', { entryPoint: 'refresh', statusCode: response.status });
      logger.error('Generation API target', { entryPoint: 'refresh', target: 'itinerary-generator' });
      throw new Error(`Generation API returned ${response.status}`);
    }

    const result = await response.json();
    
    if (result.error) {
      logger.error('Generation API returned an error', {
        entryPoint: 'refresh',
        errorType: typeof result.errorType === 'string' ? result.errorType.slice(0, 64) : 'unknown',
        retryable: result.retryable === true,
        upstreamRequestIdLength: typeof result.requestId === 'string' ? result.requestId.length : 0,
      });
      throw new Error('Generation API returned an error');
    }

    logger.info('✅ Itinerary generated successfully', { entryPoint: 'refresh' });
    logger.info('📊 Generation Stats:', { entryPoint: 'refresh', hasText: !!result.text,
      resultType: typeof result,
      keys: Object.keys(result)
    });
    
    
    const transformedItinerary = transformItineraryStructure(result);
    logger.info('✅ Itinerary transformed for frontend compatibility', { entryPoint: 'refresh' });
    
    return transformedItinerary;

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error('❌ Generation timeout after 55 seconds', { entryPoint: 'refresh' });
      throw new Error('Generation timeout - please try again');
    }
    logger.error('Error regenerating itinerary', { entryPoint: 'refresh', ...getSafeErrorMetadata(error) });
    throw error; 
  }
}


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
