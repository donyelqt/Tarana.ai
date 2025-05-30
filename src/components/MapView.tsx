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
    // Load Google Maps API script
    const loadGoogleMapsAPI = () => {
      const googleMapsScript = document.createElement('script')
      googleMapsScript.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`
      googleMapsScript.async = true
      googleMapsScript.defer = true
      googleMapsScript.onload = initializeMap
      googleMapsScript.onerror = () => setError("Failed to load Google Maps API")
      document.head.appendChild(googleMapsScript)

      return () => {
        // Clean up script tag on unmount
        document.head.removeChild(googleMapsScript)
      }
    }

    const initializeMap = () => {
      if (!mapRef.current) return
      
      try {
        // Create map instance
        const mapOptions = {
          center: { lat, lng },
          zoom: 15,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
        }
        
        // @ts-ignore - Google Maps API is loaded dynamically
        const map = new google.maps.Map(mapRef.current, mapOptions)
        
        // Add marker for the location
        // @ts-ignore - Google Maps API is loaded dynamically
        const marker = new google.maps.Marker({
          position: { lat, lng },
          map,
          title,
        })
        
        // Add info window
        // @ts-ignore - Google Maps API is loaded dynamically
        const infoWindow = new google.maps.InfoWindow({
          content: `<div><strong>${title}</strong><br>${address}</div>`,
        })
        
        // Open info window when marker is clicked
        // @ts-ignore - Google Maps API is loaded dynamically
        marker.addListener("click", () => {
          infoWindow.open(map, marker)
        })
        
        // Open info window by default
        infoWindow.open(map, marker)
        
        setIsLoaded(true)
      } catch (err) {
        console.error("Error initializing map:", err)
        setError("Failed to initialize map")
      }
    }

    const cleanup = loadGoogleMapsAPI()
    
    return cleanup
  }, [title, address, lat, lng])

  return (
    <div className="bg-white rounded-2xl p-6 mb-8 shadow border border-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Location/Map</h2>
        <Button 
          variant="outline" 
          size="sm" 
          className="text-blue-600 border-blue-600 hover:bg-blue-50"
          onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank')}
        >
          View on Google Maps
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