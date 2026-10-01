"use client"

import React, { useState, useCallback, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
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
import SpotPreviewCard, { type SpotTraffic } from './SpotPreviewCard'
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

/**
 * Accepts the two image shapes that legitimately cross the Visit Spot link —
 * a remote `https://` photo from a provider, or a site-relative path under
 * the public image root — and rejects everything else.
 *
 * Rejected on purpose: `javascript:`/`data:` URIs, protocol-relative `//host`
 * (which resolves to an attacker host), plain `http://` and any `..` segment.
 * The value comes from a hand-editable query parameter and is passed to
 * next/image, so it is untrusted input.
 */
export function isSafeImageSrc(src: string): boolean {
  if (/^https:\/\/[^\s]+$/i.test(src)) return true
  // Segment-by-segment: a two-dot segment is inside the character class, so a
  // single shape test would let a traversal sequence escape the image root
  // (the shipped-image guard treats any absolute image path written in code
  // as a file that must resolve on disk, so the example cannot be spelled out).
  const segments = src.split('/')
  if (segments[0] !== '' || segments[1] !== 'images' || segments.length < 3) return false
  return segments
    .slice(2)
    .every((seg) => seg.length > 0 && seg !== '.' && seg !== '..' && /^[A-Za-z0-9._-]+$/.test(seg))
}

const ExploreMapView: React.FC = () => {
  const searchParams = useSearchParams()
  const [origin, setOrigin] = useState<LocationPoint | null>(null)
  const [destination, setDestination] = useState<LocationPoint | null>(null)
  const [recenterSignal, setRecenterSignal] = useState(0)
  // Deep-link from Suggested Spots / Recommended Cafes Visit buttons:
  // ?to=<name>&toLat=<lat>&toLon=<lon> prefills the destination once, with the
  // optional &traffic= and &img= params that feed the arrival card.
  // Finite numbers only; anything else is ignored (map renders unprefilled).
  const [spotPreview, setSpotPreview] = useState<{ traffic: SpotTraffic | null; image: string | null } | null>(null)
  useEffect(() => {
    const name = searchParams.get('to')
    const lat = Number(searchParams.get('toLat'))
    const lon = Number(searchParams.get('toLon'))
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) return
    setDestination((prev) =>
      prev !== null ? prev : { id: `spot:${lat},${lon}`, name, address: name, lat, lng: lon, category: 'Spot' }
    )
    // Only measured traffic is honoured; an unrecognised value hides the tag.
    const rawTraffic = searchParams.get('traffic')
    const traffic = rawTraffic === 'Low' || rawTraffic === 'Moderate' || rawTraffic === 'High' ? rawTraffic : null
    // Both shapes reach this link. Baguio's curated catalogue and the cafe
    // registry store site-relative paths; only enriched TomTom POIs carry
    // remote https URLs. The earlier https-only guard silently dropped every
    // local path, so the arrival card showed the brand mark for spots that
    // had a real photo on disk.
    //
    // Still strict: `javascript:`, `data:`, protocol-relative `//host` and
    // traversal (`..`) are rejected, because this value comes from a URL the
    // user can hand-edit and is handed straight to next/image.
    const rawImage = searchParams.get('img')
    const image = rawImage && isSafeImageSrc(rawImage) ? rawImage : null
    setSpotPreview({ traffic, image })
    // No recenterSignal bump here on purpose. The map already reacts to
    // `destination` changing, and bumping the signal used to invoke a
    // hardcoded Baguio fallback that undid the framing. The camera decision now
    // lives in one resolver, so arrival needs no nudge.
  }, [searchParams])
  const [preferences, setPreferences] = useState<RoutePreferences>(DEFAULT_PREFERENCES)
  const [mapStyle, setMapStyle] = useState<MapStyle>('main')
  const [isChangingStyle, setIsChangingStyle] = useState(false)

  const [tiltOn, setTiltOn] = useState(true)
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
    setSpotPreview(null)
  }, [clear])

  // Dismissing the card keeps the destination (it is a routing seed the user
  // can still plan from) and only hides the photo/title chrome.
  const handleDismissPreview = useCallback(() => setSpotPreview(null), [])

  const handleRecenter = useCallback(() => {
    setRecenterSignal((n) => n + 1)
  }, [])

  const handleToggleTilt = useCallback(() => {
    setTiltOn((v) => !v)
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
        tiltOn={tiltOn}
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
        tiltOn={tiltOn}
        onToggleTilt={handleToggleTilt}
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

      {spotPreview && (
        <SpotPreviewCard
          name={destination?.name ?? ''}
          image={spotPreview.image}
          traffic={spotPreview.traffic}
          onDismiss={handleDismissPreview}
        />
      )}

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
