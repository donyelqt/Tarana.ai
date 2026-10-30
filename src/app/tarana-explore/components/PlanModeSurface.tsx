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


export interface PlanModeSurfaceProps {
  islandSlot: HTMLElement | null
  onDayStops?: (points: LocationPoint[]) => void
  onGeneratingChange?: (busy: boolean) => void
}

const PlanModeSurface: React.FC<PlanModeSurfaceProps> = ({
  islandSlot,
  onDayStops,
  onGeneratingChange,
}) => {
  const plan = usePlanMode()
  const [activeDay, setActiveDay] = useState(0)
  const [sheetMinimized, setSheetMinimized] = useState(false)

  React.useEffect(() => {
    onGeneratingChange?.(plan.isGenerating)
  }, [plan.isGenerating, onGeneratingChange])

  const planCityId = (plan.formSnapshot?.cityId ?? 'baguio') as CityId

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
        onMinimize={() => setSheetMinimized((v) => !v)}
        minimized={sheetMinimized}
      />
    </>
  )
}

export default PlanModeSurface