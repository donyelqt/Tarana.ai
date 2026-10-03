'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { MapPinOff, X, Minus, MapPin } from 'lucide-react'
import type { StopCoordinates } from '../lib/resolveStopCoordinates'
import type { ItineraryData } from '@/app/itinerary-generator/types'

/** A stop whose title could not be turned into coordinates. */
export interface ResolvedStop {
  title: string
  time: string
  coordinates: { lat: number; lon: number } | null
}

/**
 * Plan results.
 *
 * Occupies the same slot as `BottomRouteSheet`, and the map shows at most one of
 * them: the route sheet when route mode is active, this when a plan exists.
 *
 * Honesty rule, inherited from the strict-city scope: a stop whose coordinates
 * cannot be resolved is still listed, marked "No location". Dropping it would
 * make a 3-stop day render as 2 and read as complete.
 */
export interface PlanSheetProps {
  itinerary: ItineraryData | null
  /**
   * Title -> coordinates. Injected rather than imported so the resolution
   * order (registry, then provider scoped to the city) is one decision owned
   * by the caller, and so an async lookup can settle after first paint.
   */
  resolveCoordinates: (title: string) => StopCoordinates | null | Promise<StopCoordinates | null>
  onSave: () => void
  onClose: () => void
  isSaving?: boolean
  /**
   * Collapse the sheet to a compact bar without discarding the itinerary, so
   * the map and its pins stay visible. Close still discards.
   */
  onMinimize?: () => void
  /** True while minimized: renders the restore bar instead of the panel. */
  minimized?: boolean
  /**
   * Selected day, owned by the caller so the sheet's tabs and the map's route
   * always agree on which day is drawn. Uncontrolled here would let the map
   * show day 1 while the sheet lists day 2.
   */
  activeDay: number
  onDayChange: (dayIndex: number) => void
}

/** "Day 1 - Morning" / "Day 2 - Evening" / "Anytime" -> "Day 1". */
function dayLabel(period: string): string {
  const match = period.match(/day\s*(\d+)/i)
  return match ? `Day ${match[1]}` : period
}

const PlanSheet: React.FC<PlanSheetProps> = ({
  itinerary,
  resolveCoordinates,
  onSave,
  onClose,
  onMinimize,
  minimized = false,
  isSaving = false,
  activeDay,
  onDayChange,
}) => {
  const days = useMemo(() => {
    if (!itinerary?.items?.length) return []
    const byDay = new Map<string, { period: string; activities: ItineraryData['items'][number]['activities'] }[]>()
    for (const item of itinerary.items) {
      const key = dayLabel(item.period ?? '')
      const bucket = byDay.get(key)
      if (bucket) bucket.push(item)
      else byDay.set(key, [item])
    }
    return [...byDay.entries()]
  }, [itinerary])

  const currentIndex = days.length === 0 ? 0 : Math.min(activeDay, days.length - 1)
  const current = days[currentIndex]

  const stopTitles = useMemo(
    () =>
      current
        ? current[1].flatMap((item) => (item.activities ?? []).map((a) => ({
            title: a.title,
            time: a.time ?? '',
          })))
        : [],
    [current]
  )

  // Resolution can be async (provider lookup). Start every stop unresolved and
  // let each answer land on its own, so a slow lookup never blanks the sheet
  // and a fast one is not held back by the slowest.
  const [resolved, setResolved] = useState<Record<string, StopCoordinates | null>>({})

  useEffect(() => {
    let cancelled = false
    for (const stop of stopTitles) {
      if (stop.title in resolved) continue
      Promise.resolve(resolveCoordinates(stop.title)).then((point) => {
        if (cancelled) return
        setResolved((prev) => (prev[stop.title] === point ? prev : { ...prev, [stop.title]: point }))
      })
    }
    return () => {
      cancelled = true
    }
  }, [stopTitles, resolveCoordinates])

  if (!itinerary || days.length === 0) return null

  const stops: ResolvedStop[] = stopTitles.map((stop) => ({
    ...stop,
    coordinates: stop.title in resolved ? resolved[stop.title] : null,
  }))

  // Minimized: a slim bar that keeps the plan reachable and the map clear.
  // Close still discards; minimize never does.
  if (minimized) {
    return (
      <div className="absolute bottom-0 left-0 right-0 z-30 px-4 pb-4">
        <button
          type="button"
          onClick={onMinimize}
          aria-label={`Restore plan: ${itinerary.title}`}
          className="mx-auto flex w-full max-w-2xl items-center gap-2 rounded-2xl border border-gray-200 bg-white/95 px-4 py-2.5 text-left shadow-lg backdrop-blur"
        >
          <MapPin className="h-4 w-4 flex-shrink-0 text-blue-600" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
            {itinerary.title}
          </span>
          <span className="flex-shrink-0 text-xs font-medium text-blue-600">Show</span>
        </button>
      </div>
    )
  }
  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 px-4 pb-4">
      <section
        aria-label="Your plan"
        className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white/95 shadow-xl backdrop-blur"
      >
        <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-gray-900">{itinerary.title}</h2>
            {itinerary.subtitle ? (
              <p className="truncate text-xs text-gray-500">{itinerary.subtitle}</p>
            ) : null}
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            {onMinimize ? (
              <button
                type="button"
                onClick={onMinimize}
                aria-label="Minimize plan"
                title="Minimize plan"
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <Minus className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close plan"
              title="Close plan"
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {days.length > 1 ? (
          <div role="tablist" aria-label="Plan days" className="flex gap-1.5 border-b border-gray-100 px-4 py-2">
            {days.map(([label], index) => (
              <button
                key={label}
                role="tab"
                type="button"
                aria-selected={index === activeDay}
                onClick={() => onDayChange(index)}
                className={
                  index === activeDay
                    ? 'rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white'
                    : 'rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:border-blue-300 hover:text-blue-600'
                }
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        <ol className="max-h-56 overflow-y-auto px-4 py-2">
          {stops.length === 0 ? (
            <li className="py-3 text-xs text-gray-500">Nothing scheduled for this day.</li>
          ) : (
            stops.map((stop, index) => (
              <li key={`${stop.title}-${index}`} className="flex items-start gap-3 py-2">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-[10px] font-semibold text-blue-700">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{stop.title}</p>
                  {stop.time ? <p className="text-xs text-gray-500">{stop.time}</p> : null}
                </div>
                {stop.coordinates ? null : (
                  <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                    <MapPinOff className="h-3 w-3" aria-hidden="true" />
                    No location
                  </span>
                )}
              </li>
            ))
          )}
        </ol>

        <footer className="border-t border-gray-100 px-4 py-3">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="w-full rounded-xl bg-gradient-to-b from-blue-700 to-blue-500 py-2 text-sm font-medium text-white transition-colors hover:to-blue-700 disabled:bg-none disabled:bg-gray-200 disabled:text-gray-400"
          >
            {isSaving ? 'Saving…' : 'Save itinerary'}
          </button>
        </footer>
      </section>
    </div>
  )
}

export default PlanSheet