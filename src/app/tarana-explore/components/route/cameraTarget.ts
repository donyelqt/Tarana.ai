
export interface CameraPoint {
  lat: number
  lng: number
}

export type CameraTarget =
  | { kind: 'fitBounds'; points: [number, number][] }
  | { kind: 'center'; center: [number, number]; zoom: number }
  | { kind: 'home' }
  | { kind: 'hold' }

export interface CameraInput {
  origin?: CameraPoint | null
  destination?: CameraPoint | null
  waypoints?: readonly (CameraPoint | null | undefined)[]
  routeCoords?: readonly (readonly [number, number])[]
  singleZoom: number
  homeCenter: [number, number]
  homeZoom: number
  maxFitZoom?: number
  planMode?: boolean
}

function finite(p: CameraPoint | null | undefined): p is CameraPoint {
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng)
}

export function resolveCameraTarget(input: CameraInput): CameraTarget {
  const { origin, destination, waypoints = [], routeCoords } = input

  const route = (routeCoords ?? []).filter(
    (c) => Array.isArray(c) && c.length === 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]),
  ) as [number, number][]
  if (route.length > 0) return { kind: 'fitBounds', points: route }

  const points: [number, number][] = []
  if (finite(origin)) points.push([origin.lng, origin.lat])
  if (finite(destination)) points.push([destination.lng, destination.lat])
  for (const w of waypoints) if (finite(w)) points.push([w.lng, w.lat])

  if (points.length > 1) return { kind: 'fitBounds', points }

  if (points.length === 1) return { kind: 'center', center: points[0], zoom: input.singleZoom }

  if (input.planMode) return { kind: 'hold' }
  return { kind: 'home' }
}

export function applyCameraTarget(
  map: { fitBounds?: (b: unknown, o?: unknown) => void; easeTo?: (o: unknown) => void } | null | undefined,
  target: CameraTarget,
  opts: { homeCenter: [number, number]; homeZoom: number; maxFitZoom?: number; padding?: number; duration?: number },
): boolean {
  if (!map) return false
  const duration = opts.duration ?? 1200

  if (target.kind === 'fitBounds') {
    const LngLatBounds = (window as unknown as { tt?: { LngLatBounds?: new () => { extend(p: [number, number]): void } } }).tt
      ?.LngLatBounds
    if (!LngLatBounds) {
      map.easeTo?.({ center: target.points[0], zoom: opts.maxFitZoom ?? 15, duration })
      return false
    }
    const bounds = new LngLatBounds()
    for (const p of target.points) bounds.extend(p)
    map.fitBounds?.(bounds, { padding: opts.padding ?? 60, maxZoom: opts.maxFitZoom ?? 15, duration })
    return true
  }

  if (target.kind === 'center') {
    map.easeTo?.({ center: target.center, zoom: target.zoom, duration })
    return true
  }

  if (target.kind === 'hold') return false

  map.easeTo?.({ center: opts.homeCenter, zoom: opts.homeZoom, duration })
  return true
}