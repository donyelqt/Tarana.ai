"use client"

import React, { useState, useCallback, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import {
  LocationPoint,
  RoutePreferences,
  RouteRequest,
} from '@/types/route-optimization'
import { MapStyle } from '@/lib/integrations/tomtomMapUtils'
import FloatingSearchCard from './FloatingSearchCard'
import BottomRouteSheet from './BottomRouteSheet'
import TrafficBadge from './TrafficBadge'
import MapControls from './MapControls'
import { useRouteCalculation } from '../hooks/useRouteCalculation'

// Map must be client-only and skip SSR (TomTom uses window)
const InteractiveRouteMap = dynamic(
  () => import('./route/InteractiveRouteMap'),
  { ssr: false },
)

const POPULAR_LOCATIONS: LocationPoint[] = [
  { id: 'uc_baguio', name: 'University of the Cordilleras', address: 'Gov. Pack Rd, Baguio City', lat: 16.4088, lng: 120.5979, category: 'Education' },
  { id: 'newtown_plaza', name: 'New Town Plaza Hotel', address: 'Navy Base Road, Baguio City', lat: 16.4158, lng: 120.6122, category: 'Hotel' },
  { id: 'burnham_park', name: 'Burnham Park', address: 'Downtown Baguio City', lat: 16.4095, lng: 120.5948, category: 'Park' },
  { id: 'sm_baguio', name: 'SM City Baguio', address: 'Upper Session Rd, Baguio City', lat: 16.4088, lng: 120.5993, category: 'Shopping' },
  { id: 'session_road', name: 'Session Road', address: 'Session Rd, Baguio City', lat: 16.4124, lng: 120.5973, category: 'Shopping' },
  { id: 'baguio_cathedral', name: 'Baguio Cathedral', address: 'Cathedral Loop, Baguio City', lat: 16.4138, lng: 120.5934, category: 'Landmark' },
  { id: 'camp_john_hay', name: 'Camp John Hay', address: 'Loakan Rd, Baguio City', lat: 16.4025, lng: 120.5897, category: 'Recreation' },
  { id: 'mines_view_park', name: 'Mines View Park', address: 'Mines View Park Rd, Baguio City', lat: 16.4089, lng: 120.5678, category: 'Tourist Spot' },
]

const DEFAULT_PREFERENCES: RoutePreferences = {
  routeType: 'fastest',
  vehicleType: 'car',
  avoidTrafficJams: true,
}

const ExploreMapView: React.FC = () => {
  const [origin, setOrigin] = useState<LocationPoint | null>(null)
  const [destination, setDestination] = useState<LocationPoint | null>(null)
  const [preferences, setPreferences] = useState<RoutePreferences>(DEFAULT_PREFERENCES)
  const [mapStyle, setMapStyle] = useState<MapStyle>('main')
  const [isChangingStyle, setIsChangingStyle] = useState(false)
  const [recenterSignal, setRecenterSignal] = useState(0)
  const styleControlRef = useRef<{ changeStyle: (style: MapStyle) => void } | null>(null);

  const { state, calculate, selectAlternative, refreshTraffic, clear } = useRouteCalculation()

  const handlePreferencesChange = useCallback((patch: Partial<RoutePreferences>) => {
    setPreferences((prev) => ({ ...prev, ...patch }))
  }, [])

  const handleSubmit = useCallback(() => {
    if (!origin || !destination) return
    const request: RouteRequest = {
      origin,
      destination,
      preferences: {
        ...preferences,
        departureTime:
          preferences.departureTime && preferences.departureTime instanceof Date
            ? preferences.departureTime
            : preferences.departureTime
              ? new Date(preferences.departureTime)
              : undefined,
      },
    }
    calculate(request)
  }, [origin, destination, preferences, calculate])

  const handleClose = useCallback(() => {
    clear()
    setOrigin(null)
    setDestination(null)
  }, [clear])

  const handleRecenter = useCallback(() => {
    setRecenterSignal((n) => n + 1)
  }, [])

  // Silent 5-minute traffic refresh — no UI button (matches Google Maps' silent updates)
  useEffect(() => {
    if (!state.currentRoute) return
    const id = setInterval(() => {
      refreshTraffic()
    }, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [state.currentRoute, refreshTraffic])

  return (
    <div className="relative h-full w-full overflow-hidden">
      <InteractiveRouteMap
        currentRoute={state.currentRoute}
        alternativeRoutes={state.alternativeRoutes}
        trafficConditions={state.trafficConditions}
        origin={origin}
        destination={destination}
        waypoints={[]}
        isLoading={state.isCalculating}
        onRouteSelect={selectAlternative}
        currentMapStyle={mapStyle}
        onStyleChange={setMapStyle}
        onStyleChanging={setIsChangingStyle}
        recenterSignal={recenterSignal}
        styleControlRef={styleControlRef}
      />

      <FloatingSearchCard
        origin={origin}
        destination={destination}
        preferences={preferences}
        onOriginChange={setOrigin}
        onDestinationChange={setDestination}
        onPreferencesChange={handlePreferencesChange}
        onSubmit={handleSubmit}
        isCalculating={state.isCalculating}
        popularLocations={POPULAR_LOCATIONS}
        disabled={false}
      />

      <TrafficBadge trafficConditions={state.trafficConditions} />

      <MapControls
        currentMapStyle={mapStyle}
        isChangingStyle={isChangingStyle}
        onStyleChange={(next) => styleControlRef.current?.changeStyle(next)}
        onRecenter={handleRecenter}
      />

      <BottomRouteSheet
        currentRoute={state.currentRoute}
        trafficAnalysis={state.trafficConditions}
        routeComparison={state.routeComparison}
        alternatives={state.alternativeRoutes}
        onSelectAlternative={selectAlternative}
        onClose={handleClose}
        lastUpdated={state.lastUpdated}
      />

      {/* Subtle map error toast (non-blocking) */}
      {state.error && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-red-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium">
          {state.error}
        </div>
      )}
    </div>
  )
}

export default ExploreMapView
