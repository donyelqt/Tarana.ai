/**
 * TomTom Routing Service
 * Comprehensive routing API integration for traffic-aware navigation
 */

import {
  RouteRequest,
  RouteData,
  RouteResponse,
  LocationPoint,
  Coordinates,
  SearchResult,
  GeocodeResult,
  AddressResult,
  BoundingBox,
  RouteSummary,
  RouteInstruction,
  RouteGeometry,
  RouteLeg,
  TrafficLevel
} from '@/types/route-optimization';

// Route Error class for handling routing errors
export class RouteError extends Error {
  public type: string;
  public details?: any;
  public timestamp: Date;
  public retryable: boolean;

  constructor(errorData: {
    type: string;
    message: string;
    details?: any;
    timestamp: Date;
    retryable: boolean;
  }) {
    super(errorData.message);
    this.name = 'RouteError';
    this.type = errorData.type;
    this.details = errorData.details;
    this.timestamp = errorData.timestamp;
    this.retryable = errorData.retryable;
  }
}

interface TomTomRoutingConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  version: string;
  maxAlternatives: number;
}

interface TomTomRouteResponse {
  routes: TomTomRoute[];
  optimizedOrder?: number[];
  formatVersion: string;
}

interface TomTomRoute {
  summary: {
    lengthInMeters: number;
    travelTimeInSeconds: number;
    trafficDelayInSeconds: number;
    trafficLengthInMeters: number;
    departureTime: string;
    arrivalTime: string;
  };
  legs: TomTomRouteLeg[];
  sections?: TomTomRouteSection[];
  guidance?: {
    instructions: TomTomInstruction[];
  };
}

interface TomTomRouteLeg {
  summary: {
    lengthInMeters: number;
    travelTimeInSeconds: number;
    trafficDelayInSeconds: number;
  };
  points: Array<{
    latitude: number;
    longitude: number;
  }>;
}

interface TomTomRouteSection {
  startPointIndex: number;
  endPointIndex: number;
  sectionType: string;
  travelMode: string;
}

interface TomTomInstruction {
  routeOffsetInMeters: number;
  travelTimeInSeconds: number;
  point: {
    latitude: number;
    longitude: number;
  };
  instructionType: string;
  street?: string;
  countryCode?: string;
  stateCode?: string;
  junctionType?: string;
  turnAngleInDecimalDegrees?: number;
  roundaboutExitNumber?: string;
  possibleCombineWithNext?: boolean;
  drivingSide?: string;
  maneuver?: string;
  message: string;
}

interface TomTomSearchResponse {
  summary: {
    query: string;
    queryType: string;
    queryTime: number;
    numResults: number;
    offset: number;
    totalResults: number;
    fuzzyLevel: number;
  };
  results: TomTomSearchResult[];
}

interface TomTomSearchResult {
  type: string;
  id: string;
  score: number;
  dist?: number;
  info?: string;
  poi?: {
    name: string;
    categorySet: Array<{ id: number }>;
    categories: string[];
    classifications: Array<{
      code: string;
      names: Array<{ nameLocale: string; name: string }>;
    }>;
  };
  address: {
    streetName?: string;
    streetNumber?: string;
    municipality?: string;
    neighbourhood?: string;
    countrySubdivision?: string;
    countrySubdivisionName?: string;
    postalCode?: string;
    countryCode?: string;
    country?: string;
    countryCodeISO3?: string;
    freeformAddress?: string;
    localName?: string;
  };
  position: {
    lat: number;
    lon: number;
  };
  viewport?: {
    topLeftPoint: { lat: number; lon: number };
    btmRightPoint: { lat: number; lon: number };
  };
  entryPoints?: Array<{
    type: string;
    position: { lat: number; lon: number };
  }>;
}

class TomTomRoutingService {
  private config: TomTomRoutingConfig;
  private cache: Map<string, { data: any; expiry: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.config = {
      apiKey: process.env.TOMTOM_API_KEY || '',
      baseUrl: 'https://api.tomtom.com',
      timeout: 15000,
      version: '1',
      maxAlternatives: 3
    };

    if (!this.config.apiKey) {
      console.warn('⚠️ TomTom API key not found. Routing features will use fallback data.');
    }
  }

  /**
   * Calculate optimal route with traffic analysis
   */
  async calculateRoute(request: RouteRequest): Promise<RouteData> {
    console.log('🗺️ TomTom: Calculating route from', request.origin.name, 'to', request.destination.name);

    if (!this.config.apiKey) {
      throw new RouteError({
        type: 'service_unavailable',
        message: 'TomTom API key not configured',
        timestamp: new Date(),
        retryable: false
      });
    }

    try {
      const cacheKey = this.createCacheKey(request);
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() < cached.expiry) {
        console.log('📋 TomTom: Using cached route data');
        return cached.data;
      }

      const locations = this.buildLocationString(request);
      const routeParams = this.buildRouteParameters(request);
      
      const url = `${this.config.baseUrl}/routing/${this.config.version}/calculateRoute/${locations}/json`;
      
      console.log('🌐 TomTom: Requesting route calculation:', url);

      const response = await this.makeRequest(url, routeParams);
      const routeData = await response.json() as TomTomRouteResponse;

      if (!routeData.routes || routeData.routes.length === 0) {
        throw new RouteError({
          type: 'api_error',
          message: 'No routes found for the given locations',
          timestamp: new Date(),
          retryable: true
        });
      }

      const primaryRoute = this.transformRoute(routeData.routes[0], request);
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: primaryRoute,
        expiry: Date.now() + this.CACHE_DURATION
      });

      console.log('✅ TomTom: Route calculated successfully -', 
        Math.round(primaryRoute.summary.lengthInMeters / 1000), 'km,', 
        Math.round(primaryRoute.summary.travelTimeInSeconds / 60), 'min');

      return primaryRoute;

    } catch (error) {
      console.error('❌ TomTom: Route calculation failed:', error);
      
      if (error instanceof RouteError) {
        throw error;
      }
      
      throw new RouteError({
        type: 'api_error',
        message: `Route calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error,
        timestamp: new Date(),
        retryable: true
      });
    }
  }

  /**
   * Get alternative routes for comparison
   */
  async getAlternativeRoutes(request: RouteRequest): Promise<RouteData[]> {
    console.log('🛣️ TomTom: Getting alternative routes');

    if (!this.config.apiKey) {
      return [];
    }

    try {
      const locations = this.buildLocationString(request);
      const routeParams = {
        ...this.buildRouteParameters(request),
        maxAlternatives: this.config.maxAlternatives.toString(),
        alternativeType: 'anyRoute'
      };
      
      const url = `${this.config.baseUrl}/routing/${this.config.version}/calculateRoute/${locations}/json`;
      
      const response = await this.makeRequest(url, routeParams);
      const routeData = await response.json() as TomTomRouteResponse;

      const alternatives = routeData.routes.slice(1).map((route, index) => {
        const transformed = this.transformRoute(route, request);
        transformed.alternativeRank = index + 2; // Primary is rank 1
        return transformed;
      });

      console.log(`✅ TomTom: Found ${alternatives.length} alternative routes`);
      return alternatives;

    } catch (error) {
      console.error('❌ TomTom: Alternative routes calculation failed:', error);
      return [];
    }
  }

  /**
   * Search locations with autocomplete
   */
  async searchLocations(query: string, bounds?: BoundingBox): Promise<SearchResult[]> {
    console.log('🔍 TomTom: Searching for locations:', query);

    if (!this.config.apiKey || !query.trim()) {
      return [];
    }

    try {
      const cacheKey = `search_${query}_${bounds ? JSON.stringify(bounds) : 'global'}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() < cached.expiry) {
        return cached.data;
      }

      const params = new URLSearchParams({
        key: this.config.apiKey,
        query: query.trim(),
        limit: '10',
        countrySet: 'PH', // Focus on Philippines
        language: 'en-US'
      });

      // Add bounds if provided
      if (bounds) {
        params.append('topLeft', `${bounds.topLeft.lat},${bounds.topLeft.lng}`);
        params.append('btmRight', `${bounds.bottomRight.lat},${bounds.bottomRight.lng}`);
      } else {
        // Default to Baguio area
        params.append('lat', '16.4023');
        params.append('lon', '120.5960');
        params.append('radius', '50000'); // 50km radius
      }

      const url = `${this.config.baseUrl}/search/2/search/${encodeURIComponent(query)}.json`;
      
      const response = await this.makeRequest(url, Object.fromEntries(params));
      const searchData = await response.json() as TomTomSearchResponse;

      const results = searchData.results.map(this.transformSearchResult);
      
      // Cache results for 1 hour
      this.cache.set(cacheKey, {
        data: results,
        expiry: Date.now() + 60 * 60 * 1000
      });

      console.log(`✅ TomTom: Found ${results.length} locations for "${query}"`);
      return results;

    } catch (error) {
      console.error('❌ TomTom: Location search failed:', error);
      return [];
    }
  }

  /**
   * Reverse geocoding - coordinates to address
   */
  async reverseGeocode(coordinates: Coordinates): Promise<AddressResult | null> {
    console.log('🏠 TomTom: Reverse geocoding:', coordinates);

    if (!this.config.apiKey) {
      return null;
    }

    try {
      const cacheKey = `reverse_${coordinates.lat.toFixed(6)}_${coordinates.lng.toFixed(6)}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() < cached.expiry) {
        return cached.data;
      }

      const params = new URLSearchParams({
        key: this.config.apiKey,
        language: 'en-US'
      });

      const url = `${this.config.baseUrl}/search/2/reverseGeocode/${coordinates.lat},${coordinates.lng}.json`;
      
      const response = await this.makeRequest(url, Object.fromEntries(params));
      const data = await response.json() as TomTomSearchResponse;

      if (!data.results || data.results.length === 0) {
        return null;
      }

      const result = this.transformAddressResult(data.results[0]);
      
      // Cache for 24 hours (addresses don't change often)
      this.cache.set(cacheKey, {
        data: result,
        expiry: Date.now() + 24 * 60 * 60 * 1000
      });

      return result;

    } catch (error) {
      console.error('❌ TomTom: Reverse geocoding failed:', error);
      return null;
    }
  }

  /**
   * Batch geocoding for multiple addresses
   */
  async batchGeocode(addresses: string[]): Promise<GeocodeResult[]> {
    console.log('📍 TomTom: Batch geocoding', addresses.length, 'addresses');

    const results: GeocodeResult[] = [];

    for (const address of addresses) {
      try {
        const searchResults = await this.searchLocations(address);
        results.push({
          query: address,
          results: searchResults,
          status: searchResults.length > 0 ? 'success' : 'failed'
        });
      } catch (error) {
        results.push({
          query: address,
          results: [],
          status: 'failed'
        });
      }
    }

    return results;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private createCacheKey(request: RouteRequest): string {
    const key = JSON.stringify({
      origin: `${request.origin.lat},${request.origin.lng}`,
      destination: `${request.destination.lat},${request.destination.lng}`,
      waypoints: request.waypoints?.map(w => `${w.lat},${w.lng}`),
      preferences: request.preferences
    });
    return btoa(key).slice(0, 32); // Use base64 hash for cache key
  }

  private buildLocationString(request: RouteRequest): string {
    const locations = [
      `${request.origin.lat},${request.origin.lng}`,
      ...(request.waypoints?.map(w => `${w.lat},${w.lng}`) || []),
      `${request.destination.lat},${request.destination.lng}`
    ];
    return locations.join(':');
  }

  private buildRouteParameters(request: RouteRequest): Record<string, string> {
    const params: Record<string, string> = {
      key: this.config.apiKey,
      traffic: 'true',
      travelMode: this.getVehicleType(request.preferences.vehicleType),
      routeType: this.getRouteType(request.preferences.routeType),
      instructionsType: 'text',
      language: 'en-US',
      computeBestOrder: 'false',
      computeTravelTimeFor: 'all',
      sectionType: 'traffic'
    };

    // Add departure time if specified
    if (request.preferences.departureTime) {
      params.departAt = request.preferences.departureTime.toISOString();
    }

    // Add avoidance parameters
    const avoid: string[] = [];
    if (request.preferences.avoidTolls) avoid.push('tollRoads');
    if (request.preferences.avoidHighways) avoid.push('motorways');
    if (request.preferences.avoidFerries) avoid.push('ferries');
    if (request.preferences.avoidTrafficJams) avoid.push('unpavedRoads');
    
    if (avoid.length > 0) {
      params.avoid = avoid.join(',');
    }

    return params;
  }

  private getVehicleType(vehicleType?: string): string {
    switch (vehicleType) {
      case 'truck': return 'truck';
      case 'motorcycle': return 'motorcycle';
      case 'bicycle': return 'bicycle';
      default: return 'car';
    }
  }

  private getRouteType(routeType: string): string {
    switch (routeType) {
      case 'shortest': return 'shortest';
      case 'eco': return 'eco';
      case 'thrilling': return 'thrilling';
      default: return 'fastest';
    }
  }

  private async makeRequest(url: string, params: Record<string, string>): Promise<Response> {
    const fullUrl = `${url}?${new URLSearchParams(params).toString()}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(fullUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Tarana.ai/1.0'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`TomTom API error: ${response.status} ${response.statusText}`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private transformRoute(tomtomRoute: TomTomRoute, request: RouteRequest): RouteData {
    const routeId = `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Transform summary
    const summary: RouteSummary = {
      lengthInMeters: tomtomRoute.summary.lengthInMeters,
      travelTimeInSeconds: tomtomRoute.summary.travelTimeInSeconds,
      trafficDelayInSeconds: tomtomRoute.summary.trafficDelayInSeconds || 0,
      departureTime: tomtomRoute.summary.departureTime,
      arrivalTime: tomtomRoute.summary.arrivalTime,
      routeType: request.preferences.routeType
    };

    // Transform instructions
    const instructions: RouteInstruction[] = (tomtomRoute.guidance?.instructions || []).map((instr, index) => ({
      id: `instruction_${index}`,
      instruction: instr.message,
      distance: index < (tomtomRoute.guidance?.instructions.length || 0) - 1 
        ? (tomtomRoute.guidance?.instructions[index + 1]?.routeOffsetInMeters || 0) - instr.routeOffsetInMeters
        : 0,
      time: instr.travelTimeInSeconds,
      coordinates: {
        lat: instr.point.latitude,
        lng: instr.point.longitude
      },
      maneuver: instr.maneuver || instr.instructionType,
      streetName: instr.street || '',
      direction: this.getDirectionFromAngle(instr.turnAngleInDecimalDegrees),
      exitNumber: instr.roundaboutExitNumber
    }));

    // Transform geometry
    const allPoints: Coordinates[] = [];
    tomtomRoute.legs.forEach(leg => {
      leg.points.forEach(point => {
        allPoints.push({
          lat: point.latitude,
          lng: point.longitude
        });
      });
    });

    const geometry: RouteGeometry = {
      coordinates: allPoints,
      type: 'LineString'
    };

    // Transform legs
    const legs: RouteLeg[] = tomtomRoute.legs.map((leg, index) => ({
      startLocation: index === 0 ? request.origin : request.waypoints![index - 1],
      endLocation: index === tomtomRoute.legs.length - 1 ? request.destination : request.waypoints![index],
      summary: {
        lengthInMeters: leg.summary.lengthInMeters,
        travelTimeInSeconds: leg.summary.travelTimeInSeconds,
        trafficDelayInSeconds: leg.summary.trafficDelayInSeconds || 0,
        departureTime: tomtomRoute.summary.departureTime,
        arrivalTime: tomtomRoute.summary.arrivalTime,
        routeType: request.preferences.routeType
      },
      instructions: instructions.filter(instr => {
        // Filter instructions for this leg (simplified logic)
        return true; // In a real implementation, you'd filter by leg boundaries
      }),
      geometry: {
        coordinates: leg.points.map(p => ({ lat: p.latitude, lng: p.longitude })),
        type: 'LineString'
      }
    }));

    return {
      id: routeId,
      summary,
      legs,
      geometry,
      instructions,
      confidence: 0.9 // Default confidence score
    };
  }

  private transformSearchResult = (result: TomTomSearchResult): SearchResult => ({
    id: result.id,
    name: result.poi?.name || result.address.freeformAddress || 'Unknown Location',
    address: result.address.freeformAddress || '',
    coordinates: {
      lat: result.position.lat,
      lng: result.position.lon
    },
    category: result.poi?.categories?.[0] || 'Location',
    relevanceScore: result.score,
    popularityIndex: Math.min(result.score * 10, 100),
    distance: result.dist,
    placeType: result.type
  });

  private transformAddressResult(result: TomTomSearchResult): AddressResult {
    return {
      formattedAddress: result.address.freeformAddress || '',
      streetName: result.address.streetName,
      streetNumber: result.address.streetNumber,
      municipality: result.address.municipality,
      countrySubdivision: result.address.countrySubdivision,
      country: result.address.country,
      postalCode: result.address.postalCode,
      coordinates: {
        lat: result.position.lat,
        lng: result.position.lon
      }
    };
  }

  private getDirectionFromAngle(angle?: number): string {
    if (!angle) return '';
    
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(((angle % 360) + 360) % 360 / 45) % 8;
    return directions[index];
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    let cleared = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (now >= value.expiry) {
        this.cache.delete(key);
        cleared++;
      }
    }
    
    if (cleared > 0) {
      console.log(`🧹 TomTom Routing: Cleared ${cleared} expired cache entries`);
    }
  }
}

// Export singleton instance
export const tomtomRoutingService = new TomTomRoutingService();