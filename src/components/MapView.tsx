"use client"

import { useEffect, useRef, useState } from "react"
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

  const handleOpenInTomTom = () => {
    const zoom = 16
    const url = `https://mydrive.tomtom.com/en_gb/#mode=drive&zoom=${zoom}&center=${lat},${lng}`
    window.open(url, "_blank")
  }

  return (
    <div className="bg-white rounded-2xl p-6 mb-8 shadow border border-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Location/Map</h2>
        <Button
          variant="outline"
          className="text-blue-600 border-blue-600 hover:bg-blue-50"
          onClick={handleOpenInTomTom}
          disabled={!!error}
        >
          View in TomTom Maps
        </Button>
      </div>
      {error && (
        <div className="bg-red-50 text-red-500 p-4 rounded-lg mb-4">
          {error}
        </div>
      )}
      <div className="relative rounded-xl bg-gray-100 overflow-hidden">
        <div
          ref={mapRef}
          className="w-full h-[260px] sm:h-[320px] lg:h-[360px] transition-opacity duration-300 ease-in-out"
          style={{ opacity: isLoaded && !error ? 1 : 0 }}
        />
        {!isLoaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-9 w-9 border-2 border-blue-200 border-t-blue-500"></div>
          </div>
        )}
      </div>
      <div className="mt-4 text-sm text-gray-600">
        <p>{address}</p>
      </div>
    </div>
  )
}

export default MapView