/**
 * Turning a plan day into a drawable route.
 *
 * Pure on purpose: no fetch, no map, no React. The route request is built here
 * and the caller decides whether to send it, which is what makes the edge
 * cases — a day with nothing resolved, a day longer than the API's waypoint cap
 * — testable without a map.
 */
import type { ItineraryData } from '@/app/itinerary-generator/types'
import type { LocationPoint, RoutePreferences, RouteRequest } from '@/types/route-optimization'

export interface PlanStop {
  title: string
  time: string
  coordinates: { lat: number; lon: number } | null
}

/**
 * `/api/routes/calculate` rejects more than 10 waypoints
 * (`api/routes/calculate/route.ts:25`). A multi-day itinerary routinely exceeds
 * that, which is the whole reason routes are drawn one day at a time.
 */
export const MAX_WAYPOINTS = 10

/** "Day 1 - Morning" -> "Day 1". Periods without a day label are their own group. */
function dayKey(period: string): string {
  const match = (period ?? '').match(/day\s*(\d+)/i)
  return match ? `Day ${match[1]}` : (period ?? '').trim()
}

/** Every activity belonging to one day, in itinerary order. */
export function collectPlanStops(
  itinerary: ItineraryData | null,
  day: string
): Array<{ title: string; time: string }> {
  if (!itinerary?.items?.length) return []
  const stops: Array<{ title: string; time: string }> = []
  for (const item of itinerary.items) {
    if (dayKey(item.period) !== day) continue
    for (const activity of item.activities ?? []) {
      if (!activity?.title) continue
      stops.push({ title: activity.title, time: activity.time ?? '' })
    }
  }
  return stops
}

function toPoint(stop: PlanStop, index: number): LocationPoint {
  return {
    id: `plan:${index}:${stop.title}`,
    name: stop.title,
    address: stop.title,
    lat: stop.coordinates!.lat,
    lng: stop.coordinates!.lon,
    category: 'Stop',
  }
}

export interface DayRouteInput {
  stops: PlanStop[]
  preferences: RoutePreferences
}

/**
 * Build the request for one day, or null when the day cannot be drawn.
 *
 * Unresolved stops are dropped rather than approximated: a route to a guessed
 * point is worse than no route. What remains needs at least two points, and
 * the middle ones are capped at the API's waypoint limit.
 */
export function buildDayRouteRequest(input: DayRouteInput): RouteRequest | null {
  const resolved = input.stops.filter(
    (s) => s.coordinates !== null && Number.isFinite(s.coordinates.lat) && Number.isFinite(s.coordinates.lon)
  )
  if (resolved.length < 2) return null

  const points = resolved.map(toPoint)
  const origin = points[0]
  const destination = points[points.length - 1]
  const middle = points.slice(1, -1).slice(0, MAX_WAYPOINTS)

  return {
    origin,
    destination,
    waypoints: middle,
    preferences: input.preferences,
  }
}