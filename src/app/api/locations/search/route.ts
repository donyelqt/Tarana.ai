import { NextRequest, NextResponse } from 'next/server';
import { LocationSearchResponse, SearchResult, BoundingBox } from '@/types/route-optimization';
import { tomtomRoutingService } from '@/lib/services/tomtomRouting';
import { handleApiError } from '@/lib/errors/handleApiError';
import { timedHttp } from '@/lib/observability/httpMetrics';
import { logger } from '@/lib/observability/logger';
import { getRequestId } from '@/middleware/requestId';
import { createRateLimitMiddleware, rateLimitConfigs } from '@/lib/security/rateLimiter';
/**
 * GET /api/locations/search
 * Search for locations with autocomplete functionality
 */
export async function GET(request: NextRequest) {
  return timedHttp('/api/locations/search', 'GET', async () => {
    const requestId = getRequestId(request);
    const limited = createRateLimitMiddleware(rateLimitConfigs.api)(request);
    if (!limited.allowed) {
      const res = NextResponse.json({ error: 'Rate limit exceeded. Please slow down your requests.' }, { status: 429 });
      if (limited.retryAfter) res.headers.set('Retry-After', String(limited.retryAfter));
      return res;
    }
    try {
    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get('q');
    const boundsParam = searchParams.get('bounds');

    // Bound the query: unbounded q fans out to paid TomTom on every keystroke.
    const query = (rawQuery ?? '').trim().slice(0, 200);
    // Validate query parameter
    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required and must be at least 2 characters' },
        { status: 400 }
      );
    }

    logger.info(
      'Location search started',
      { entryPoint: '/api/locations/search', queryLength: query.length },
      requestId
    );
    // Parse bounds if provided
    let bounds: BoundingBox | undefined;
    if (boundsParam) {
      try {
        const boundsData = JSON.parse(boundsParam);
        const nums = [boundsData?.topLeft?.lat, boundsData?.topLeft?.lng, boundsData?.bottomRight?.lat, boundsData?.bottomRight?.lng];
        if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n))) throw new Error('non-numeric bounds');
        bounds = {
          topLeft: { lat: boundsData.topLeft.lat, lng: boundsData.topLeft.lng },
          bottomRight: { lat: boundsData.bottomRight.lat, lng: boundsData.bottomRight.lng }
        };
      } catch (error) {
        logger.warn(
          'Invalid location bounds',
          { entryPoint: '/api/locations/search', hasBounds: true },
          requestId
        );
      }
    }

    // Forward the browser's Referer so TomTom's Referer allowlist accepts the
    // server-side call.
    const forwardedReferer = request.headers.get('referer') || request.headers.get('origin') || undefined;

    // Search for locations using TomTom service
    const searchResults = await tomtomRoutingService.searchLocations(query.trim(), bounds, forwardedReferer);
    
    // Generate search suggestions based on results
    const suggestions = generateSearchSuggestions(searchResults, query);
    
    // Calculate bounds for results
    const resultsBounds = calculateResultsBounds(searchResults);

    const response: LocationSearchResponse = {
      results: searchResults,
      suggestions,
      bounds: resultsBounds,
      query: query.trim(),
      totalResults: searchResults.length
    };

    logger.info(
      'Location search completed',
      { entryPoint: '/api/locations/search', resultCount: searchResults.length },
      requestId
    );

    return NextResponse.json(response);

  } catch (error) {
    return handleApiError(error, request);
  }
  }, (res) => res.status);
}

/**
 * Generate search suggestions based on results and query
 */
function generateSearchSuggestions(results: SearchResult[], query: string): string[] {
  const suggestions: string[] = [];
  const queryLower = query.toLowerCase();
  
  // Add common location types if query is short
  if (query.length <= 3) {
    const commonTypes = [
      'university', 'hotel', 'restaurant', 'park', 'mall', 'hospital',
      'school', 'church', 'bank', 'pharmacy', 'gas station', 'airport'
    ];
    
    commonTypes.forEach(type => {
      if (type.startsWith(queryLower)) {
        suggestions.push(`${query} ${type}`);
      }
    });
  }
  
  // Add variations based on results
  const categories = new Set<string>();
  results.forEach(result => {
    if (result.category && !categories.has(result.category)) {
      categories.add(result.category);
      suggestions.push(`${query} ${result.category.toLowerCase()}`);
    }
  });
  
  // Add Baguio-specific suggestions
  const baguioSuggestions = [
    'Session Road', 'Burnham Park', 'Baguio Cathedral', 'Wright Park',
    'The Mansion', 'Mines View Park', 'Camp John Hay', 'SM City Baguio',
    'University of the Cordilleras', 'Saint Louis University', 'Strawberry Farm'
  ];
  
  baguioSuggestions.forEach(suggestion => {
    if (suggestion.toLowerCase().includes(queryLower)) {
      suggestions.push(suggestion);
    }
  });
  
  // Remove duplicates and limit to 5 suggestions
  return Array.from(new Set(suggestions)).slice(0, 5);
}

/**
 * Calculate bounding box that contains all search results
 */
function calculateResultsBounds(results: SearchResult[]): BoundingBox {
  if (results.length === 0) {
    // Default to Baguio City bounds
    return {
      topLeft: { lat: 16.45, lng: 120.55 },
      bottomRight: { lat: 16.35, lng: 120.65 }
    };
  }
  
  let minLat = results[0].coordinates.lat;
  let maxLat = results[0].coordinates.lat;
  let minLng = results[0].coordinates.lng;
  let maxLng = results[0].coordinates.lng;
  
  results.forEach(result => {
    minLat = Math.min(minLat, result.coordinates.lat);
    maxLat = Math.max(maxLat, result.coordinates.lat);
    minLng = Math.min(minLng, result.coordinates.lng);
    maxLng = Math.max(maxLng, result.coordinates.lng);
  });
  
  // Add some padding
  const latPadding = (maxLat - minLat) * 0.1 || 0.01;
  const lngPadding = (maxLng - minLng) * 0.1 || 0.01;
  
  return {
    topLeft: { 
      lat: maxLat + latPadding, 
      lng: minLng - lngPadding 
    },
    bottomRight: { 
      lat: minLat - latPadding, 
      lng: maxLng + lngPadding 
    }
  };
}