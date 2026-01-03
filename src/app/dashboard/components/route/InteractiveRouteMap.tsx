'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RouteData, RouteTrafficAnalysis, LocationPoint } from '@/types/route-optimization';
import { createTomTomMap, getTomTomSDKStatus, resetTomTomService, changeMapStyle, type TomTomMapConfig, type MapStyle, MAP_STYLES, BAGUIO_CITY_COORDINATES, ZOOM_LEVELS } from '@/lib/integrations/tomtomMapUtils';
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
  const [currentMapStyle, setCurrentMapStyle] = useState<MapStyle>('main');
  const [isChangingStyle, setIsChangingStyle] = useState(false);
  const plottedRouteCountRef = useRef(0);

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
        enable3D: false,
        enableTerrain: false,
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
    if (!mapInstanceRef.current || !mapRef.current || isChangingStyle || newStyle === currentMapStyle) {
      return;
    }

    try {
      setIsChangingStyle(true);
      const apiKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY || '6Acdv8xeMK2MXLSy3tFQ1qk9s8ovwabD';
      
      console.log(`🎨 Changing map style from ${currentMapStyle} to ${newStyle}`);
      
      // Use the updated changeMapStyle function that recreates the map
      const newMapInstance = await changeMapStyle(
        mapInstanceRef.current, 
        newStyle, 
        apiKey, 
        mapRef.current
      );
      
      // Update the map instance reference
      mapInstanceRef.current = newMapInstance;
      setCurrentMapStyle(newStyle);
      
      console.log(`✅ Successfully changed map style to ${newStyle}`);
    } catch (error) {
      console.error('Failed to change map style:', error);
      const errorMessage = error instanceof Error ? error.message : 
                          typeof error === 'string' ? error : 
                          JSON.stringify(error, null, 2);
      console.error('Detailed error:', errorMessage);
      setMapError(`Failed to change map style: ${errorMessage}`);
    } finally {
      setIsChangingStyle(false);
    }
  }, [currentMapStyle, isChangingStyle]);

  // Update map with route data
  useEffect(() => {
    if (!mapInstanceRef.current || !isMapLoaded) return;

    const map = mapInstanceRef.current;
    
    // Skip if we're currently changing styles to prevent flickering
    if (isChangingStyle) return;

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
      
      // Clean up any existing glow animations
      if ((map as any)._primaryRouteGlowAnimation) {
        clearInterval((map as any)._primaryRouteGlowAnimation);
        (map as any)._primaryRouteGlowAnimation = null;
      }
      if ((map as any)._altRouteGlowAnimations) {
        (map as any)._altRouteGlowAnimations.forEach((id: any) => clearInterval(id));
        (map as any)._altRouteGlowAnimations = [];
      }
      
      // Remove existing route layers safely (including glow layers)
      // First, collect all layer IDs to remove
      const layersToRemove = [
        'route-primary', 
        'route-primary-glow-outer', 
        'route-primary-glow-middle', 
        'route-primary-glow-inner'
      ];
      
      // Use the maximum of current and previous count to ensure we catch everything
      const maxRouteCount = Math.max(alternativeRoutes.length, plottedRouteCountRef.current);
      
      for (let index = 0; index < maxRouteCount; index++) {
        layersToRemove.push(
          `route-alt-${index}`,
          `route-alt-${index}-glow-outer`,
          `route-alt-${index}-glow-middle`,
          `route-alt-${index}-glow-inner`
        );
      }
      
      // Step 1: Remove all layers first
      layersToRemove.forEach(layerId => {
        try {
          if (map.getLayer && map.getLayer(layerId)) {
            map.removeLayer(layerId);
          }
        } catch (error) {
          console.warn(`Failed to remove layer ${layerId}:`, error);
        }
      });
      
      // Step 2: Remove sources only after all layers are removed
      const sourcesToRemove = ['route-primary'];
      for (let index = 0; index < maxRouteCount; index++) {
        sourcesToRemove.push(`route-alt-${index}`);
      }
      
      sourcesToRemove.forEach(sourceId => {
        try {
          if (map.getSource && map.getSource(sourceId)) {
            map.removeSource(sourceId);
          }
        } catch (error) {
          console.warn(`Failed to remove source ${sourceId}:`, error);
        }
      });
    } catch (error) {
      console.warn('Error during map cleanup:', error);
    }

    // Add modern, sleek markers with glassmorphism effects
    try {
      // Create custom origin marker with modern styling
      if (origin && window.tt.Marker && window.tt.Popup) {
        console.log('🟢 Adding modern origin marker:', origin);
        
        // Create custom origin marker element
        const originElement = document.createElement('div');
        originElement.innerHTML = `
          <div class="origin-marker" style="
            position: relative;
            width: 40px;
            height: 40px;
            cursor: pointer;
            transform-origin: center;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          ">
            <!-- Outer glow ring -->
            <div style="
              position: absolute;
              top: -8px;
              left: -8px;
              width: 56px;
              height: 56px;
              border-radius: 50%;
              background: radial-gradient(circle, rgba(34, 197, 94, 0.2) 0%, rgba(34, 197, 94, 0.05) 70%, transparent 100%);
              animation: pulse-origin 2s ease-in-out infinite;
            "></div>
            
            <!-- Main marker body -->
            <div style="
              position: absolute;
              top: 0;
              left: 0;
              width: 40px;
              height: 40px;
              background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
              border-radius: 50%;
              box-shadow: 
                0 4px 20px rgba(34, 197, 94, 0.4),
                0 2px 8px rgba(0, 0, 0, 0.1),
                inset 0 1px 0 rgba(255, 255, 255, 0.2);
              border: 2px solid rgba(255, 255, 255, 0.9);
              backdrop-filter: blur(10px);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="white" opacity="0.9"/>
              </svg>
            </div>
            
            <!-- Inner shine effect -->
            <div style="
              position: absolute;
              top: 4px;
              left: 4px;
              width: 32px;
              height: 32px;
              border-radius: 50%;
              background: linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, transparent 50%);
              pointer-events: none;
            "></div>
          </div>
        `;
        
        // Add CSS animations
        const style = document.createElement('style');
        style.textContent = `
          @keyframes pulse-origin {
            0%, 100% { transform: scale(1); opacity: 0.6; }
            50% { transform: scale(1.1); opacity: 0.3; }
          }
          .origin-marker:hover {
            transform: scale(1.1) !important;
          }
          .origin-marker:hover > div:first-child {
            animation-duration: 1s !important;
          }
        `;
        document.head.appendChild(style);
        
        const originMarker = new window.tt.Marker({ 
          element: originElement,
          anchor: 'center'
        })
          .setLngLat([origin.lng, origin.lat])
          .setPopup(new window.tt.Popup({ 
            offset: 35,
            closeButton: true,
            closeOnClick: false,
            className: 'modern-popup'
          }).setHTML(`
            <div style="
              padding: 16px 20px;
              min-width: 220px;
              background: rgba(255, 255, 255, 0.95);
              backdrop-filter: blur(20px);
              border-radius: 16px;
              border: 1px solid rgba(255, 255, 255, 0.2);
              box-shadow: 
                0 20px 40px rgba(0, 0, 0, 0.1),
                0 8px 16px rgba(0, 0, 0, 0.06),
                inset 0 1px 0 rgba(255, 255, 255, 0.4);
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
              <div style="
                display: flex;
                align-items: center;
                margin-bottom: 12px;
                gap: 8px;
              ">
                <div style="
                  width: 8px;
                  height: 8px;
                  background: linear-gradient(135deg, #22c55e, #16a34a);
                  border-radius: 50%;
                  box-shadow: 0 0 8px rgba(34, 197, 94, 0.4);
                "></div>
                <div style="
                  font-weight: 600;
                  color: #1f2937;
                  font-size: 14px;
                  letter-spacing: -0.01em;
                ">Starting Point</div>
              </div>
              <div style="
                font-size: 15px;
                color: #111827;
                font-weight: 500;
                margin-bottom: 6px;
                line-height: 1.4;
              ">${origin.name || 'Origin'}</div>
              <div style="
                font-size: 13px;
                color: #6b7280;
                line-height: 1.3;
                opacity: 0.8;
              ">${origin.address || 'Starting location'}</div>
            </div>
          `))
          .addTo(map);
      }

      // Create custom destination marker with modern styling
      if (destination && window.tt.Marker && window.tt.Popup) {
        console.log('🔴 Adding modern destination marker:', destination);
        
        // Create custom destination marker element
        const destElement = document.createElement('div');
        destElement.innerHTML = `
          <div class="destination-marker" style="
            position: relative;
            width: 40px;
            height: 40px;
            cursor: pointer;
            transform-origin: center;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          ">
            <!-- Outer glow ring -->
            <div style="
              position: absolute;
              top: -8px;
              left: -8px;
              width: 56px;
              height: 56px;
              border-radius: 50%;
              background: radial-gradient(circle, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.05) 70%, transparent 100%);
              animation: pulse-destination 2s ease-in-out infinite;
            "></div>
            
            <!-- Main marker body -->
            <div style="
              position: absolute;
              top: 0;
              left: 0;
              width: 40px;
              height: 40px;
              background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
              border-radius: 50%;
              box-shadow: 
                0 4px 20px rgba(239, 68, 68, 0.4),
                0 2px 8px rgba(0, 0, 0, 0.1),
                inset 0 1px 0 rgba(255, 255, 255, 0.2);
              border: 2px solid rgba(255, 255, 255, 0.9);
              backdrop-filter: blur(10px);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="white" opacity="0.9"/>
              </svg>
            </div>
            
            <!-- Inner shine effect -->
            <div style="
              position: absolute;
              top: 4px;
              left: 4px;
              width: 32px;
              height: 32px;
              border-radius: 50%;
              background: linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, transparent 50%);
              pointer-events: none;
            "></div>
          </div>
        `;
        
        // Add CSS animations for destination
        const destStyle = document.createElement('style');
        destStyle.textContent = `
          @keyframes pulse-destination {
            0%, 100% { transform: scale(1); opacity: 0.6; }
            50% { transform: scale(1.1); opacity: 0.3; }
          }
          .destination-marker:hover {
            transform: scale(1.1) !important;
          }
          .destination-marker:hover > div:first-child {
            animation-duration: 1s !important;
          }
        `;
        document.head.appendChild(destStyle);
        
        const destMarker = new window.tt.Marker({ 
          element: destElement,
          anchor: 'center'
        })
          .setLngLat([destination.lng, destination.lat])
          .setPopup(new window.tt.Popup({ 
            offset: 35,
            closeButton: true,
            closeOnClick: false,
            className: 'modern-popup'
          }).setHTML(`
            <div style="
              padding: 16px 20px;
              min-width: 220px;
              background: rgba(255, 255, 255, 0.95);
              backdrop-filter: blur(20px);
              border-radius: 16px;
              border: 1px solid rgba(255, 255, 255, 0.2);
              box-shadow: 
                0 20px 40px rgba(0, 0, 0, 0.1),
                0 8px 16px rgba(0, 0, 0, 0.06),
                inset 0 1px 0 rgba(255, 255, 255, 0.4);
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
              <div style="
                display: flex;
                align-items: center;
                margin-bottom: 12px;
                gap: 8px;
              ">
                <div style="
                  width: 8px;
                  height: 8px;
                  background: linear-gradient(135deg, #ef4444, #dc2626);
                  border-radius: 50%;
                  box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
                "></div>
                <div style="
                  font-weight: 600;
                  color: #1f2937;
                  font-size: 14px;
                  letter-spacing: -0.01em;
                ">Destination</div>
              </div>
              <div style="
                font-size: 15px;
                color: #111827;
                font-weight: 500;
                margin-bottom: 6px;
                line-height: 1.4;
              ">${destination.name || 'Destination'}</div>
              <div style="
                font-size: 13px;
                color: #6b7280;
                line-height: 1.3;
                opacity: 0.8;
              ">${destination.address || 'End location'}</div>
            </div>
          `))
          .addTo(map);
      }

      // Create custom waypoint markers with modern styling
      waypoints.forEach((waypoint, index) => {
        if (waypoint && window.tt.Marker && window.tt.Popup) {
          console.log(`🔵 Adding modern waypoint ${index + 1} marker:`, waypoint);
          
          // Create custom waypoint marker element
          const waypointElement = document.createElement('div');
          waypointElement.innerHTML = `
            <div class="waypoint-marker" style="
              position: relative;
              width: 32px;
              height: 32px;
              cursor: pointer;
              transform-origin: center;
              transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            ">
              <!-- Outer glow ring -->
              <div style="
                position: absolute;
                top: -6px;
                left: -6px;
                width: 44px;
                height: 44px;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.03) 70%, transparent 100%);
                animation: pulse-waypoint 2.5s ease-in-out infinite;
              "></div>
              
              <!-- Main marker body -->
              <div style="
                position: absolute;
                top: 0;
                left: 0;
                width: 32px;
                height: 32px;
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                border-radius: 50%;
                box-shadow: 
                  0 3px 15px rgba(59, 130, 246, 0.3),
                  0 1px 6px rgba(0, 0, 0, 0.1),
                  inset 0 1px 0 rgba(255, 255, 255, 0.2);
                border: 2px solid rgba(255, 255, 255, 0.9);
                backdrop-filter: blur(8px);
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
                color: white;
                font-size: 12px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              ">
                ${index + 1}
              </div>
              
              <!-- Inner shine effect -->
              <div style="
                position: absolute;
                top: 3px;
                left: 3px;
                width: 26px;
                height: 26px;
                border-radius: 50%;
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, transparent 50%);
                pointer-events: none;
              "></div>
            </div>
          `;
          
          // Add CSS animations for waypoints
          const waypointStyle = document.createElement('style');
          waypointStyle.textContent = `
            @keyframes pulse-waypoint {
              0%, 100% { transform: scale(1); opacity: 0.5; }
              50% { transform: scale(1.05); opacity: 0.25; }
            }
            .waypoint-marker:hover {
              transform: scale(1.15) !important;
            }
            .waypoint-marker:hover > div:first-child {
              animation-duration: 1.2s !important;
            }
          `;
          document.head.appendChild(waypointStyle);
          
          const waypointMarker = new window.tt.Marker({ 
            element: waypointElement,
            anchor: 'center'
          })
            .setLngLat([waypoint.lng, waypoint.lat])
            .setPopup(new window.tt.Popup({ 
              offset: 25,
              closeButton: true,
              closeOnClick: false,
              className: 'modern-popup'
            }).setHTML(`
              <div style="
                padding: 14px 18px;
                min-width: 200px;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(20px);
                border-radius: 14px;
                border: 1px solid rgba(255, 255, 255, 0.2);
                box-shadow: 
                  0 15px 30px rgba(0, 0, 0, 0.08),
                  0 6px 12px rgba(0, 0, 0, 0.05),
                  inset 0 1px 0 rgba(255, 255, 255, 0.4);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              ">
                <div style="
                  display: flex;
                  align-items: center;
                  margin-bottom: 10px;
                  gap: 8px;
                ">
                  <div style="
                    width: 20px;
                    height: 20px;
                    background: linear-gradient(135deg, #3b82f6, #2563eb);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 11px;
                    font-weight: 700;
                    box-shadow: 0 0 6px rgba(59, 130, 246, 0.3);
                  ">${index + 1}</div>
                  <div style="
                    font-weight: 600;
                    color: #1f2937;
                    font-size: 13px;
                    letter-spacing: -0.01em;
                  ">Waypoint ${index + 1}</div>
                </div>
                <div style="
                  font-size: 14px;
                  color: #111827;
                  font-weight: 500;
                  margin-bottom: 5px;
                  line-height: 1.4;
                ">${waypoint.name || `Stop ${index + 1}`}</div>
                <div style="
                  font-size: 12px;
                  color: #6b7280;
                  line-height: 1.3;
                  opacity: 0.8;
                ">${waypoint.address || `Waypoint ${index + 1}`}</div>
              </div>
            `))
            .addTo(map);
        }
      });

      // Auto-fit map to show all markers with enhanced padding for modern UI
      if ((origin || destination || waypoints.length > 0) && window.tt.LngLatBounds) {
        const bounds = new window.tt.LngLatBounds();
        
        if (origin) bounds.extend([origin.lng, origin.lat]);
        if (destination) bounds.extend([destination.lng, destination.lat]);
        waypoints.forEach(waypoint => {
          if (waypoint) bounds.extend([waypoint.lng, waypoint.lat]);
        });
        
        // Fit map to bounds with generous padding for modern marker visibility
        map.fitBounds(bounds, { 
          padding: { top: 80, bottom: 80, left: 80, right: 80 },
          maxZoom: 15,
          duration: 1500,
          essential: true
        });
        
        console.log('🗺️ Map fitted to modern marker bounds with smooth animation');
      }
      
      // Add modern popup global styles
      const globalPopupStyle = document.createElement('style');
      globalPopupStyle.textContent = `
        .mapboxgl-popup .mapboxgl-popup-content,
        .modern-popup .mapboxgl-popup-content {
          padding: 0 !important;
          border-radius: 16px !important;
          background: transparent !important;
          box-shadow: none !important;
        }
        .mapboxgl-popup .mapboxgl-popup-tip,
        .modern-popup .mapboxgl-popup-tip {
          border-top-color: rgba(255, 255, 255, 0.95) !important;
        }
        .mapboxgl-popup-anchor-bottom .mapboxgl-popup-tip,
        .modern-popup.mapboxgl-popup-anchor-bottom .mapboxgl-popup-tip {
          border-bottom-color: rgba(255, 255, 255, 0.95) !important;
          border-top-color: transparent !important;
        }
        
        /* Modern close button styling */
        .modern-popup .mapboxgl-popup-close-button {
          position: absolute;
          right: 8px;
          top: 8px;
          width: 24px;
          height: 24px;
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 50%;
          color: #6b7280;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(10px);
          transition: all 0.2s ease;
          z-index: 10;
          padding: 0;
          line-height: 1;
        }
        
        .modern-popup .mapboxgl-popup-close-button:hover {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border-color: rgba(239, 68, 68, 0.2);
          transform: scale(1.05);
        }
        
        .modern-popup .mapboxgl-popup-close-button:active {
          transform: scale(0.95);
        }
      `;
      document.head.appendChild(globalPopupStyle);
      
    } catch (error) {
      console.warn('Error adding modern markers:', error);
      // Fallback to simple markers if custom ones fail
      try {
        if (origin) {
          new window.tt.Marker({ color: '#22c55e', scale: 1.2 })
            .setLngLat([origin.lng, origin.lat])
            .addTo(map);
        }
        if (destination) {
          new window.tt.Marker({ color: '#ef4444', scale: 1.2 })
            .setLngLat([destination.lng, destination.lat])
            .addTo(map);
        }
      } catch (fallbackError) {
        console.warn('Fallback marker creation also failed:', fallbackError);
      }
    }

    // RENDER ALTERNATIVE ROUTES FIRST (so they appear BELOW primary route)
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
                'line-color': '#ffd700',
                'line-width': 5,
                'line-opacity': 0.85,
                'line-dasharray': [3, 2]
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

    // RENDER PRIMARY ROUTE LAST (so it appears ABOVE alternative routes)
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
              'line-color': '#0099ff',
              'line-width': 7,
              'line-opacity': 1.0
            }
          });
          
          // Add enhanced animated pulsing glow effect for visibility
          const animateRouteGlow = () => {
            if (map.getLayer('route-primary-glow-outer')) {
              map.setPaintProperty('route-primary-glow-outer', 'line-opacity', 
                0.2 + 0.3 * (1 + Math.sin(Date.now() * 0.003)));
            }
            if (map.getLayer('route-primary-glow-middle')) {
              map.setPaintProperty('route-primary-glow-middle', 'line-opacity', 
                0.3 + 0.5 * (1 + Math.sin(Date.now() * 0.003 + 0.5)));
            }
            if (map.getLayer('route-primary-glow-inner')) {
              map.setPaintProperty('route-primary-glow-inner', 'line-opacity', 
                0.5 + 0.7 * (1 + Math.sin(Date.now() * 0.003 + 1)));
            }
          };
          
          // Start animation
          const glowAnimationId = setInterval(animateRouteGlow, 50);
          
          // Store animation ID for cleanup
          (map as any)._primaryRouteGlowAnimation = glowAnimationId;

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
    // Update the plotted count ref for next cleanup
    plottedRouteCountRef.current = alternativeRoutes.length;
  }, [currentRoute?.id, alternativeRoutes.map(r => r.id).join(','), origin?.lat, origin?.lng, destination?.lat, destination?.lng, waypoints.length, isMapLoaded]);


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
            <span className="text-xs sm:text-sm font-medium text-foreground">Analyzing routes...</span>
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