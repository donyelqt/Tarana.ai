"use client"

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import {
  LocationPoint,
  RoutePreferences,
  RouteRequest,
  type SearchResult,
} from '@/types/route-optimization'
import { MapStyle } from '@/lib/integrations/tomtomMapUtils'
import FloatingSearchCard from './FloatingSearchCard'
import BottomRouteSheet from './BottomRouteSheet'
import TrafficBadge from './TrafficBadge'
import MapControls from './MapControls'
import SpotPreviewCard, { type SpotTraffic } from './SpotPreviewCard'
import { useRouteCalculation } from '../hooks/useRouteCalculation'
import { buildDayRouteRequest } from '../lib/planRoute'



const PlanModeSurface = dynamic(() => import('./PlanModeSurface'), { ssr: false })


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


export function isSafeImageSrc(src: string): boolean {
  if (/^https:\/\/[^\s]+$/i.test(src)) return true
  
  
  
  
  const segments = src.split('/')
  if (segments[0] !== '' || segments[1] !== 'images' || segments.length < 3) return false
  return segments
    .slice(2)
    .every((seg) => seg.length > 0 && seg !== '.' && seg !== '..' && /^[A-Za-z0-9._-]+$/.test(seg))
}

export function parseDeepLink(params: URLSearchParams): {
  destination: LocationPoint | null
  preview: { traffic: SpotTraffic | null; image: string | null } | null
} {
  const name = params.get('to')
  const lat = Number(params.get('toLat'))
  const lon = Number(params.get('toLon'))
  
  
  if (!name || params.get('toLat') === null || params.get('toLon') === null) {
    return { destination: null, preview: null }
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { destination: null, preview: null }

  
  const rawTraffic = params.get('traffic')
  const traffic =
    rawTraffic === 'Low' || rawTraffic === 'Moderate' || rawTraffic === 'High' ? rawTraffic : null
  const rawImage = params.get('img')
  const image = rawImage && isSafeImageSrc(rawImage) ? rawImage : null

  return {
    destination: { id: `spot:${lat},${lon}`, name, address: name, lat, lng: lon, category: 'Spot' },
    preview: { traffic, image },
  }
}

const ExploreMapView: React.FC = () => {
  const searchParams = useSearchParams()
  
  
  
  
  
  
  const deepLink = useMemo(() => parseDeepLink(searchParams), [searchParams])
  const [origin, setOrigin] = useState<LocationPoint | null>(null)
  const [destination, setDestination] = useState<LocationPoint | null>(deepLink.destination)
  const [recenterSignal, setRecenterSignal] = useState(0)
  
  
  
  const [spotPreview, setSpotPreview] = useState(deepLink.preview)
  const [preferences, setPreferences] = useState<RoutePreferences>(DEFAULT_PREFERENCES)
  const [mapStyle, setMapStyle] = useState<MapStyle>('main')
  const [isChangingStyle, setIsChangingStyle] = useState(false)

  const [tiltOn, setTiltOn] = useState(true)
  
  
  const [planMode, setPlanMode] = useState(false)
  
  
  const [collapseIslandSignal, setCollapseIslandSignal] = useState(0)
  const styleControlRef = useRef<{ changeStyle: (style: MapStyle) => void } | null>(null);
  
  
  const [zoomSignal, setZoomSignal] = useState(0)

  const handleZoom = useCallback((steps: number) => {
    setZoomSignal((n) => n + steps)
  }, [])

  
  
  const [planGenerating, setPlanGenerating] = useState(false)

  const { state, calculate, selectAlternative, refreshTraffic, clear } = useRouteCalculation()

  
  
  
  const [planSlot, setPlanSlot] = useState<HTMLElement | null>(null)
  
  
  
  const [planRoute, setPlanRoute] = useState<RouteRequest | null>(null)

  
  
  
  
  
  
  const handlePlanDayStops = useCallback(
    (points: LocationPoint[]) => {
      const request =
        points.length < 2
          ? null
          : buildDayRouteRequest({
              stops: points.map((p) => ({
                title: p.name,
                time: '',
                coordinates: { lat: p.lat, lon: p.lng },
              })),
              preferences,
            })

      setPlanRoute(request)
      
      
      
      if (request) calculate(request)
    },
    [preferences, calculate]
  )

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
    setPlanRoute(null)
    if (planMode) return
    setOrigin(null)
    setDestination(null)
    setSpotPreview(null)
  }, [clear, planMode])

  
  
  const handleDismissPreview = useCallback(() => setSpotPreview(null), [])

  const handleRecenter = useCallback(() => {
    setRecenterSignal((n) => n + 1)
  }, [])

  const handleToggleTilt = useCallback(() => {
    setTiltOn((v) => !v)
  }, [])

  const handleTogglePlan = useCallback(() => {
    if (!planMode) {
      
      
      
      handleDismissPreview()
    } else {
      
      
      
      
      
      
      
      clear()
      setPlanRoute(null)
    }
    setPlanMode((v) => !v)
    
    
    setCollapseIslandSignal((n) => n + 1)
  }, [planMode, clear, handleDismissPreview])

  
  
  
  useEffect(() => {
    if (!state.currentRoute || planMode) return
    const id = setInterval(() => {
      refreshTraffic()
    }, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [state.currentRoute, planMode, refreshTraffic])

  return (
    <div className="relative h-full w-full overflow-hidden">
      <InteractiveRouteMap
        
        
        initialCenter={destination ? [destination.lng, destination.lat] : null}
        currentRoute={state.currentRoute}
        alternativeRoutes={state.alternativeRoutes}
        trafficConditions={state.trafficConditions}
        
        
        
        
        
        
        origin={planMode ? null : origin}
        destination={planMode ? null : destination}
        waypoints={
          planMode
            ? [
                ...(planRoute?.origin ? [planRoute.origin] : []),
                ...(planRoute?.waypoints ?? []),
                ...(planRoute?.destination ? [planRoute.destination] : []),
              ]
            : []
        }
        
        
        
        planMode={planMode}
        isLoading={state.isCalculating}
        onRouteSelect={selectAlternative}
        currentMapStyle={mapStyle}
        onStyleChange={setMapStyle}
        onStyleChanging={setIsChangingStyle}
        recenterSignal={recenterSignal}
        zoomSignal={zoomSignal}
        tiltOn={tiltOn}
        styleControlRef={styleControlRef}
      />

      <FloatingSearchCard
        origin={origin}
        destination={destination}
        preferences={preferences}
        collapseSignal={collapseIslandSignal}
        planMode={planMode}
        onPlanSlot={setPlanSlot}
        isPlanning={planGenerating}
        onOriginChange={setOrigin}
        onDestinationChange={setDestination}
        onPreferencesChange={handlePreferencesChange}
        onSubmit={handleSubmit}
        isCalculating={state.isCalculating}
        popularLocations={POPULAR_LOCATIONS}
        disabled={false}
      />

      {}
      {!planMode && <TrafficBadge trafficConditions={state.trafficConditions} />}

      <MapControls
        currentMapStyle={mapStyle}
        isChangingStyle={isChangingStyle}
        onStyleChange={(next) => styleControlRef.current?.changeStyle(next)}
        onRecenter={handleRecenter}
        onZoom={handleZoom}
        tiltOn={tiltOn}
        onToggleTilt={handleToggleTilt}
        planMode={planMode}
        onTogglePlan={handleTogglePlan}
      />

      {!planMode && (
        <BottomRouteSheet
          currentRoute={state.currentRoute}
          trafficAnalysis={state.trafficConditions}
          routeComparison={state.routeComparison}
          alternatives={state.alternativeRoutes}
          onSelectAlternative={selectAlternative}
          onClose={handleClose}
          lastUpdated={state.lastUpdated}
        />
      )}

      {}
      {planMode && (
        <PlanModeSurface
          islandSlot={planSlot}
          onDayStops={handlePlanDayStops}
          onGeneratingChange={setPlanGenerating}
        />
      )}
      {}

      {spotPreview && (
        <SpotPreviewCard
          name={destination?.name ?? ''}
          image={spotPreview.image}
          traffic={spotPreview.traffic}
          onDismiss={handleDismissPreview}
        />
      )}

      {}
      {state.error && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-red-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium">
          {state.error}
        </div>
      )}
    </div>
  )
}

export default ExploreMapView
