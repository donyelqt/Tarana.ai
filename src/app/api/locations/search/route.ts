import { NextRequest, NextResponse } from 'next/server';
import { LocationSearchResponse, SearchResult, BoundingBox } from '@/types/route-optimization';
import { tomtomRoutingService } from '@/lib/services/tomtomRouting';

/**
 * GET /api/locations/search
 * Search for locations with autocomplete functionality
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const boundsParam = searchParams.get('bounds');
    
    // Validate query parameter
    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required and must be at least 2 characters' },
        { status: 400 }
      );
    }

    console.log(`🔍 API: Location search for query: "${query}"`);

    // Parse bounds if provided
    let bounds: BoundingBox | undefined;
    if (boundsParam) {
      try {
        const boundsData = JSON.parse(boundsParam);
        bounds = {
          topLeft: { lat: boundsData.topLeft.lat, lng: boundsData.topLeft.lng },
          bottomRight: { lat: boundsData.bottomRight.lat, lng: boundsData.bottomRight.lng }
        };
      } catch (error) {
        console.warn('⚠️ API: Invalid bounds parameter:', boundsParam);
      }
    }

    // Search for locations using TomTom service
    const searchResults = await tomtomRoutingService.searchLocations(query.trim(), bounds);
    
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

    console.log(`✅ API: Location search completed - ${searchResults.length} results found`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ API: Location search failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'Location search service unavailable' },
          { status: 503 }
        );
      }
      
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }
      
      return NextResponse.json(
        { error: 'Location search failed', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
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