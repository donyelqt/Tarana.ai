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
import { usePlanMode } from '../hooks/usePlanMode'
import PlanSheet from './PlanSheet'
import { resolveStopCoordinates } from '../lib/resolveStopCoordinates'
import { getActivityCoordinates } from '@/lib/data'
import { CITY_CONFIGS, getCityCenter } from '@/lib/data/cityConfig'
import type { CityId } from '@/lib/data/cityConfig'

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

  const { state, calculate, selectAlternative, refreshTraffic, clear } = useRouteCalculation()

  const plan = usePlanMode()
  // Coordinate resolution for a generated plan. The registry is Baguio's
  // known-place map; anything else is looked up through the provider, scoped
  // to the generated city's bounds so a Manila stop can never land in Baguio.
  // A miss stays null and the sheet renders it as "No location" — never a
  // guessed point, never the city centre.
  const planCityId = (plan.formSnapshot?.cityId ?? 'baguio') as CityId
  const resolveForPlan = useCallback(
    (title: string) =>
      resolveStopCoordinates(title, {
        cityId: planCityId,
        cityCenter: getCityCenter(planCityId),
        sources: {
          registry: (name) => {
            // The registry holds Baguio only. Asking it for another city's stop
            // would risk a Baguio pin for a Manila stop.
            if (planCityId !== 'baguio') return null
            const found = getActivityCoordinates(name)
            return found ? { lat: found.lat, lon: found.lon } : null
          },
          scopedSearch: async (name) => {
            const { bounds } = CITY_CONFIGS[planCityId]
            const params = new URLSearchParams({
              q: name,
              bounds: JSON.stringify({
                topLeft: { lat: bounds.north, lng: bounds.west },
                bottomRight: { lat: bounds.south, lng: bounds.east },
              }),
            })
            const res = await fetch(`/api/locations/search?${params.toString()}`)
            if (!res.ok) return null
            const data = (await res.json()) as { results?: SearchResult[] }
            const first = data.results?.[0]
            const lat = first?.coordinates?.lat
            const lng = first?.coordinates?.lng
            if (typeof lat !== 'number' || typeof lng !== 'number') return null
            // Exact-ish name match only. A fuzzy hit for "Temple" in Cebu is
            // not this stop, and a wrong pin is worse than a missing one.
            const normalizedQuery = name.trim().toLowerCase()
            const normalizedHit = first?.name?.trim().toLowerCase()
            if (normalizedQuery !== normalizedHit) return null
            return { lat, lon: lng }
          },
        },
      }),
    [planCityId]
  )

  const handlePlanSubmit = useCallback(
    async (formData: Parameters<typeof plan.generate>[0]) => {
      await plan.generate(formData)
    },
    [plan]
  )

  const handleClosePlan = useCallback(() => {
    plan.clearPlan()
  }, [plan])

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
        collapseSignal={collapseIslandSignal}
        planMode={planMode}
        onPlanSubmit={handlePlanSubmit}
        isPlanning={plan.isGenerating}
        planDisabled={Boolean(plan.isOutOfCredits)}
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
        route, so gating the plan sheet on plan mode is what stops the two
        stacking on top of each other.
      */}
      {planMode && (
        <PlanSheet
          itinerary={plan.itinerary}
          resolveCoordinates={resolveForPlan}
          onSave={() => {
            void plan.save(null)
          }}
          onClose={handleClosePlan}
        />
      )}

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
