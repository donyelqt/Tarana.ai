"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "./ui/button"
import {
  BAGUIO_CITY_COORDINATES,
  ZOOM_LEVELS,
  createTomTomMap,
  loadTomTomSDK,
} from "@/lib/integrations/tomtomMapUtils"

interface MapViewProps {
  title: string
  address: string
  lat?: number
  lng?: number
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window {
    tt: any
  }
}

const DEFAULT_LAT = BAGUIO_CITY_COORDINATES[1]
const DEFAULT_LNG = BAGUIO_CITY_COORDINATES[0]

const MapView = ({
  title,
  address,
  lat = DEFAULT_LAT,
  lng = DEFAULT_LNG,
}: MapViewProps) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map: any
  } | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const windowResizeHandlerRef = useRef<(() => void) | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [mapHeight, setMapHeight] = useState(320)

  // Mobile detection and responsive height calculation
  useEffect(() => {
    if (typeof window === "undefined") return

    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      
      // Dynamic height calculation based on screen size
      const vh = window.innerHeight
      if (mobile) {
        setMapHeight(Math.min(vh * 0.5, 400)) // 50vh max 400px on mobile
      } else if (window.innerWidth < 1024) {
        setMapHeight(360) // Tablet
      } else {
        setMapHeight(480) // Desktop
      }
    }

    checkMobile()
    window.addEventListener('resize', checkMobile, { passive: true })
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Toggle fullscreen mode for mobile
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev)
  }, [])

  // Close fullscreen on escape key
  useEffect(() => {
    if (!isFullscreen) return
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isFullscreen])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    let isActive = true
    const apiKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY

    const initializeTomTomMap = async () => {
      if (!mapRef.current) {
        return
      }

      if (!apiKey) {
        setError("TomTom API key is not configured")
        return
      }

      setError(null)
      setIsLoaded(false)

      // Clean up any existing map before re-initializing
      if (mapInstanceRef.current?.map) {
        try {
          mapInstanceRef.current.map.remove()
        } catch (cleanupError) {
          console.warn("Failed to remove previous TomTom map instance", cleanupError)
        }
      }
      mapInstanceRef.current = null
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = null
      }
      if (windowResizeHandlerRef.current) {
        window.removeEventListener("resize", windowResizeHandlerRef.current)
        windowResizeHandlerRef.current = null
      }

      try {
        await loadTomTomSDK()

        const map = await createTomTomMap({
          apiKey,
          container: mapRef.current,
          center: [lng, lat],
          zoom: ZOOM_LEVELS.STREET,
          style: "main",
          enableControls: true,
          enableTraffic: true,
          minZoom: ZOOM_LEVELS.CITY,
          maxZoom: ZOOM_LEVELS.BUILDING,
        })
        if (!isActive) {
          map.remove()
          return
        }

        const requestMapResize = () => {
          requestAnimationFrame(() => {
            try {
              map.resize()
            } catch (resizeError) {
              console.warn("TomTom map resize failed", resizeError)
            }
          })
        }

        new window.tt.Marker().setLngLat([lng, lat]).addTo(map)
        const popupContent = `<div class="tomtom-popup"><strong>${title}</strong><br/>${address}</div>`
        new window.tt
          .Popup({ offset: 35 })
          .setLngLat([lng, lat])
          .setHTML(popupContent)
          .addTo(map)

        mapInstanceRef.current = { map }
        requestMapResize()

        if (typeof ResizeObserver !== "undefined" && mapRef.current) {
          const observer = new ResizeObserver(() => {
            if (mapInstanceRef.current?.map) {
              requestMapResize()
            }
          })
          observer.observe(mapRef.current)
          resizeObserverRef.current = observer
        }

        const handleWindowResize = () => {
          if (mapInstanceRef.current?.map) {
            requestMapResize()
          }
        }

        window.addEventListener("resize", handleWindowResize, { passive: true })
        windowResizeHandlerRef.current = handleWindowResize

        setIsLoaded(true)
      } catch (mapError) {
        console.error("Failed to initialize TomTom map", mapError)
        const message =
          mapError instanceof Error ? mapError.message : "Unknown TomTom map error"
      }
    }

    initializeTomTomMap()

    return () => {
      isActive = false
      if (mapInstanceRef.current?.map) {
        try {
          mapInstanceRef.current.map.remove()
        } catch (mapRemovalError) {
          console.warn("Failed to remove TomTom map", mapRemovalError)
        }
      }
      mapInstanceRef.current = null
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = null
      }
      if (windowResizeHandlerRef.current) {
        window.removeEventListener("resize", windowResizeHandlerRef.current)
        windowResizeHandlerRef.current = null
      }
    }
  }, [title, address, lat, lng])

  const handleOpenInTomTom = useCallback(() => {
    const zoom = 16
    const url = `https://mydrive.tomtom.com/en_gb/#mode=drive&zoom=${zoom}&center=${lat},${lng}`
    window.open(url, "_blank")
  }, [lat, lng])

  return (
    <>
      {/* Main Map Container */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8 shadow-sm hover:shadow-md transition-shadow duration-300 border border-gray-100">
        {/* Header - Mobile Optimized */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" 
              />
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" 
              />
            </svg>
            Location/Map
          </h2>
          
          {/* Action Button - Mobile Optimized */}
          <Button
            variant="outline"
            className="w-full sm:w-auto px-3 py-2 text-sm text-blue-600 border-blue-600 hover:bg-blue-50 hover:border-blue-700 transition-all duration-200 font-medium"
            onClick={handleOpenInTomTom}
            disabled={!!error}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-4 w-4 sm:mr-2" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
              />
            </svg>
            <span className="hidden sm:inline">View in TomTom</span>
            <span className="sm:hidden">Open</span>
          </Button>
        </div>
        
        {/* Error State - Enhanced Mobile UI */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 sm:p-4 rounded-xl mb-4 flex items-start gap-3 animate-in fade-in duration-300">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-5 flex-shrink-0 mt-0.5" 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path 
                fillRule="evenodd" 
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" 
                clipRule="evenodd" 
              />
            </svg>
            <div className="flex-1">
              <p className="font-medium text-sm">{error}</p>
            </div>
          </div>
        )}
        
        {/* Map Container - Responsive with Touch Optimization */}
        <div className="relative rounded-xl sm:rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden shadow-inner">
          <div
            ref={mapRef}
            className="w-full transition-all duration-500 ease-out touch-pan-x touch-pan-y"
            style={{ 
              height: `${mapHeight}px`,
              opacity: isLoaded && !error ? 1 : 0,
              transform: isLoaded && !error ? 'scale(1)' : 'scale(0.98)'
            }}
          />
          
          {/* Loading State - Enhanced Animation */}
          {!isLoaded && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-blue-50 to-indigo-50 backdrop-blur-sm">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-3 border-blue-200 border-t-blue-600 shadow-lg"></div>
                <div className="absolute inset-0 animate-ping rounded-full h-12 w-12 border-2 border-blue-400 opacity-20"></div>
              </div>
              <p className="text-sm font-medium text-gray-600 animate-pulse">Loading map...</p>
            </div>
          )}
          
          {/* Map Controls Hint - Mobile Only */}
          {isLoaded && !error && isMobile && (
            <div className="absolute bottom-3 left-3 right-3 bg-white/90 backdrop-blur-md rounded-lg px-3 py-2 text-xs text-gray-600 shadow-lg border border-gray-200 animate-in slide-in-from-bottom duration-500">
              <p className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                </svg>
                <span className="font-medium">Pinch to zoom • Drag to pan</span>
              </p>
            </div>
          )}
        </div>
        
        {/* Address - Enhanced Typography */}
        <div className="mt-4 flex items-start gap-2 text-sm text-gray-600">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" 
            />
          </svg>
          <p className="leading-relaxed">{address}</p>
        </div>
      </div>

      {/* Fullscreen Modal - Mobile Only */}
      {isFullscreen && isMobile && (
        <div className="fixed inset-0 z-[9999] bg-black animate-in fade-in duration-300">
          {/* Fullscreen Header */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm z-10 px-4 py-3 safe-area-top">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-5 w-5" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" 
                  />
                </svg>
                <span className="font-semibold text-sm">{title}</span>
              </div>
              <button
                onClick={toggleFullscreen}
                className="text-white p-2 hover:bg-white/20 rounded-full transition-colors duration-200 active:scale-95"
                aria-label="Close fullscreen"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-6 w-6" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2.5} 
                    d="M6 18L18 6M6 6l12 12" 
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Fullscreen Map */}
          <div 
            className="w-full h-full"
            style={{
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none'
            }}
          >
            {/* Map will be re-rendered here or use portal */}
            <div className="w-full h-full flex items-center justify-center text-white">
              <p className="text-sm">Fullscreen map view</p>
            </div>
          </div>

          {/* Fullscreen Footer */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent backdrop-blur-sm z-10 px-4 py-4 safe-area-bottom">
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl shadow-lg transition-all duration-200 active:scale-98"
              onClick={handleOpenInTomTom}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5 mr-2" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
                />
              </svg>
              Open in TomTom Maps
            </Button>
            <p className="text-center text-xs text-gray-300 mt-3">{address}</p>
          </div>
        </div>
      )}
    </>
  )
}

export default MapView