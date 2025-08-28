'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RouteData, RouteTrafficAnalysis, LocationPoint } from '@/types/route-optimization';
import { createTomTomMap, getTomTomSDKStatus, resetTomTomService, changeMapStyle, type TomTomMapConfig, type MapStyle, MAP_STYLES, BAGUIO_CITY_COORDINATES, ZOOM_LEVELS } from '@/lib/tomtomMapUtils';
import { MapStyleSelector, RouteSelectionPanel, TrafficLegend } from './MapUI';
import { Loader2 } from 'lucide-react';

interface InteractiveRouteMapProps {
  currentRoute: RouteData | null;
  alternativeRoutes: RouteData[];
  trafficConditions: RouteTrafficAnalysis | null;
  origin: LocationPoint | null;
  destination: LocationPoint | null;
  waypoints: LocationPoint[];
  isLoading: boolean;
  onRouteSelect?: (routeId: string) => void;
}

declare global {
  interface Window {
    tt: any;
  }
}

// TomTom SDK configuration
const TOMTOM_CONFIG = {
  SDK_VERSION: '6.25.0',
  BASE_URL: 'https://api.tomtom.com/maps-sdk-for-web/cdn/6.x',
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  INITIALIZATION_TIMEOUT: 10000
};

export default function InteractiveRouteMap({
  currentRoute,
  alternativeRoutes,
  trafficConditions,
  origin,
  destination,
  waypoints,
  isLoading,
  onRouteSelect
}: InteractiveRouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [currentMapStyle, setCurrentMapStyle] = useState<MapStyle>('satellite');
  const [isChangingStyle, setIsChangingStyle] = useState(false);

  // Initialize map using the TomTom utility service
  const initializeMap = useCallback(async () => {
    if (!mapRef.current || mapInstanceRef.current) {
      return;
    }

    try {

      // Get API key from environment or fallback
      const apiKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY || '6Acdv8xeMK2MXLSy3tFQ1qk9s8ovwabD';
      
      if (!apiKey) {
        throw new Error('TomTom API key is required');
      }

      // Create optimized world map configuration with Baguio City as default location
      const mapConfig: TomTomMapConfig = {
        apiKey,
        container: mapRef.current,
        center: BAGUIO_CITY_COORDINATES, // Precise Baguio City coordinates
        zoom: ZOOM_LEVELS.CITY, // Optimal city-level zoom for initial view
        style: currentMapStyle,
        enableTraffic: true,
        enableControls: true,
        enable3D: currentMapStyle === 'terrain',
        enableTerrain: currentMapStyle === 'terrain',
        worldView: true, // Enable world map optimizations
        minZoom: ZOOM_LEVELS.WORLD, // Allow zooming out to world view
        maxZoom: ZOOM_LEVELS.BUILDING // Allow detailed building-level zoom
      };

      // Create map using utility service
      const map = await createTomTomMap(mapConfig);
      mapInstanceRef.current = map;

      // Set loaded state
      
      setIsMapLoaded(true);
      setIsSdkLoaded(true);
      setMapError(null);
      setRetryCount(0);
      
    } catch (error) {
      console.error('Map initialization error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setMapError(`Failed to initialize map: ${errorMessage}`);
      
      // Clean up failed map instance
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (cleanupError) {
          console.warn('Failed to clean up map instance:', cleanupError);
        }
        mapInstanceRef.current = null;
      }
    }
  }, []);

  // Load TomTom Maps with improved error handling
  useEffect(() => {
    let isMounted = true;
    
    const loadWithRetry = async (attempt: number = 1): Promise<void> => {
      if (!isMounted) return;
      
      try {
        setMapError(null);
        
        // Update SDK status
        const sdkStatus = getTomTomSDKStatus();
        setIsSdkLoaded(sdkStatus.isLoaded);
        setRetryCount(sdkStatus.retryCount);
        
        if (sdkStatus.error) {
          throw new Error(sdkStatus.error);
        }
        
        if (isMounted) {
          await initializeMap();
        }
      } catch (error) {
        console.error(`Map loading attempt ${attempt} failed:`, error);
        
        if (!isMounted) return;
        
        if (attempt < TOMTOM_CONFIG.RETRY_ATTEMPTS) {
          setRetryCount(attempt);
          setTimeout(() => {
            if (isMounted) {
              loadWithRetry(attempt + 1);
            }
          }, TOMTOM_CONFIG.RETRY_DELAY * attempt);
        } else {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load map after multiple attempts';
          setMapError(errorMessage);
        }
      }
    };

    loadWithRetry();
    
    return () => {
      isMounted = false;
    };
  }, [initializeMap]);

  // Retry map initialization
  const retryMapInitialization = useCallback(() => {
    setMapError(null);
    setIsMapLoaded(false);
    setIsSdkLoaded(false);
    setRetryCount(0);
    
    // Clean up existing map instance
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch (error) {
        console.warn('Failed to clean up existing map:', error);
      }
      mapInstanceRef.current = null;
    }
    
    // Reset the TomTom service
    resetTomTomService();
    
    // Trigger re-initialization
    setTimeout(() => {
      initializeMap();
    }, 100);
  }, [initializeMap]);

  // Handle map style change
  const handleStyleChange = useCallback(async (newStyle: MapStyle) => {
    if (!mapInstanceRef.current || isChangingStyle || newStyle === currentMapStyle) {
      return;
    }

    try {
      setIsChangingStyle(true);
      const apiKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY || '6Acdv8xeMK2MXLSy3tFQ1qk9s8ovwabD';
      await changeMapStyle(mapInstanceRef.current, newStyle, apiKey);
      setCurrentMapStyle(newStyle);
    } catch (error) {
      console.error('Failed to change map style:', error);
      // Optionally show error to user
    } finally {
      setIsChangingStyle(false);
    }
  }, [currentMapStyle, isChangingStyle]);

  // Update map with route data
  useEffect(() => {
    if (!mapInstanceRef.current || !isMapLoaded) return;

    const map = mapInstanceRef.current;

    // Clear existing markers and routes with proper error handling
    try {
      // Remove existing markers
      const markers = map.getMarkers?.() || [];
      markers.forEach((marker: any) => {
        try {
          marker.remove();
        } catch (error) {
          console.warn('Failed to remove marker:', error);
        }
      });
      
      // Remove existing route layers safely
      const layersToRemove = ['route-primary'];
      alternativeRoutes.forEach((_, index) => {
        layersToRemove.push(`route-alt-${index}`);
      });
      
      layersToRemove.forEach(layerId => {
        try {
          if (map.getLayer && map.getLayer(layerId)) {
            map.removeLayer(layerId);
          }
          if (map.getSource && map.getSource(layerId)) {
            map.removeSource(layerId);
          }
        } catch (error) {
          console.warn(`Failed to remove layer ${layerId}:`, error);
        }
      });
    } catch (error) {
      console.warn('Error during map cleanup:', error);
    }

    // Add markers with error handling
    try {
      // Add origin marker
      if (origin && window.tt.Marker && window.tt.Popup) {
        const originMarker = new window.tt.Marker({ color: 'green' })
          .setLngLat([origin.lng, origin.lat])
          .setPopup(new window.tt.Popup().setHTML(`<div><strong>Origin</strong><br/>${origin.address || 'Starting point'}</div>`))
          .addTo(map);
      }

      // Add destination marker
      if (destination && window.tt.Marker && window.tt.Popup) {
        const destMarker = new window.tt.Marker({ color: 'red' })
          .setLngLat([destination.lng, destination.lat])
          .setPopup(new window.tt.Popup().setHTML(`<div><strong>Destination</strong><br/>${destination.address || 'End point'}</div>`))
          .addTo(map);
      }

      // Add waypoint markers
      waypoints.forEach((waypoint, index) => {
        if (waypoint && window.tt.Marker && window.tt.Popup) {
          const waypointMarker = new window.tt.Marker({ color: 'blue' })
            .setLngLat([waypoint.lng, waypoint.lat])
            .setPopup(new window.tt.Popup().setHTML(`<div><strong>Waypoint ${index + 1}</strong><br/>${waypoint.address || `Stop ${index + 1}`}</div>`))
            .addTo(map);
        }
      });
    } catch (error) {
      console.warn('Error adding markers:', error);
    }

    // Add primary route with error handling
    if (currentRoute && currentRoute.legs && Array.isArray(currentRoute.legs)) {
      try {
        const routeCoordinates = currentRoute.legs.flatMap(leg => 
          leg.geometry?.coordinates?.map(coord => [coord.lng, coord.lat]) || []
        ).filter(coord => coord.length === 2 && !isNaN(coord[0]) && !isNaN(coord[1]));

        if (routeCoordinates.length > 0) {
          map.addSource('route-primary', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: { routeId: currentRoute.id },
              geometry: {
                type: 'LineString',
                coordinates: routeCoordinates
              }
            }
          });

          map.addLayer({
            id: 'route-primary',
            type: 'line',
            source: 'route-primary',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#3b82f6',
              'line-width': 6,
              'line-opacity': 0.8
            }
          });

          // Add hover interactions for primary route
          map.on('mouseenter', 'route-primary', () => {
            const canvas = map.getCanvas();
            if (canvas) canvas.style.cursor = 'pointer';
          });

          map.on('mouseleave', 'route-primary', () => {
            const canvas = map.getCanvas();
            if (canvas) canvas.style.cursor = '';
          });

          // Add click handler for primary route
          map.on('click', 'route-primary', () => {
            onRouteSelect?.(currentRoute.id);
          });

          // Fit map to route bounds
          if (window.tt.LngLatBounds) {
            const bounds = new window.tt.LngLatBounds();
            routeCoordinates.forEach((coord: number[]) => bounds.extend(coord));
            map.fitBounds(bounds, { padding: 50 });
          }
        }
      } catch (error) {
        console.warn('Error adding primary route:', error);
      }
    }

    // Add alternative routes with error handling
    alternativeRoutes.forEach((route, index) => {
      if (route.legs && Array.isArray(route.legs)) {
        try {
          const routeCoordinates = route.legs.flatMap(leg => 
            leg.geometry?.coordinates?.map(coord => [coord.lng, coord.lat]) || []
          ).filter(coord => coord.length === 2 && !isNaN(coord[0]) && !isNaN(coord[1]));

          if (routeCoordinates.length > 0) {
            const sourceId = `route-alt-${index}`;
            const layerId = `route-alt-${index}`;

            map.addSource(sourceId, {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: { routeId: route.id },
                geometry: {
                  type: 'LineString',
                  coordinates: routeCoordinates
                }
              }
            });

            map.addLayer({
              id: layerId,
              type: 'line',
              source: sourceId,
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': '#6b7280',
                'line-width': 4,
                'line-opacity': 0.6,
                'line-dasharray': [2, 2]
              }
            });

            // Add click handler for alternative routes
            map.on('click', layerId, () => {
              onRouteSelect?.(route.id);
            });

            map.on('mouseenter', layerId, () => {
              const canvas = map.getCanvas();
              if (canvas) canvas.style.cursor = 'pointer';
            });

            map.on('mouseleave', layerId, () => {
              const canvas = map.getCanvas();
              if (canvas) canvas.style.cursor = '';
            });
          }
        } catch (error) {
          console.warn(`Error adding alternative route ${index}:`, error);
        }
      }
    });

  }, [currentRoute, alternativeRoutes, origin, destination, waypoints, isMapLoaded, onRouteSelect]);

  // Re-add routes when map style changes
  useEffect(() => {
    if (!mapInstanceRef.current || !isMapLoaded || isChangingStyle) return;
    
    // Small delay to ensure style has loaded
    const timeoutId = setTimeout(() => {
      // Trigger route re-rendering by updating a dependency
      // This will cause the route effect above to re-run
    }, 1500);
    
    return () => clearTimeout(timeoutId);
  }, [currentMapStyle, isMapLoaded, isChangingStyle]);

  const handleRouteClick = (routeId: string) => {
    onRouteSelect?.(routeId);
  };

  if (mapError) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="text-center p-3 sm:p-6 mx-2 sm:mx-0">
          <div className="text-red-500 text-base sm:text-lg font-medium mb-2">Map Error</div>
          <div className="text-gray-600 text-xs sm:text-sm mb-4 max-w-sm">{mapError}</div>
          <button 
            onClick={retryMapInitialization}
            className="px-3 py-2 sm:px-4 sm:py-2 bg-blue-500 text-white text-xs sm:text-sm rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={retryCount >= TOMTOM_CONFIG.RETRY_ATTEMPTS}
          >
            {retryCount > 0 ? `Retry (${retryCount}/${TOMTOM_CONFIG.RETRY_ATTEMPTS})` : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full bg-gray-100 rounded-lg overflow-hidden">
      {/* Map Container */}
      <div ref={mapRef} className="w-full h-full">
        {!isMapLoaded && !mapError && (
          <div className="h-full flex items-center justify-center bg-muted/50">
            <div className="text-center p-3 sm:p-6 bg-background rounded-lg shadow-md mx-2 sm:mx-0">
              <div className="flex items-center justify-center space-x-2 sm:space-x-3 mb-3 sm:mb-4">
                <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
                <span className="text-sm sm:text-lg font-medium text-foreground">
                  {!isSdkLoaded ? 'Loading Resources...' : 'Initializing Map...'}
                </span>
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                {!isSdkLoaded 
                  ? 'Getting map services ready.' 
                  : 'Preparing route visualization.'
                }
              </div>
              {retryCount > 0 && (
                <div className="text-xs text-destructive mt-2">
                  Retry attempt {retryCount}/{TOMTOM_CONFIG.RETRY_ATTEMPTS}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {isLoading && isMapLoaded && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="flex items-center space-x-2 sm:space-x-3 p-3 sm:p-4 bg-background rounded-lg shadow-lg border mx-2 sm:mx-0">
            <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin text-primary" />
            <span className="text-xs sm:text-sm font-medium text-foreground">Calculating routes...</span>
          </div>
        </div>
      )}

      {isMapLoaded && (
        <>
          <RouteSelectionPanel 
            currentRoute={currentRoute} 
            alternativeRoutes={alternativeRoutes} 
            trafficConditions={trafficConditions} 
            onRouteSelect={handleRouteClick} 
          />
          <TrafficLegend trafficConditions={trafficConditions} />
          <MapStyleSelector 
            currentMapStyle={currentMapStyle} 
            isChangingStyle={isChangingStyle} 
            onStyleChange={handleStyleChange} 
          />
        </>
      )}
    </div>
  );
}