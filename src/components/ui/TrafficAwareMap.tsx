/**
 * Traffic-Aware Map Component
 * Displays routes with traffic color coding for user awareness
 */

import React, { useEffect, useRef, useState } from 'react';
import { 
  RouteData, 
  RouteTrafficAnalysis, 
  LocationPoint, 
  Coordinates,
  TrafficLevel 
} from '@/types/route-optimization';
import { 
  getTrafficPolylineStyle, 
  getTrafficColorFromScore,
  getTrafficLevelFromScore,
  TRAFFIC_COLORS,
  TRAFFIC_LEVEL_INFO
} from '@/lib/utils/trafficColors';

interface TrafficAwareMapProps {
  currentRoute?: RouteData | null;
  alternativeRoutes?: RouteData[];
  trafficAnalysis?: RouteTrafficAnalysis | null;
  origin?: LocationPoint | null;
  destination?: LocationPoint | null;
  waypoints?: LocationPoint[];
  onRouteSelect?: (routeId: string) => void;
  className?: string;
  height?: string;
  showTrafficLegend?: boolean;
  isLoading?: boolean;
}

export function TrafficAwareMap({
  currentRoute,
  alternativeRoutes = [],
  trafficAnalysis,
  origin,
  destination,
  waypoints = [],
  onRouteSelect,
  className = '',
  height = '400px',
  showTrafficLegend = true,
  isLoading = false
}: TrafficAwareMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Initialize map (placeholder for actual map library integration)
  useEffect(() => {
    if (!mapRef.current) return;

    // This would be replaced with actual map library initialization
    // For example: Leaflet, Google Maps, or Mapbox
    const initializeMap = async () => {
      try {
        // Placeholder map initialization
        console.log('🗺️ Traffic Map: Initializing map with traffic visualization');
        
        // Simulate map loading
        setTimeout(() => {
          setIsMapLoaded(true);
          console.log('✅ Traffic Map: Map loaded successfully');
        }, 1000);
        
      } catch (error) {
        console.error('❌ Traffic Map: Failed to initialize map:', error);
      }
    };

    initializeMap();
  }, []);

  // Update route visualization when routes change
  useEffect(() => {
    if (!isMapLoaded || !mapInstance) return;

    console.log('🎨 Traffic Map: Updating route visualization with traffic colors');
    
    // Clear existing routes
    // mapInstance.clearRoutes();

    // Add current route with traffic-aware styling
    if (currentRoute && trafficAnalysis) {
      const trafficLevel = getTrafficLevelFromScore(trafficAnalysis.congestionScore);
      const routeStyle = getTrafficPolylineStyle(trafficLevel, 8);
      
      console.log(`📍 Traffic Map: Drawing primary route with ${trafficLevel} traffic level`, routeStyle);
      
      // Add route to map with traffic colors
      // mapInstance.addRoute(currentRoute, {
      //   ...routeStyle,
      //   zIndex: 1000,
      //   interactive: true,
      //   popup: `Traffic Level: ${trafficLevel}<br/>Congestion: ${trafficAnalysis.congestionScore}%`
      // });
    }

    // Add alternative routes with different styling
    alternativeRoutes.forEach((route, index) => {
      const routeStyle = {
        color: '#6b7280', // Gray for alternatives
        weight: 4,
        opacity: 0.6,
        dashArray: '5, 10'
      };
      
      console.log(`📍 Traffic Map: Drawing alternative route ${index + 1}`, routeStyle);
      
      // mapInstance.addRoute(route, {
      //   ...routeStyle,
      //   zIndex: 500 - index,
      //   interactive: true,
      //   popup: `Alternative Route ${index + 1}`
      // });
    });

    // Add traffic-aware segment visualization
    if (trafficAnalysis?.segmentAnalysis) {
      trafficAnalysis.segmentAnalysis.forEach((segment, index) => {
        const segmentStyle = getTrafficPolylineStyle(segment.trafficLevel, 6);
        
        console.log(`🛣️ Traffic Map: Drawing segment ${index} with ${segment.trafficLevel} traffic`, segmentStyle);
        
        // mapInstance.addSegment(segment, {
        //   ...segmentStyle,
        //   zIndex: 750,
        //   popup: `Segment: ${segment.roadName}<br/>Traffic: ${segment.trafficLevel}<br/>Speed: ${segment.speedKmh} km/h`
        // });
      });
    }

  }, [currentRoute, alternativeRoutes, trafficAnalysis, isMapLoaded, mapInstance]);

  // Add markers for origin, destination, and waypoints
  useEffect(() => {
    if (!isMapLoaded || !mapInstance) return;

    // Clear existing markers
    // mapInstance.clearMarkers();

    // Add origin marker
    if (origin) {
      console.log('📍 Traffic Map: Adding origin marker', origin);
      // mapInstance.addMarker(origin, {
      //   icon: 'start',
      //   color: '#10b981',
      //   popup: `Start: ${origin.name}`
      // });
    }

    // Add destination marker
    if (destination) {
      console.log('📍 Traffic Map: Adding destination marker', destination);
      // mapInstance.addMarker(destination, {
      //   icon: 'end',
      //   color: '#ef4444',
      //   popup: `End: ${destination.name}`
      // });
    }

    // Add waypoint markers
    waypoints.forEach((waypoint, index) => {
      console.log(`📍 Traffic Map: Adding waypoint ${index + 1}`, waypoint);
      // mapInstance.addMarker(waypoint, {
      //   icon: 'waypoint',
      //   color: '#f59e0b',
      //   popup: `Waypoint ${index + 1}: ${waypoint.name}`
      // });
    });

  }, [origin, destination, waypoints, isMapLoaded, mapInstance]);

  const renderTrafficLegend = () => {
    if (!showTrafficLegend) return null;

    return (
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg border p-3 z-10 max-w-xs">
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Traffic Legend</h4>
        <div className="space-y-2">
          {Object.entries(TRAFFIC_LEVEL_INFO).map(([level, info]) => (
            <div key={level} className="flex items-center gap-2 text-xs">
              <div
                className="w-3 h-3 rounded-full border"
                style={{ 
                  backgroundColor: info.colors.color,
                  borderColor: info.colors.borderColor
                }}
              />
              <span className="font-medium">{info.label}</span>
              <span className="text-gray-500">({info.speedReduction})</span>
            </div>
          ))}
        </div>
        
        {trafficAnalysis && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Current Route:</span>
              <div className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ 
                    backgroundColor: getTrafficColorFromScore(trafficAnalysis.congestionScore).color 
                  }}
                />
                <span className="font-medium">
                  {getTrafficLevelFromScore(trafficAnalysis.congestionScore)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderLoadingOverlay = () => {
    if (!isLoading) return null;

    return (
      <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-20">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
          <span className="text-sm text-gray-600 font-medium">Analyzing traffic-aware routes...</span>
        </div>
      </div>
    );
  };

  const renderMapPlaceholder = () => {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-50 text-gray-500">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-lg flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Interactive Traffic Map</h3>
          <p className="text-sm text-gray-600 mb-4">
            Routes will be displayed with color-coded traffic conditions:
          </p>
          <div className="flex justify-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Free Flow</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span>Moderate</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span>Heavy</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span>Severe</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`relative overflow-hidden rounded-lg border ${className}`} style={{ height }}>
      <div ref={mapRef} className="w-full h-full">
        {renderMapPlaceholder()}
      </div>
      
      {renderTrafficLegend()}
      {renderLoadingOverlay()}
      
      {/* Route Selection Controls */}
      {(currentRoute || alternativeRoutes.length > 0) && (
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg border p-3 z-10">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Route Options</h4>
          <div className="space-y-2">
            {currentRoute && (
              <button
                onClick={() => onRouteSelect?.(currentRoute.id)}
                className="w-full text-left p-2 bg-blue-50 border border-blue-200 rounded text-xs hover:bg-blue-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-blue-900">Primary Route</span>
                  {trafficAnalysis && (
                    <div className="flex items-center gap-1">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ 
                          backgroundColor: getTrafficColorFromScore(trafficAnalysis.congestionScore).color 
                        }}
                      />
                      <span className="text-blue-700">
                        {Math.round(currentRoute.summary.travelTimeInSeconds / 60)}min
                      </span>
                    </div>
                  )}
                </div>
              </button>
            )}
            
            {alternativeRoutes.map((route, index) => (
              <button
                key={route.id}
                onClick={() => onRouteSelect?.(route.id)}
                className="w-full text-left p-2 bg-gray-50 border border-gray-200 rounded text-xs hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">Alternative {index + 1}</span>
                  <span className="text-gray-600">
                    {Math.round(route.summary.travelTimeInSeconds / 60)}min
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default TrafficAwareMap;
