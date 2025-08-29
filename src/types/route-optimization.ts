/**
 * Route Optimization System Types
 * Comprehensive TypeScript interfaces for traffic-aware routing
 */

// ============================================================================
// CORE COORDINATE AND LOCATION TYPES
// ============================================================================

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface LocationPoint extends Coordinates {
  id: string;
  name: string;
  address: string;
  category?: string;
  placeId?: string;
  poiType?: string;
}

export interface BoundingBox {
  topLeft: Coordinates;
  bottomRight: Coordinates;
}

// ============================================================================
// ROUTE REQUEST AND PREFERENCES
// ============================================================================

export type RouteType = 'fastest' | 'shortest' | 'eco' | 'thrilling';
export type VehicleType = 'car' | 'truck' | 'motorcycle' | 'bicycle' | 'walk';

export interface RoutePreferences {
  routeType: RouteType;
  origin?: LocationPoint;
  destination?: LocationPoint;
  departureTime?: Date;
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  avoidFerries?: boolean;
  vehicleType?: VehicleType;
  avoidTrafficJams?: boolean;
}

export interface RouteRequest {
  origin: LocationPoint;
  destination: LocationPoint;
  waypoints?: LocationPoint[];
  preferences: RoutePreferences;
}

// ============================================================================
// ROUTE DATA STRUCTURES
// ============================================================================

export interface RouteSummary {
  lengthInMeters: number;
  travelTimeInSeconds: number;
  trafficDelayInSeconds: number;
  departureTime: string;
  arrivalTime: string;
  routeType: RouteType;
  fuelConsumptionInLiters?: number;
  tollCostInCurrency?: number;
}

export interface RouteInstruction {
  id: string;
  instruction: string;
  distance: number;
  time: number;
  coordinates: Coordinates;
  maneuver: string;
  streetName: string;
  direction?: string;
  exitNumber?: string;
}

export interface RouteGeometry {
  coordinates: Coordinates[];
  type: 'LineString';
}

export interface RouteLeg {
  startLocation: LocationPoint;
  endLocation: LocationPoint;
  summary: RouteSummary;
  instructions: RouteInstruction[];
  geometry: RouteGeometry;
}

export interface RouteData {
  id: string;
  summary: RouteSummary;
  legs: RouteLeg[];
  geometry: RouteGeometry;
  instructions: RouteInstruction[];
  alternativeRank?: number;
  confidence?: number;
}

// ============================================================================
// TRAFFIC ANALYSIS TYPES
// ============================================================================

export type TrafficLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';

export interface TrafficIncident {
  id: string;
  iconCategory: number;
  magnitudeOfDelay: number;
  events: Array<{
    description: string;
    code: number;
    iconCategory: number;
  }>;
  startTime: string;
  endTime: string;
  from: string;
  to: string;
  length: number;
  delay: number;
  roadNumbers: string[];
  timeValidity: string;
  coordinates?: Coordinates;
}

export interface RouteSegmentTraffic {
  segmentId: string;
  startCoordinate: Coordinates;
  endCoordinate: Coordinates;
  trafficLevel: TrafficLevel;
  speedKmh: number;
  freeFlowSpeedKmh: number;
  delaySeconds: number;
  incidents: TrafficIncident[];
  roadType: string;
  roadName: string;
}

export interface PeakHourAnalysis {
  isCurrentlyPeakHour: boolean;
  peakHourMultiplier: number;
  expectedTrafficIncrease: number;
  nextPeakHour?: Date;
  historicalAverage: number;
}

export interface TrafficHistoryData {
  typicalTravelTime: number;
  currentVsTypical: number;
  weekdayPattern: number[];
  hourlyPattern: number[];
}

export interface RouteTrafficAnalysis {
  overallTrafficLevel: TrafficLevel;
  segmentAnalysis: RouteSegmentTraffic[];
  estimatedDelay: number;
  alternativeRecommendation: boolean;
  peakHourImpact: PeakHourAnalysis;
  historicalComparison: TrafficHistoryData;
  congestionScore: number;
  recommendationScore: number;
  lastUpdated: Date;
}

// ============================================================================
// ROUTE COMPARISON AND OPTIMIZATION
// ============================================================================

export interface RouteRecommendation {
  type: 'primary' | 'alternative' | 'avoid';
  reason: string;
  timeSavings?: number;
  trafficAdvantage?: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
}

export interface RouteComparison {
  routes: RouteData[];
  trafficAnalyses: RouteTrafficAnalysis[];
  recommendation: RouteRecommendation;
  bestRouteId: string;
  comparisonMetrics: {
    timeDifference: number;
    distanceDifference: number;
    trafficScore: number;
  };
}

export interface RouteEvaluationCriteria {
  travelTime: number;        // Weight: 40%
  trafficConditions: number; // Weight: 30%
  distance: number;          // Weight: 20%
  roadQuality: number;       // Weight: 10%
}

export interface RouteRanking {
  routeId: string;
  rank: number;
  score: number;
  strengths: string[];
  weaknesses: string[];
}

// ============================================================================
// LOCATION SEARCH AND GEOCODING
// ============================================================================

export interface SearchResult {
  id: string;
  name: string;
  address: string;
  coordinates: Coordinates;
  category: string;
  relevanceScore: number;
  popularityIndex: number;
  distance?: number;
  placeType: string;
}

export interface GeocodeResult {
  query: string;
  results: SearchResult[];
  status: 'success' | 'partial' | 'failed';
}

export interface AddressResult {
  formattedAddress: string;
  streetName?: string;
  streetNumber?: string;
  municipality?: string;
  countrySubdivision?: string;
  country?: string;
  postalCode?: string;
  coordinates: Coordinates;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface RouteResponse {
  routes: RouteData[];
  status: 'success' | 'partial' | 'failed';
  message?: string;
}

export interface RouteCalculationResponse {
  primaryRoute: RouteData;
  alternativeRoutes: RouteData[];
  trafficAnalysis: RouteTrafficAnalysis;
  recommendations: RouteRecommendation[];
  geocodedLocations: {
    origin: LocationPoint;
    destination: LocationPoint;
    waypoints: LocationPoint[];
  };
  requestId: string;
  timestamp: Date;
}

export interface LocationSearchResponse {
  results: SearchResult[];
  suggestions: string[];
  bounds: BoundingBox;
  query: string;
  totalResults: number;
}

export interface RouteMonitoringResponse {
  monitoringId: string;
  routeId: string;
  currentStatus: RouteStatus;
  estimatedUpdates: Date[];
  alertsEnabled: boolean;
}

// ============================================================================
// REAL-TIME MONITORING TYPES
// ============================================================================

export interface RouteStatus {
  isActive: boolean;
  progress: number; // 0-100
  currentLocation?: Coordinates;
  nextInstruction?: RouteInstruction;
  estimatedTimeRemaining: number;
  trafficAlerts: TrafficAlert[];
}

export interface TrafficAlert {
  id: string;
  type: 'incident' | 'congestion' | 'road_closure' | 'weather';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  affectedSegments: string[];
  alternativeAvailable: boolean;
  estimatedDelay: number;
  timestamp: Date;
}

export interface RouteUpdate {
  routeId: string;
  updateType: 'traffic' | 'incident' | 'reroute' | 'eta';
  newTrafficData?: RouteTrafficAnalysis;
  newRoute?: RouteData;
  alerts: TrafficAlert[];
  timestamp: Date;
}

// ============================================================================
// COMPONENT STATE TYPES
// ============================================================================

export interface RouteOptimizationState {
  currentRoute: RouteData | null;
  alternativeRoutes: RouteData[];
  routePreferences: RoutePreferences;
  trafficConditions: RouteTrafficAnalysis | null;
  isCalculating: boolean;
  isMonitoring: boolean;
  mapCenter: Coordinates;
  mapZoom: number;
  selectedWaypoints: LocationPoint[];
  searchResults: SearchResult[];
  activeSearchField: 'origin' | 'destination' | null;
  error: string | null;
  lastUpdated: Date | null;
}

export interface MapVisualizationConfig {
  container: HTMLElement;
  center: Coordinates;
  zoom: number;
  style: 'basic_main' | 'driving' | 'satellite';
  trafficFlow: boolean;
  trafficIncidents: boolean;
  routeColors: {
    primary: string;
    alternative: string;
    traffic: {
      free: string;
      slow: string;
      congested: string;
      blocked: string;
    };
  };
  lineWeights: {
    primary: number;
    alternative: number;
    traffic: number;
  };
}

// ============================================================================
// EVENT HANDLERS AND CALLBACKS
// ============================================================================

export interface MapEventHandlers {
  onRouteClick: (segment: RouteSegmentTraffic) => void;
  onWaypointDrag: (waypoint: LocationPoint, newPosition: Coordinates) => void;
  onMapClick: (coordinates: Coordinates) => void;
  onAlternativeRouteHover: (route: RouteData) => void;
  onTrafficIncidentClick: (incident: TrafficIncident) => void;
}

export interface RouteCalculationCallbacks {
  onRouteCalculated: (response: RouteCalculationResponse) => void;
  onCalculationError: (error: string) => void;
  onTrafficUpdate: (update: RouteUpdate) => void;
  onAlternativeRouteSelected: (route: RouteData) => void;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface RouteError {
  type: 'api_error' | 'validation_error' | 'network_error' | 'rate_limit' | 'service_unavailable';
  message: string;
  details?: any;
  timestamp: Date;
  retryable: boolean;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type RouteCalculationStatus = 'idle' | 'calculating' | 'success' | 'error';
export type MapLoadingState = 'loading' | 'loaded' | 'error';
export type TrafficDataFreshness = 'fresh' | 'stale' | 'expired';