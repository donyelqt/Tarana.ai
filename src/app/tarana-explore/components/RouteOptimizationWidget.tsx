"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  RouteOptimizationState,
  RouteRequest,
  RouteData,
  LocationPoint,
  RoutePreferences,
  RouteTrafficAnalysis,
  RouteComparison,
  Coordinates,
  SearchResult,
  RouteCalculationCallbacks
} from '@/types/route-optimization';
import { BAGUIO_COORDINATES } from '@/lib/core/utils';
import { Route, Navigation, MapPin, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ErrorBoundary from '@/components/ui/error-boundary';
import TrafficLegend from '@/components/ui/TrafficLegend';
import { Card } from '@/components/ui/card';
import {
  getTrafficColorFromScore,
  getTrafficLevelFromScore,
  getTrafficLevelClasses,
  formatTrafficDelay,
  getTrafficRecommendation
} from '@/lib/utils/trafficColors';

// Component imports (will be created next)
import RouteInputPanel from './route/RouteInputPanel';
import InteractiveRouteMap from './route/InteractiveRouteMap';
import RouteDetailsPanel from './route/RouteDetailsPanel';

// Demo-ready Baguio locations for AI hackathon presentation
const POPULAR_LOCATIONS: LocationPoint[] = [
  {
    id: 'uc_baguio',
    name: 'University of the Cordilleras',
    address: 'Gov. Pack Rd, Baguio City',
    lat: 16.4088,
    lng: 120.5979,
    category: 'Education'
  },
  {
    id: 'newtown_plaza',
    name: 'New Town Plaza Hotel',
    address: 'Navy Base Road, Baguio City',
    lat: 16.4158,
    lng: 120.6122,
    category: 'Hotel'
  },
  {
    id: 'burnham_park',
    name: 'Burnham Park',
    address: 'Downtown Baguio City',
    lat: 16.4095,
    lng: 120.5948,
    category: 'Park'
  },
  {
    id: 'sm_baguio',
    name: 'SM City Baguio',
    address: 'Upper Session Rd, Baguio City',
    lat: 16.4088,
    lng: 120.5993,
    category: 'Shopping'
  },
  {
    id: 'session_road',
    name: 'Session Road',
    address: 'Session Rd, Baguio City',
    lat: 16.4124,
    lng: 120.5973,
    category: 'Shopping'
  },
  {
    id: 'baguio_cathedral',
    name: 'Baguio Cathedral',
    address: 'Cathedral Loop, Baguio City',
    lat: 16.4138,
    lng: 120.5934,
    category: 'Landmark'
  },
  {
    id: 'camp_john_hay',
    name: 'Camp John Hay',
    address: 'Loakan Rd, Baguio City',
    lat: 16.4025,
    lng: 120.5897,
    category: 'Recreation'
  },
  {
    id: 'mines_view_park',
    name: 'Mines View Park',
    address: 'Mines View Park Rd, Baguio City',
    lat: 16.4089,
    lng: 120.5678,
    category: 'Tourist Spot'
  }
];

const RouteOptimizationWidget: React.FC = () => {
  // Main state management
  const [state, setState] = useState<RouteOptimizationState>({
    currentRoute: null,
    alternativeRoutes: [],
    routePreferences: {
      routeType: 'fastest',
      avoidTrafficJams: true,
      vehicleType: 'car'
    },
    trafficConditions: null,
    isCalculating: false,
    isMonitoring: false,
    mapCenter: { lat: BAGUIO_COORDINATES.lat, lng: BAGUIO_COORDINATES.lon },
    mapZoom: 14,
    selectedWaypoints: [],
    searchResults: [],
    activeSearchField: null,
    error: null,
    lastUpdated: null
  });

  // Separate state for origin and destination
  const [origin, setOrigin] = useState<LocationPoint | null>(null);
  const [destination, setDestination] = useState<LocationPoint | null>(null);

  // Component refs
  const mapRef = useRef<any>(null);
  const calculationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Route comparison state
  const [routeComparison, setRouteComparison] = useState<RouteComparison | null>(null);
  const [showAlternatives, setShowAlternatives] = useState(false);

  // Widget visibility and animation
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  // Key to force re-render when routes change
  const [routeKey, setRouteKey] = useState(0);

  // ============================================================================
  // ROUTE CALCULATION HANDLERS
  // ============================================================================

  const handleRouteCalculation = useCallback(async (request: RouteRequest) => {
    console.log('🚀 Route Widget: Starting route calculation');

    // COMPLETELY RESET ALL ROUTE DATA before new calculation to prevent accumulation
    setState(prev => ({
      ...prev,
      currentRoute: null,
      alternativeRoutes: [],
      trafficConditions: null,
      isCalculating: true,
      isMonitoring: false,
      selectedWaypoints: [],
      searchResults: [],
      activeSearchField: null,
      error: null,
      lastUpdated: null
    }));

    // Clear origin and destination state
    setOrigin(null);
    setDestination(null);

    // Clear route comparison state
    setRouteComparison(null);

    // Force React to flush all state updates before continuing
    await new Promise(resolve => setImmediate(resolve));

    // Now set the new origin and destination
    setOrigin(request.origin);
    setDestination(request.destination);

    try {
      // Call route calculation API
      const response = await fetch('/api/routes/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Route calculation failed: ${response.statusText}`);
      }

      const data = await response.json();

      // Update state with NEW results, ensuring old routes are completely replaced
      setState(prev => ({
        ...prev,
        currentRoute: data.primaryRoute,
        alternativeRoutes: data.alternativeRoutes ? [...data.alternativeRoutes] : [],
        trafficConditions: data.trafficAnalysis,
        lastUpdated: new Date(),
        isCalculating: false
      }));

      // Set route comparison if alternatives exist
      if (data.alternativeRoutes && data.alternativeRoutes.length > 0) {
        setRouteComparison({
          routes: [data.primaryRoute, ...data.alternativeRoutes],
          trafficAnalyses: [data.trafficAnalysis, ...data.alternativeAnalyses || []],
          recommendation: data.recommendations?.[0] || {
            type: 'primary',
            reason: 'Best available route',
            message: 'Recommended based on current traffic conditions',
            priority: 'medium'
          },
          bestRouteId: data.primaryRoute.id,
          comparisonMetrics: data.comparisonMetrics || {
            timeDifference: 0,
            distanceDifference: 0,
            trafficScore: data.trafficAnalysis?.congestionScore || 50
          }
        });
      } else {
        // Ensure route comparison is cleared if no alternatives
        setRouteComparison(null);
      }

      console.log('✅ Route Widget: Route calculation completed successfully');

    } catch (error) {
      console.error('❌ Route Widget: Route calculation failed:', error);

      let errorMessage = 'Route calculation failed';

      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          errorMessage = 'TomTom API key not configured. Please add TOMTOM_API_KEY to your environment variables.';
        } else if (error.message.includes('rate limit')) {
          errorMessage = 'Rate limit exceeded. Please try again in a few minutes.';
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error. Please check your internet connection.';
        } else {
          errorMessage = error.message;
        }
      }

      // On error, ensure complete reset
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isCalculating: false,
        currentRoute: null,
        alternativeRoutes: [],
        trafficConditions: null
      }));

      // Clear route comparison on error
      setRouteComparison(null);
    }
  }, []);

  const handleQuickRoute = useCallback((origin: LocationPoint, destination: LocationPoint) => {
    const request: RouteRequest = {
      origin,
      destination,
      preferences: state.routePreferences
    };

    handleRouteCalculation(request);
  }, [state.routePreferences, handleRouteCalculation]);

  // ============================================================================
  // STATE MANAGEMENT HANDLERS
  // ============================================================================

  const updateRoutePreferences = useCallback((preferences: Partial<RoutePreferences>) => {
    setState(prev => ({
      ...prev,
      routePreferences: { ...prev.routePreferences, ...preferences }
    }));
  }, []);

  const handleLocationSelect = useCallback((location: LocationPoint, field: 'origin' | 'destination') => {
    setState(prev => ({
      ...prev,
      activeSearchField: null
    }));
  }, []);

  const handleWaypointAdd = useCallback((waypoint: LocationPoint) => {
    setState(prev => ({
      ...prev,
      selectedWaypoints: [...prev.selectedWaypoints, waypoint]
    }));
  }, []);

  const handleWaypointRemove = useCallback((waypointId: string) => {
    setState(prev => ({
      ...prev,
      selectedWaypoints: prev.selectedWaypoints.filter(w => w.id !== waypointId)
    }));
  }, []);

  const handleAlternativeRouteSelect = useCallback((route: RouteData) => {
    setState(prev => {
      // Safety check: Don't proceed if route is already current
      if (prev.currentRoute?.id === route.id) {
        console.log('Route is already selected as primary');
        return prev;
      }

      // Preserve the original primary route by adding it to alternatives
      const newAlternatives = [...prev.alternativeRoutes];

      // Add current primary route to alternatives if it exists and isn't already there
      if (prev.currentRoute && !newAlternatives.find(r => r.id === prev.currentRoute!.id)) {
        newAlternatives.push(prev.currentRoute);
      }

      // Remove the newly selected route from alternatives to prevent duplication
      const filteredAlternatives = newAlternatives.filter(r => r.id !== route.id);

      // Additional safety: Ensure no route appears in both current and alternatives
      const finalAlternatives = filteredAlternatives.filter(r => r.id !== route.id);

      console.log(`🔄 Route switching: ${prev.currentRoute?.id} → ${route.id}`);
      console.log(`📋 Alternative routes maintained: ${finalAlternatives.length}`);

      return {
        ...prev,
        currentRoute: route,
        alternativeRoutes: finalAlternatives
      };
    });

    // Update route comparison with new best route
    if (routeComparison) {
      setRouteComparison(prev => prev ? {
        ...prev,
        bestRouteId: route.id
      } : null);
    }
  }, [routeComparison]);

  // ============================================================================
  // REAL-TIME MONITORING
  // ============================================================================

  const startRouteMonitoring = useCallback(async () => {
    if (!state.currentRoute) return;

    setState(prev => ({ ...prev, isMonitoring: true }));

    try {
      const response = await fetch('/api/routes/monitor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          routeId: state.currentRoute.id,
          monitoringDuration: 60, // 1 hour
          alertThresholds: {
            delayMinutes: 5,
            trafficLevelChange: true
          }
        }),
      });

      if (response.ok) {
        console.log('✅ Route Widget: Route monitoring started');
      }
    } catch (error) {
      console.error('❌ Route Widget: Failed to start monitoring:', error);
      setState(prev => ({ ...prev, isMonitoring: false }));
    }
  }, [state.currentRoute]);

  const stopRouteMonitoring = useCallback(() => {
    setState(prev => ({ ...prev, isMonitoring: false }));
    console.log('🛑 Route Widget: Route monitoring stopped');
  }, []);

  // ============================================================================
  // EFFECTS AND CLEANUP
  // ============================================================================

  useEffect(() => {
    // Cleanup timeout on unmount
    return () => {
      if (calculationTimeoutRef.current) {
        clearTimeout(calculationTimeoutRef.current);
      }
    };
  }, []);

  // Auto-refresh traffic data every 5 minutes
  useEffect(() => {
    if (!state.currentRoute) return;

    const refreshInterval = setInterval(async () => {
      try {
        console.log('🔄 Route Widget: Refreshing traffic data');
        // Refresh traffic analysis without recalculating route
        if (state.currentRoute) {
          try {
            const response = await fetch(`/api/routes/traffic-analysis/${state.currentRoute.id}`);
            if (response.ok) {
              const trafficData = await response.json();
              setState(prev => ({
                ...prev,
                trafficConditions: trafficData,
                lastUpdated: new Date()
              }));
            } else {
              console.warn('⚠️ Route Widget: Failed to refresh traffic data - HTTP', response.status);
            }
          } catch (error) {
            console.warn('⚠️ Route Widget: Failed to refresh traffic data:', error);
          }
        }
      } catch (error) {
        console.warn('⚠️ Route Widget: Failed to refresh traffic data:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(refreshInterval);
  }, [state.currentRoute]);

  // ============================================================================
  // RENDER METHODS
  // ============================================================================

  const renderHeader = () => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div className="flex items-center space-x-3">
        <div className="flex items-center justify-center w-10 h-10 bg-[#0066FF] rounded-xl shadow-md">
          <Route className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-semibold text-xl text-gray-900 tracking-tight">Route Optimization</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Smart traffic-aware navigation for Baguio City
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {state.isCalculating && (
          <div className="flex items-center space-x-2 text-[#0066FF]">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#0066FF] border-t-transparent"></div>
            <span className="text-sm font-medium">Analyzing...</span>
          </div>
        )}

        {state.trafficConditions && (
          <div className="flex items-center space-x-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center space-x-2">
              <div
                className="w-2.5 h-2.5 rounded-full animate-pulse"
                style={{
                  backgroundColor: getTrafficColorFromScore(state.trafficConditions.congestionScore).color
                }}
              />
              <span className={`font-medium text-sm ${getTrafficLevelClasses(getTrafficLevelFromScore(state.trafficConditions.congestionScore))}`}>
                {getTrafficLevelFromScore(state.trafficConditions.congestionScore)} Traffic
              </span>
            </div>
            <div className="hidden sm:flex items-center space-x-1 text-gray-700">
              <TrendingUp className="w-4 h-4 text-[#0066FF]" />
              <span className="text-sm font-medium">
                {state.trafficConditions.congestionScore}% congestion
              </span>
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMinimized(!isMinimized)}
          className="h-8 w-8 text-gray-400 hover:text-gray-600"
          aria-label={isMinimized ? "Expand" : "Minimize"}
        >
          {isMinimized ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          )}
        </Button>
      </div>
    </div>
  );


  const renderError = () => {
    if (!state.error) return null;

    return (
      <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-medium text-red-900 text-sm">Route Calculation Failed</h4>
            <p className="text-sm text-red-700 mt-1">{state.error}</p>
            <button
              onClick={() => setState(prev => ({ ...prev, error: null }))}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline underline-offset-2"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Main render
  if (isMinimized) {
    return (
      <div className="mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          {renderHeader()}
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Route Optimization Widget Error:', error, errorInfo);
      }}
    >
      <div className="mb-6">
        <Card className="overflow-hidden">
          <div className="p-6">
            {renderHeader()}
            {renderError()}

            <div className="space-y-6">
              {/* Route Input Panel */}
              <div>
                <ErrorBoundary fallback={
                  <div className="p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-700 text-sm">Failed to load route input panel. Please refresh the page.</p>
                  </div>
                }>
                  <RouteInputPanel
                    preferences={state.routePreferences}
                    onPreferencesChange={updateRoutePreferences}
                    onRouteCalculate={handleRouteCalculation}
                    isCalculating={state.isCalculating}
                    popularLocations={POPULAR_LOCATIONS}
                    selectedWaypoints={state.selectedWaypoints}
                    onWaypointAdd={handleWaypointAdd}
                    onWaypointRemove={handleWaypointRemove}
                    origin={origin}
                    destination={destination}
                    onOriginChange={setOrigin}
                    onDestinationChange={setDestination}
                  />
                </ErrorBoundary>
              </div>

              {/* Interactive Map */}
              <div>
                <div className="h-[400px] sm:h-[500px] md:h-[550px] lg:h-[600px] bg-gray-100 rounded-xl overflow-hidden relative">
                  <ErrorBoundary fallback={
                    <div className="h-full flex items-center justify-center p-4 sm:p-8">
                      <div className="text-center">
                        <AlertTriangle className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-2 sm:mb-4" />
                        <p className="text-gray-600 text-xs sm:text-sm">Failed to load interactive map</p>
                      </div>
                    </div>
                  }>
                    <InteractiveRouteMap
                      currentRoute={state.currentRoute}
                      alternativeRoutes={state.alternativeRoutes}
                      trafficConditions={state.trafficConditions}
                      origin={origin}
                      destination={destination}
                      waypoints={state.selectedWaypoints}
                      onRouteSelect={(routeId: string) => {
                        console.log('🗺️ Map route selection triggered:', routeId);

                        // Safety check: Don't proceed if route is already current
                        if (state.currentRoute?.id === routeId) {
                          console.log('Selected route is already the primary route');
                          return;
                        }

                        // Find the selected route in all available routes
                        const allRoutes = [state.currentRoute, ...state.alternativeRoutes].filter(Boolean);
                        const selectedRoute = allRoutes.find(route => route?.id === routeId);

                        if (selectedRoute) {
                          console.log(`✅ Found route ${routeId}, switching to primary`);
                          // Use the proper handler that preserves all routes
                          handleAlternativeRouteSelect(selectedRoute);
                        } else {
                          console.warn(`❌ Route ${routeId} not found in available routes`);
                        }
                      }}
                      isLoading={state.isCalculating}
                    />
                  </ErrorBoundary>
                </div>
              </div>
            </div>

            {/* Route Details Panel - Full Width Below Grid */}
            {(state.currentRoute || state.alternativeRoutes.length > 0) && (
              <div className="mt-6">
                <ErrorBoundary fallback={
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-red-700 text-sm">Failed to load route details. Please refresh the page.</p>
                  </div>
                }>
                  <RouteDetailsPanel
                    currentRoute={state.currentRoute}
                    alternativeRoutes={state.alternativeRoutes}
                    trafficAnalysis={state.trafficConditions}
                    routeComparison={routeComparison}
                    onRouteSelect={handleAlternativeRouteSelect}
                    onStartMonitoring={startRouteMonitoring}
                    onStopMonitoring={stopRouteMonitoring}
                    isMonitoring={state.isMonitoring}
                    showAlternatives={showAlternatives}
                    onToggleAlternatives={() => setShowAlternatives(!showAlternatives)}
                    lastUpdated={state.lastUpdated}
                  />
                </ErrorBoundary>
              </div>
            )}
          </div>
        </Card>
      </div>
    </ErrorBoundary>
  );
};

export default RouteOptimizationWidget;