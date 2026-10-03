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
// Plan Mode's generator, catalog, and menus are deliberately NOT imported here.
// A static import pulled the 37-activity catalog into the map's graph and cost
// 448KB on /tarana-explore (1029KB against a 639KB budget). It loads on demand.
const PlanModeSurface = dynamic(() => import('./PlanModeSurface'), { ssr: false })

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
/**
 * Parses a Visit Spot deep link. Pure so the arrival behaviour is testable
 * without mounting a map, and so the caller can use it during render to seed
 * the map's first camera position.
 */
export function parseDeepLink(params: URLSearchParams): {
  destination: LocationPoint | null
  preview: { traffic: SpotTraffic | null; image: string | null } | null
} {
  const name = params.get('to')
  const lat = Number(params.get('toLat'))
  const lon = Number(params.get('toLon'))
  // Number(null) is 0, which is finite — require the raw values to be present
  // so a name-only link cannot silently land the map on Null Island.
  if (!name || params.get('toLat') === null || params.get('toLon') === null) {
    return { destination: null, preview: null }
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { destination: null, preview: null }

  // Only measured traffic is honoured; an unrecognised value hides the tag.
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
  // Parsed during render, NOT in an effect. `useSearchParams` is available
  // synchronously inside this Suspense boundary, so the destination exists on
  // the FIRST render and can seed the map's initial camera. Parsing it in an
  // effect meant the map initialised on Baguio and could only jump to the spot
  // after the SDK finished loading — the visible "wrong place first, then
  // slide over" delay.
  const deepLink = useMemo(() => parseDeepLink(searchParams), [searchParams])
  const [origin, setOrigin] = useState<LocationPoint | null>(null)
  const [destination, setDestination] = useState<LocationPoint | null>(deepLink.destination)
  const [recenterSignal, setRecenterSignal] = useState(0)
  // Deep-link from Suggested Spots / Recommended Cafes Visit buttons:
  // ?to=<name>&toLat=<lat>&toLon=<lon> prefills the destination once, with the
  // optional &traffic= and &img= params that feed the arrival card.
  const [spotPreview, setSpotPreview] = useState(deepLink.preview)
  const [preferences, setPreferences] = useState<RoutePreferences>(DEFAULT_PREFERENCES)
  const [mapStyle, setMapStyle] = useState<MapStyle>('main')
  const [isChangingStyle, setIsChangingStyle] = useState(false)

  const [tiltOn, setTiltOn] = useState(true)
  // Plan Mode is display state: toggling it must not touch origin/destination,
  // which are the user's route work, not mode state.
  const [planMode, setPlanMode] = useState(false)
  // Mirrors recenterSignal: a counter the island watches to collapse itself on
  // a mode change. A callback would need the island's setter, which it owns.
  const [collapseIslandSignal, setCollapseIslandSignal] = useState(0)
  const styleControlRef = useRef<{ changeStyle: (style: MapStyle) => void } | null>(null);
  // Signed zoom steps, mirroring recenterSignal: the map owns the camera, so
  // the rail sends a step and the map applies it.
  const [zoomSignal, setZoomSignal] = useState(0)

  const handleZoom = useCallback((steps: number) => {
    setZoomSignal((n) => n + steps)
  }, [])

  const { state, calculate, selectAlternative, refreshTraffic, clear } = useRouteCalculation()

  // The island hands this node to the lazily-loaded plan surface, which
  // portals the planner config into it. Held here so the island's own chunk
  // never imports Gala's generator or the activity catalog.
  const [planSlot, setPlanSlot] = useState<HTMLElement | null>(null)
  // The route currently drawn by the plan, held separately from the planner's
  // own route so switching modes swaps the map cleanly instead of leaving a
  // plan route underneath the route planner's markers.
  const [planRoute, setPlanRoute] = useState<RouteRequest | null>(null)

  // Plan Mode draws the selected day through the same route pipeline the
  // planner uses. The day's route anchors on its own first and last stop, so
  // the user's route endpoints are never overwritten — they live in this same
  // parent state and return untouched when the mode is left.
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
      // Fewer than two resolved stops is an honest empty, not a broken request:
      // the sheet still lists those stops marked "No location", and the map
      // draws nothing rather than routing to a guess.
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

  const handleTogglePlan = useCallback(() => {
    setPlanMode((v) => !v)
    // Collapse on the way in and on the way out: the island is about to swap
    // its whole contents, and a half-open card mid-swap reads as a glitch.
    setCollapseIslandSignal((n) => n + 1)
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
        // Arriving from a deep link: the map's very first paint is already on
        // the spot, so there is no Baguio flash and no post-load slide.
        initialCenter={destination ? [destination.lng, destination.lat] : null}
        currentRoute={state.currentRoute}
        alternativeRoutes={state.alternativeRoutes}
        trafficConditions={state.trafficConditions}
        // In plan mode the drawn route is the selected day's, not the user's
        // own route: the day's first and last resolved stop become the
        // endpoints and the rest become numbered waypoint pins. Route mode
        // keeps the user's endpoints untouched.
        origin={planMode ? planRoute?.origin ?? null : origin}
        destination={planMode ? planRoute?.destination ?? null : destination}
        waypoints={planMode ? planRoute?.waypoints ?? [] : []}
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
        onZoom={handleZoom}
        tiltOn={tiltOn}
        onToggleTilt={handleToggleTilt}
        planMode={planMode}
        onTogglePlan={handleTogglePlan}
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

      {/*
        One bottom sheet at a time. The route sheet returns null without a
        route, so rendering the plan surface only in plan mode is what stops
        the two stacking. The surface is lazily loaded: it carries Gala's
        generator and the activity catalog, which have no business in the map's
        initial bundle.
      */}
      {planMode && (
        <PlanModeSurface
          islandSlot={planSlot}
          onDayStops={handlePlanDayStops}
        />
      )}
      {/*
        The plan's route is drawn in the same slot the route planner uses, but
        never on top of it: plan mode owns the endpoints while it is on, so the
        user's own route stays in parent state and comes back untouched when
        they leave the mode.
      */}

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
