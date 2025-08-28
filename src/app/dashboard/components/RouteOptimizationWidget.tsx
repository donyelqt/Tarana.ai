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
import { BAGUIO_COORDINATES } from '@/lib/utils';
import { Route, Navigation, MapPin, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import ErrorBoundary from '@/components/ui/error-boundary';

// Component imports (will be created next)
import RouteInputPanel from './route/RouteInputPanel';
import InteractiveRouteMap from './route/InteractiveRouteMap';
import RouteDetailsPanel from './route/RouteDetailsPanel';

// Default Baguio locations for quick selection
const POPULAR_LOCATIONS: LocationPoint[] = [
  {
    id: 'uc_baguio',
    name: 'University of the Cordilleras',
    address: 'Gov. Pack Rd, Baguio, Benguet',
    lat: 16.4088,
    lng: 120.5979,
    category: 'Education'
  },
  {
    id: 'newtown_plaza',
    name: 'New Town Plaza Hotel Baguio',
    address: 'Navy Base Road, Baguio, Benguet',
    lat: 16.4158,
    lng: 120.6122,
    category: 'Hotel'
  },
  {
    id: 'burnham_park',
    name: 'Burnham Park',
    address: 'Jose Abad Santos Dr, Baguio, Benguet',
    lat: 16.4095,
    lng: 120.5948,
    category: 'Park'
  },
  {
    id: 'sm_baguio',
    name: 'SM City Baguio',
    address: 'Upper Session Rd, Baguio, Benguet',
    lat: 16.4088,
    lng: 120.5993,
    category: 'Shopping'
  },
  {
    id: 'session_road',
    name: 'Session Road',
    address: 'Session Rd, Baguio, Benguet',
    lat: 16.4124,
    lng: 120.5973,
    category: 'Shopping'
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

  // Component refs
  const mapRef = useRef<any>(null);
  const calculationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Route comparison state
  const [routeComparison, setRouteComparison] = useState<RouteComparison | null>(null);
  const [showAlternatives, setShowAlternatives] = useState(false);

  // Widget visibility and animation
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  // ============================================================================
  // ROUTE CALCULATION HANDLERS
  // ============================================================================

  const handleRouteCalculation = useCallback(async (request: RouteRequest) => {
    console.log('🚀 Route Widget: Starting route calculation');
    
    setState(prev => ({
      ...prev,
      isCalculating: true,
      error: null,
      currentRoute: null,
      alternativeRoutes: [],
      trafficConditions: null
    }));

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

      // Update state with results
      setState(prev => ({
        ...prev,
        currentRoute: data.primaryRoute,
        alternativeRoutes: data.alternativeRoutes || [],
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
        // Clear route comparison if no alternatives
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
    setState(prev => ({
      ...prev,
      currentRoute: route,
      alternativeRoutes: prev.alternativeRoutes.filter(r => r.id !== route.id)
    }));

    // Update route comparison
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
    <div className="flex items-center justify-between mb-6 px-1">
      <div className="flex items-center space-x-3">
        <div className="flex items-center justify-center w-10 h-10 bg-blue-500 rounded-lg">
          <Route className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-semibold text-xl text-gray-900">Route Optimization</h2>
          <p className="text-sm text-gray-500">Find the fastest route avoiding traffic</p>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        {state.isCalculating && (
          <div className="flex items-center space-x-2 text-blue-600">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
            <span className="text-sm font-medium">Calculating...</span>
          </div>
        )}
        
        {state.trafficConditions && (
          <div className="flex items-center space-x-2 text-gray-600">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">
              {state.trafficConditions.congestionScore}% congestion
            </span>
          </div>
        )}
        
        <button
          onClick={() => setIsMinimized(!isMinimized)}
          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
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
        </button>
      </div>
    </div>
  );

  const renderQuickRoutes = () => (
    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <h3 className="font-medium text-sm text-blue-900 mb-3">Quick Routes</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => handleQuickRoute(POPULAR_LOCATIONS[0], POPULAR_LOCATIONS[1])}
          className="text-left p-3 bg-white rounded-lg border border-blue-300 hover:bg-blue-50 transition-colors"
          disabled={state.isCalculating}
        >
          <div className="flex items-center space-x-2">
            <Navigation className="w-4 h-4 text-blue-600" />
            <div>
              <div className="font-medium text-sm text-gray-900">UC to New Town Plaza</div>
              <div className="text-xs text-gray-600">Popular route</div>
            </div>
          </div>
        </button>
        
        <button
          onClick={() => handleQuickRoute(POPULAR_LOCATIONS[2], POPULAR_LOCATIONS[3])}
          className="text-left p-3 bg-white rounded-lg border border-blue-300 hover:bg-blue-50 transition-colors"
          disabled={state.isCalculating}
        >
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-green-600" />
            <div>
              <div className="font-medium text-sm text-gray-900">Burnham to SM City</div>
              <div className="text-xs text-gray-600">Shopping route</div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );

  const renderError = () => {
    if (!state.error) return null;

    return (
      <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <div>
            <h4 className="font-medium text-red-900">Route Calculation Failed</h4>
            <p className="text-sm text-red-700">{state.error}</p>
          </div>
        </div>
        <button
          onClick={() => setState(prev => ({ ...prev, error: null }))}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Dismiss
        </button>
      </div>
    );
  };

  // Main render
  if (isMinimized) {
    return (
      <div className="mb-8">
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-4">
          {renderHeader()}
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Route Optimization Widget Error:', error, errorInfo);
        // You could send this to an error reporting service here
      }}
    >
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200 sm:border-2 overflow-hidden">
          <div className="p-3 sm:p-4 lg:p-6">
            {renderHeader()}
            {renderError()}
            {renderQuickRoutes()}
            
            {/* Responsive Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Left Column: Route Input Panel */}
              <div className="order-1 lg:order-1">
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
                  />
                </ErrorBoundary>
              </div>

              {/* Right Column: Interactive Map */}
              <div className="order-2 lg:order-2">
                <div className="h-64 sm:h-80 md:h-96 lg:h-[500px] bg-gray-100 rounded-lg overflow-hidden relative">
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
                      origin={state.routePreferences.origin || null}
                      destination={state.routePreferences.destination || null}
                      waypoints={state.selectedWaypoints}
                      onRouteSelect={(routeId: string) => {
                        console.log('Route selected:', routeId);
                        // Find and set the selected route as current
                        const selectedRoute = [state.currentRoute, ...state.alternativeRoutes]
                          .find(route => route?.id === routeId);
                        if (selectedRoute) {
                          setState(prev => ({
                            ...prev,
                            currentRoute: selectedRoute
                          }));
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
              <div className="mt-4 sm:mt-6 lg:mt-8">
                <ErrorBoundary fallback={
                  <div className="p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
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
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default RouteOptimizationWidget;