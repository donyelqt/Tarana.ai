/**
 * Where should the map camera go?
 *
 * Extracted as a pure function because the answer was previously implicit in two
 * effects that fought each other. The recenter effect hardcoded Baguio as its
 * fallback, so any caller that bumped `recenterSignal` — including the
 * Suggested Spots deep link — snapped the camera back to Baguio city centre even
 * when a destination was selected. A Baguio spot 5km out (Great Wall) then sat
 * off-centre, and a Cebu or Manila spot sat hundreds of kilometres off-screen.
 *
 * The rule is a strict priority order, and "frame what the user is looking at"
 * always beats "go home":
 *
 *   1. An active route's own geometry  → fit its bounds
 *   2. Two or more endpoints           → fit their bounds
 *   3. Exactly one endpoint            → centre it
 *   4. Nothing selected                → Baguio (the app's home view)
 *
 * A single point is handled explicitly because a one-point LngLatBounds is a
 * degenerate box that TomTom cannot fit, and `easeTo` needs no bounds object at
 * all — gating it on the bounds constructor was enough to make it silently skip.
 */

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
  /** Route geometry, preferred over raw endpoints when it exists. */
  routeCoords?: readonly (readonly [number, number])[]
  /** Zoom used for a lone endpoint — street level, enough to place the pin. */
  singleZoom: number
  homeCenter: [number, number]
  homeZoom: number
  /** Cap for a multi-point fit. */
  maxFitZoom?: number
  /**
   * Plan mode with nothing to frame ("No plan yet", or an active day whose
   * stops all resolved to "No location" so planRoute published null). Holds
   * the current view instead of sliding home to Baguio.
   */
  planMode?: boolean
}

function finite(p: CameraPoint | null | undefined): p is CameraPoint {
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng)
}

export function resolveCameraTarget(input: CameraInput): CameraTarget {
  const { origin, destination, waypoints = [], routeCoords } = input

  // 1. An active route is the most specific thing on screen.
  const route = (routeCoords ?? []).filter(
    (c) => Array.isArray(c) && c.length === 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]),
  ) as [number, number][]
  if (route.length > 0) return { kind: 'fitBounds', points: route }

  const points: [number, number][] = []
  if (finite(origin)) points.push([origin.lng, origin.lat])
  if (finite(destination)) points.push([destination.lng, destination.lat])
  for (const w of waypoints) if (finite(w)) points.push([w.lng, w.lat])

  // 2. A route between two or more endpoints.
  if (points.length > 1) return { kind: 'fitBounds', points }

  // 3. One endpoint: centre it. Never fall through to home here — that is
  //    exactly the bug this function exists to remove.
  if (points.length === 1) return { kind: 'center', center: points[0], zoom: input.singleZoom }

  // 4. Nothing selected. Plan mode holds the current view (Cebu deep-link,
  //    user's pan, previous day's frame); route mode still homes to Baguio.
  if (input.planMode) return { kind: 'hold' }
  return { kind: 'home' }
}

/**
 * Applies a resolved target to a TomTom map. No-op on a missing map or missing
 * `LngLatBounds` for the fit path; `easeTo` is used for the centre path so it
 * works regardless of whether the bounds class is exposed.
 */
export function applyCameraTarget(
  map: { fitBounds?: (b: unknown, o?: unknown) => void; easeTo?: (o: unknown) => void } | null | undefined,
  target: CameraTarget,
  opts: { homeCenter: [number, number]; homeZoom: number; maxFitZoom?: number; padding?: number; duration?: number },
): boolean {
  if (!map) return false
  const duration = opts.duration ?? 1200

  if (target.kind === 'fitBounds') {
    // Needs the bounds constructor. Absent on the SDK, we degrade to centring on
    // the first point rather than doing nothing at all.
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

  // Hold: deliberately no camera call, so the current view stays. Returns
  // false so callers can tell "nothing moved" from "homed".
  if (target.kind === 'hold') return false

  map.easeTo?.({ center: opts.homeCenter, zoom: opts.homeZoom, duration })
  return true
}