import { NextRequest, NextResponse } from 'next/server';
import {
  RouteRequest,
  RouteCalculationResponse,
  RouteData,
  RouteTrafficAnalysis,
  RouteRecommendation
} from '@/types/route-optimization';
import { tomtomRoutingService } from '@/lib/services/tomtomRouting';
import { routeTrafficAnalyzer } from '@/lib/services/routeTrafficAnalysis';
import { handleApiError } from '@/lib/errors/handleApiError';
import { timedHttp } from '@/lib/observability/httpMetrics';
import { logger } from '@/lib/observability/logger';
import { getRequestId } from '@/middleware/requestId';

const LOG_ENTRY_POINT = '/api/routes/calculate';

/**
 * POST /api/routes/calculate
 * Calculate optimal route with traffic analysis
 */
export async function POST(request: NextRequest) {
  return timedHttp(LOG_ENTRY_POINT, 'POST', async () => {
  const correlationId = getRequestId(request);
  try {
    const body = await request.json();
    const routeRequest: RouteRequest = body;
    // Validate required fields
    if (!routeRequest.origin || !routeRequest.destination) {
      return NextResponse.json(
        { error: 'Origin and destination are required' },
        { status: 400 }
      );
    }

    if (!routeRequest.origin.lat || !routeRequest.origin.lng ||
        !routeRequest.destination.lat || !routeRequest.destination.lng) {
      return NextResponse.json(
        { error: 'Valid coordinates are required for origin and destination' },
        { status: 400 }
      );
    }

    const responseRequestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.info(
      'Route calculation started',
      { entryPoint: LOG_ENTRY_POINT, waypointCount: routeRequest.waypoints?.length ?? 0 },
      correlationId
    );

    // Forward the browser's Referer so TomTom's Referer allowlist accepts the
    // server-side call (the browser already sends an allowed Referer for the map).
    const forwardedReferer = request.headers.get('referer') || request.headers.get('origin') || undefined;

    // Calculate primary route
    const primaryRoute = await tomtomRoutingService.calculateRoute(routeRequest, forwardedReferer);
    logger.info(
      'Primary route calculated',
      { entryPoint: LOG_ENTRY_POINT, routeIdLength: primaryRoute.id.length },
      correlationId
    );

    // Calculate alternative routes (parallel to traffic analysis)
    const [alternativeRoutes, trafficAnalysis] = await Promise.all([
      tomtomRoutingService.getAlternativeRoutes(routeRequest, forwardedReferer).catch(() => {
        logger.warn('Alternative routes unavailable', { entryPoint: LOG_ENTRY_POINT }, correlationId);
        return [];
      }),
      routeTrafficAnalyzer.analyzeRouteTraffic(primaryRoute).catch(() => {
        logger.warn(
          'Traffic analysis unavailable; using fallback',
          { entryPoint: LOG_ENTRY_POINT, fallback: true },
          correlationId
        );
        return createFallbackTrafficAnalysis(primaryRoute);
      })
    ]);

    logger.info(
      'Route analysis completed',
      { entryPoint: LOG_ENTRY_POINT, alternativeCount: alternativeRoutes.length, congestionScore: trafficAnalysis.congestionScore },
      correlationId
    );

    // Analyze alternative routes traffic if available
    let alternativeAnalyses: RouteTrafficAnalysis[] = [];
    if (alternativeRoutes.length > 0) {
      alternativeAnalyses = await Promise.all(
        alternativeRoutes.map((route, index) =>
          routeTrafficAnalyzer.analyzeRouteTraffic(route).catch(() => {
            logger.warn(
              'Alternative route traffic analysis unavailable; using fallback',
              { entryPoint: LOG_ENTRY_POINT, alternativeIndex: index, fallback: true },
              correlationId
            );
            return createFallbackTrafficAnalysis(route);
          })
        )
      );
    }

    // Generate route comparison and recommendations
    let routeComparison = null;
    let recommendations: RouteRecommendation[] = [];

    if (alternativeRoutes.length > 0) {
      try {
        routeComparison = await routeTrafficAnalyzer.compareRouteTraffic([
          primaryRoute,
          ...alternativeRoutes
        ]);
        
        recommendations = [routeComparison.recommendation];
        logger.info(
          'Route comparison completed',
          { entryPoint: LOG_ENTRY_POINT, recommendationCount: recommendations.length },
          correlationId
        );
      } catch {
        logger.warn('Route comparison unavailable', { entryPoint: LOG_ENTRY_POINT }, correlationId);
    }
  }

    // Generate general recommendations based on traffic analysis
    if (recommendations.length === 0) {
      recommendations = generateTrafficRecommendations(trafficAnalysis, primaryRoute);
    }

    // Build response
    const response: RouteCalculationResponse = {
      primaryRoute,
      alternativeRoutes,
      trafficAnalysis,
      recommendations,
      geocodedLocations: {
        origin: routeRequest.origin,
        destination: routeRequest.destination,
        waypoints: routeRequest.waypoints || []
      },
      requestId: responseRequestId,
      timestamp: new Date()
    };

    // Add alternative analyses to response if available
    if (alternativeAnalyses.length > 0) {
      (response as any).alternativeAnalyses = alternativeAnalyses;
    }

    // Add comparison metrics if available
    if (routeComparison) {
      (response as any).comparisonMetrics = routeComparison.comparisonMetrics;
    }

    logger.info(
      'Route calculation completed',
      {
        entryPoint: LOG_ENTRY_POINT,
        alternativeCount: alternativeRoutes.length,
        hasAlternativeAnalyses: alternativeAnalyses.length > 0,
        hasComparison: routeComparison !== null,
      },
      correlationId
    );

    return NextResponse.json(response);

  } catch (error) {
    return handleApiError(error, request);
  }
  }, (res) => res.status);
}

/**
 * Create fallback traffic analysis when primary analysis fails
 */
function createFallbackTrafficAnalysis(route: RouteData): RouteTrafficAnalysis {
  return {
    overallTrafficLevel: 'MODERATE',
    segmentAnalysis: [],
    estimatedDelay: 300, // 5 minutes default delay
    alternativeRecommendation: false,
    peakHourImpact: {
      isCurrentlyPeakHour: false,
      peakHourMultiplier: 1.0,
      expectedTrafficIncrease: 0,
      historicalAverage: route.summary.travelTimeInSeconds / 60
    },
    historicalComparison: {
      typicalTravelTime: route.summary.travelTimeInSeconds,
      currentVsTypical: 1.1,
      weekdayPattern: [1.0, 0.8, 0.9, 1.2, 1.4, 1.3, 0.7],
      hourlyPattern: Array.from({ length: 24 }, (_, i) => {
        // Generate realistic hourly pattern
        if (i >= 7 && i <= 9) return 1.5; // Morning rush
        if (i >= 17 && i <= 19) return 1.6; // Evening rush
        if (i >= 12 && i <= 14) return 1.2; // Lunch
        if (i >= 22 || i <= 5) return 0.6; // Night
        return 1.0;
      })
    },
    congestionScore: 50,
    recommendationScore: 60,
    lastUpdated: new Date()
  };
}

/**
 * Generate traffic-based recommendations
 */
function generateTrafficRecommendations(trafficAnalysis: RouteTrafficAnalysis, route: RouteData) {
  const recommendations = [];
  
  if (trafficAnalysis.recommendationScore >= 80) {
    recommendations.push({
      type: 'primary' as const,
      reason: 'Excellent traffic conditions with minimal delays',
      message: 'Perfect time to travel - low congestion and clear roads',
      priority: 'high' as const
    });
  } else if (trafficAnalysis.recommendationScore >= 60) {
    recommendations.push({
      type: 'primary' as const,
      reason: 'Good traffic conditions with some minor delays',
      message: 'Good time to travel with moderate traffic conditions',
      priority: 'medium' as const
    });
  } else if (trafficAnalysis.recommendationScore >= 40) {
    recommendations.push({
      type: 'alternative' as const,
      reason: 'Moderate traffic - consider waiting or alternative routes',
      message: 'Consider delaying departure or finding alternative routes',
      priority: 'medium' as const
    });
  } else {
    recommendations.push({
      type: 'avoid' as const,
      reason: 'Heavy traffic conditions with significant delays',
      message: 'Avoid traveling now - heavy congestion expected',
      priority: 'high' as const
    });
  }
  
  // Add peak hour warnings
  if (trafficAnalysis.peakHourImpact.isCurrentlyPeakHour) {
    recommendations.push({
      type: 'alternative' as const,
      reason: 'Currently in peak traffic hours',
      message: `Traffic may be ${Math.round(trafficAnalysis.peakHourImpact.expectedTrafficIncrease)}% heavier than normal`,
      priority: 'medium' as const
    });
  }
  
  // Add incident warnings
  const totalIncidents = trafficAnalysis.segmentAnalysis.reduce(
    (sum, segment) => sum + segment.incidents.length, 
    0
  );
  
  if (totalIncidents > 0) {
    recommendations.push({
      type: 'alternative' as const,
      reason: `${totalIncidents} traffic incident${totalIncidents > 1 ? 's' : ''} detected`,
      message: 'Route may have delays due to traffic incidents',
      priority: totalIncidents > 2 ? 'high' as const : 'medium' as const
    });
  }
  
  return recommendations;
}