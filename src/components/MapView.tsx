"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "./ui/button"

interface MapViewProps {
  title: string
  address: string
  lat?: number
  lng?: number
}

const MapView = ({ title, address, lat = 16.4023, lng = 120.5960 }: MapViewProps) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Load HERE Maps API script
    const loadHereMapsAPI = () => {
      const hereMapsScript = document.createElement('script')
      hereMapsScript.src = `https://js.api.here.com/v3/3.1/mapsjs.bundle.js`
      hereMapsScript.async = true
      hereMapsScript.defer = true
      hereMapsScript.onload = initializeMap
      hereMapsScript.onerror = () => setError("Failed to load HERE Maps API")
      document.head.appendChild(hereMapsScript)

      return () => {
        document.head.removeChild(hereMapsScript)
      }
    }

    const initializeMap = () => {
      if (!mapRef.current) return
      try {
        // @ts-expect-error - HERE Maps API is loaded dynamically
        const H = window.H
        if (!H) {
          setError("HERE Maps API not available")
          return
        }
        // Create platform
        const platform = new H.service.Platform({
          apikey: process.env.NEXT_PUBLIC_HERE_MAPS_API_KEY
        })
        const defaultLayers = platform.createDefaultLayers()
        // Create map instance
        const map = new H.Map(
          mapRef.current,
          defaultLayers.vector.normal.map,
          {
            center: { lat, lng },
            zoom: 15,
            pixelRatio: window.devicePixelRatio || 1
          }
        )
        // Enable map events
        new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
        // Add UI controls
        H.ui.UI.createDefault(map, defaultLayers)
        // Add marker
        const marker = new H.map.Marker({ lat, lng })
        map.addObject(marker)
        // Add info bubble
        const bubble = new H.ui.InfoBubble({ lat, lng }, {
          content: `<div><strong>${title}</strong><br>${address}</div>`
        })
        map.getUi().addBubble(bubble)
        setIsLoaded(true)
      } catch (err) {
        console.error("Error initializing HERE map:", err)
        setError("Failed to initialize HERE map")
      }
    }

    const cleanup = loadHereMapsAPI()
    return cleanup
  }, [title, address, lat, lng])

  return (
    <div className="bg-white rounded-2xl p-6 mb-8 shadow border border-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Location/Map</h2>
        <Button 
          variant="outline" 
          className="text-blue-600 border-blue-600 hover:bg-blue-50"
          onClick={() => window.open(`https://www.here.com/search/?q=${lat},${lng}`, '_blank')}
        >
          View on HERE Maps
        </Button>
      </div>
      {error && (
        <div className="bg-red-50 text-red-500 p-4 rounded-lg mb-4">
          {error}
        </div>
      )}
      <div 
        ref={mapRef} 
        className="w-full h-[300px] rounded-lg bg-gray-100"
        style={{ opacity: isLoaded ? 1 : 0.7 }}
      >
        {!isLoaded && !error && (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
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