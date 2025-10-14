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
  const markerInstanceRef = useRef<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    marker: any
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

  const buildMarkerElement = useCallback(() => {
    if (typeof document === "undefined") return null

    const wrapper = document.createElement("div")
    wrapper.className = "group relative flex h-14 w-14 items-center justify-center transition-all duration-500 ease-out hover:scale-110 active:scale-95 cursor-pointer"
    wrapper.style.filter = "drop-shadow(0 20px 40px rgba(59, 130, 246, 0.35))"

    const halo = document.createElement("span")
    halo.className = "absolute inset-[-20px] rounded-full bg-gradient-to-br from-blue-400/30 to-indigo-400/20 blur-3xl animate-pulse"
    wrapper.appendChild(halo)

    const outerRing = document.createElement("span")
    outerRing.className = "absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 opacity-90"
    wrapper.appendChild(outerRing)

    const core = document.createElement("span")
    core.className = "relative flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[inset_0_2px_8px_rgba(0,0,0,0.1)] transition-transform duration-300 group-hover:scale-105"
    wrapper.appendChild(core)

    const icon = document.createElement("span")
    icon.className = "relative h-6 w-6 transition-colors duration-300"
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="text-blue-600 transition-all duration-300 group-hover:text-indigo-600"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" /></svg>`
    core.appendChild(icon)

    return wrapper
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
      if (markerInstanceRef.current?.marker) {
        try {
          markerInstanceRef.current.marker.remove()
        } catch (markerCleanupError) {
          console.warn("Failed to remove previous TomTom marker", markerCleanupError)
        }
      }
      markerInstanceRef.current = null
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
        const markerElement = buildMarkerElement()
        if (markerElement) {
          const marker = new window.tt.Marker({ element: markerElement }).setLngLat([lng, lat]).addTo(map)
          markerInstanceRef.current = { marker }
        }

        const popupContent = `<div class="flex flex-col gap-2 rounded-2xl bg-white/95 px-5 py-4 text-left shadow-[0_20px_50px_rgba(0,0,0,0.12)] backdrop-blur-2xl border border-gray-100/50"><span class="text-[10px] font-semibold uppercase tracking-widest text-blue-600">Location</span><span class="text-base font-bold text-gray-900 leading-tight">${title}</span><span class="text-xs text-gray-500 leading-relaxed">${address}</span></div>`
        new window.tt
          .Popup({ offset: 42, className: "tomtom-popup-modern" })
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
      if (markerInstanceRef.current?.marker) {
        try {
          markerInstanceRef.current.marker.remove()
        } catch (markerRemovalError) {
          console.warn("Failed to remove TomTom marker", markerRemovalError)
        }
      }
      markerInstanceRef.current = null
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
      {/* Custom Popup Close Button Styling */}
      <style jsx global>{`
        .tomtom-popup-modern .mapboxgl-popup-close-button {
          width: 26px;
          height: 26px;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border: 1.5px solid #e2e8f0;
          border-radius: 8px;
          color: #64748b;
          font-size: 16px;
          font-weight: 600;
          line-height: 1 !important;
          padding: 0 !important;
          margin: 6px 6px 0 0;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          text-align: center !important;
          vertical-align: middle !important;
        }
        
        .tomtom-popup-modern .mapboxgl-popup-close-button:hover {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          border-color: #dc2626;
          color: #ffffff;
          transform: scale(1.05) rotate(90deg);
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        }
        
        .tomtom-popup-modern .mapboxgl-popup-close-button:active {
          transform: scale(0.95) rotate(90deg);
          box-shadow: 0 1px 4px rgba(239, 68, 68, 0.4);
        }
        
        .tomtom-popup-modern .mapboxgl-popup-content {
          padding: 0;
          border-radius: 16px;
        }
        
        .tomtom-popup-modern .mapboxgl-popup-tip {
          border-top-color: rgba(255, 255, 255, 0.95);
        }
      `}</style>
      {/* Main Map Container */}
      <div className="group relative mb-4 sm:mb-6 lg:mb-8 overflow-hidden rounded-xl sm:rounded-2xl lg:rounded-3xl border border-gray-200/60 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-300 hover:shadow-[0_20px_60px_rgb(0,0,0,0.08)]">
        {/* Header - Mobile Optimized */}
        <div className="flex flex-col gap-3 sm:gap-4 px-3 sm:px-4 lg:px-6 pt-4 sm:pt-5 lg:pt-6 pb-3 sm:pb-4 lg:pb-5 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100/80">
          <h2 className="flex items-center gap-3 text-lg font-bold tracking-tight text-gray-900 sm:text-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5 text-white" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" 
                />
              </svg>
            </div>
            <span>Map Overview</span>
          </h2>

          {/* Action Button - Mobile Optimized */}
          <Button
            variant="ghost"
            className="w-full rounded-full border border-blue-500/40 bg-white/60 px-4 py-2 text-sm font-medium text-blue-600 shadow-[0_18px_35px_-20px_rgba(59,130,246,0.85)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white sm:w-auto"
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
            <span className="hidden sm:inline">Open in TomTom</span>
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
        <div className="relative mx-2 sm:mx-3 mt-2 mb-4 sm:mb-6 overflow-hidden rounded-[20px] sm:rounded-[26px] border border-slate-200/30 bg-gradient-to-br from-slate-100/70 via-white/60 to-slate-100/30">
          <div
            ref={mapRef}
            className="w-full touch-pan-x touch-pan-y transition-all duration-700 ease-out"
            style={{
              height: `${mapHeight}px`,
              opacity: isLoaded && !error ? 1 : 0,
              transform: isLoaded && !error ? 'scale(1)' : 'scale(0.98)',
            }}
          />

          {/* Loading State - Enhanced Animation */}
          {!isLoaded && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-gradient-to-br from-white/80 via-blue-50/70 to-white/60 backdrop-blur-xl">
              <div className="flex w-40 flex-col gap-3">
                <div className="h-3 rounded-full bg-gradient-to-r from-blue-200/70 via-blue-100/40 to-transparent animate-[pulse_1.6s_infinite]" />
                <div className="h-3 w-3/4 rounded-full bg-gradient-to-r from-blue-200/70 via-blue-100/40 to-transparent animate-[pulse_1.6s_infinite] delay-150" />
                <div className="h-3 w-2/3 rounded-full bg-gradient-to-r from-blue-200/70 via-blue-100/40 to-transparent animate-[pulse_1.6s_infinite] delay-300" />
              </div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500/80">Initializing map</p>
            </div>
          )}

          {/* Map Controls Hint - Mobile Only */}
          {isLoaded && !error && isMobile && (
            <div className="absolute bottom-3 left-3 right-3 rounded-2xl border border-white/40 bg-white/70 px-3 py-2 text-xs text-gray-600 shadow-[0_16px_40px_-25px_rgba(15,23,42,0.55)] backdrop-blur-md animate-in slide-in-from-bottom duration-500">
              <p className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"
                  />
                </svg>
                <span className="font-medium">Pinch to zoom • Drag to pan</span>
              </p>
            </div>
          )}
        </div>
        
        {/* Address - Enhanced Typography */}
        <div className="mx-2 sm:mx-3 lg:mx-6 mb-3 sm:mb-4 lg:mb-6 flex items-start gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-white/60 bg-white/70 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-slate-600 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.35)]">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" 
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
          <p className="leading-relaxed text-slate-500">{address}</p>
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