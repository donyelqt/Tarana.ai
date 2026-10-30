import type { ItineraryData } from '@/app/itinerary-generator/types'
import type { LocationPoint, RoutePreferences, RouteRequest } from '@/types/route-optimization'

export interface PlanStop {
  title: string
  time: string
  coordinates: { lat: number; lon: number } | null
}

export const MAX_WAYPOINTS = 10
export function dayKey(period: string): string {
  const match = (period ?? '').match(/day\s*(\d+)/i)
  return match ? `Day ${match[1]}` : (period ?? '').trim()
}

export function listPlanDays(itinerary: ItineraryData | null): string[] {
  if (!itinerary?.items?.length) return []
  const seen: string[] = []
  for (const item of itinerary.items) {
    const key = dayKey(item.period ?? '')
    if (!seen.includes(key)) seen.push(key)
  }
  return seen
}

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