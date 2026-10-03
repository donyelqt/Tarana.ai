'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import PlanIslandConfig from './PlanIslandConfig'
import PlanSheet from './PlanSheet'
import { usePlanMode } from '../hooks/usePlanMode'
import { resolveStopCoordinates, type StopCoordinates } from '../lib/resolveStopCoordinates'
import { collectPlanStops, listPlanDays } from '../lib/planRoute'
import { getActivityCoordinates } from '@/lib/data'
import { CITY_CONFIGS, getCityCenter } from '@/lib/data/cityConfig'
import type { CityId } from '@/lib/data/cityConfig'
import type { LocationPoint, SearchResult } from '@/types/route-optimization'
import type { FormData } from '@/app/itinerary-generator/types'


/**
 * Everything Plan Mode needs, behind one lazy boundary.
 *
 * This file exists as its own module because of what it imports. Plan Mode calls
 * Gala's generator, which imports the 37-activity catalog and its menus; wired
 * into the map's static graph that cost 448KB on /tarana-explore and failed the
 * bundle budget at 1029KB against a 639KB limit. Behind `next/dynamic` the map
 * page never loads it, and it arrives only when the user turns Plan Mode on.
 *
 * One state owner, two mount points. The sheet is a sibling of the island, so
 * the island hands this surface a DOM node to portal the config into. Keeping
 * both in one component is what keeps a single `usePlanMode` instance; two
 * lazy components would mean two generators and two billing paths.
 */
export interface PlanModeSurfaceProps {
  /** DOM node provided by the island for the planner config. */
  islandSlot: HTMLElement | null
  /**
   * Publishes the selected day's resolved stops so the map can draw pins and
   * a route. The surface owns the day so the sheet's tabs and the map's route
   * cannot disagree about which day is on screen.
   */
  onDayStops?: (points: LocationPoint[]) => void
}

const PlanModeSurface: React.FC<PlanModeSurfaceProps> = ({ islandSlot, onDayStops }) => {
  const plan = usePlanMode()
  const [activeDay, setActiveDay] = useState(0)

  const planCityId = (plan.formSnapshot?.cityId ?? 'baguio') as CityId

  /**
   * Title -> coordinates, cheapest trusted source first.
   *
   * The registry holds Baguio only, so it is deliberately not consulted for
   * another city: a Manila stop must never get a Baguio pin. The provider
   * lookup is bounded to the generated city and requires an exact name match,
   * because a wrong pin is worse than a missing one — a miss renders as
   * "No location" in the sheet rather than pretending it placed the stop.
   */
  const resolveForPlan = React.useCallback(
    (title: string): Promise<StopCoordinates | null> =>
      resolveStopCoordinates(title, {
        cityId: planCityId,
        cityCenter: getCityCenter(planCityId),
        sources: {
          registry: (name) => {
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
            if (name.trim().toLowerCase() !== first?.name?.trim().toLowerCase()) return null
            return { lat, lon: lng }
          },
        },
      }),
    [planCityId]
  )

  const handleSubmit = React.useCallback(
    (formData: FormData) => {
      void plan.generate(formData)
    },
    [plan]
  )

  /**
   * Resolve the selected day's stops and publish them for the map.
   *
   * Publishing re-runs on every answer, so the map fills in as lookups settle
   * rather than waiting on the slowest one. A day with fewer than two resolved
   * stops publishes nothing: the sheet still lists the stops, marked "No
   * location", and no route is drawn through a guess.
   */
  const days = useMemo(() => listPlanDays(plan.itinerary), [plan.itinerary])
  const dayLabel = days[Math.min(activeDay, Math.max(days.length - 1, 0))] ?? ''
  const dayStops = useMemo(
    () => (plan.itinerary ? collectPlanStops(plan.itinerary, dayLabel) : []),
    [plan.itinerary, dayLabel]
  )
  const [resolvedStops, setResolvedStops] = useState<Record<string, StopCoordinates | null>>({})

  useEffect(() => {
    let cancelled = false
    for (const stop of dayStops) {
      if (stop.title in resolvedStops) continue
      resolveForPlan(stop.title).then((point) => {
        if (cancelled) return
        setResolvedStops((prev) => (prev[stop.title] === point ? prev : { ...prev, [stop.title]: point }))
      })
    }
    return () => {
      cancelled = true
    }
  }, [dayStops, resolveForPlan, resolvedStops])

  useEffect(() => {
    if (!onDayStops) return
    onDayStops(
      dayStops
        .map((stop, index): LocationPoint | null => {
          const point = resolvedStops[stop.title]
          if (!point) return null
          return {
            id: `plan:${index}:${stop.title}`,
            name: stop.title,
            address: stop.title,
            lat: point.lat,
            lng: point.lon,
            category: 'Stop',
          }
        })
        .filter((p): p is LocationPoint => p !== null)
    )
  }, [dayStops, resolvedStops, onDayStops])

  return (
    <>
      {islandSlot
        ? createPortal(
            <PlanIslandConfig
              onSubmit={handleSubmit}
              isGenerating={plan.isGenerating}
              disabled={Boolean(plan.isOutOfCredits)}
            />,
            islandSlot
          )
        : null}
      <PlanSheet
        itinerary={plan.itinerary}
        resolveCoordinates={resolveForPlan}
        activeDay={activeDay}
        onDayChange={setActiveDay}
        onSave={() => {
          void plan.save(null)
        }}
        onClose={plan.clearPlan}
      />
    </>
  )
}

export default PlanModeSurface