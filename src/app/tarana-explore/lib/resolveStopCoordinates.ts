/**
 * Title -> coordinates for a generated plan.
 *
 * The itinerary pipeline returns titles, not positions: the strict JSON schema
 * has no `lat`/`lon` (it requires image/title/time/desc/tags), and the
 * sanitiser strips `metadata.lat`/`lon` before the client ever sees them. So
 * mapping a plan onto the map is a title join, and the failure mode that
 * matters is a *wrong* coordinate rather than a missing one — a Baguio pin for
 * a Manila stop, or Null Island for an unmatched title.
 *
 * Order is cheapest-and-most-trusted first, and every stage is city-scoped.
 * A miss returns null, which the sheet renders as "No location". It never
 * guesses and never falls back to a city centre.
 */

export interface StopCoordinates {
  lat: number
  lon: number
}

export interface CoordinateSources {
  /** Exact/fuzzy lookup in a known-place registry. */
  registry: (title: string) => StopCoordinates | null
  /** Provider lookup scoped to the generated city. */
  scopedSearch: (title: string, cityId: string) => Promise<StopCoordinates | null>
}

export interface ResolveStopOptions {
  cityId: string
  cityCenter: StopCoordinates
  sources: CoordinateSources
}

/**
 * Reject anything that is not a real position. A provider that answers with
 * 0,0 or a swapped pair would otherwise land a pin in the ocean or the wrong
 * hemisphere, and the caller cannot tell the difference.
 */
function isPlausible(point: StopCoordinates | null): point is StopCoordinates {
  if (!point) return false
  const { lat, lon } = point
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    // Null Island is the classic sentinel for "not found".
    !(lat === 0 && lon === 0)
  )
}

const cache = new Map<string, StopCoordinates | null>()

/** Cache is per (city, title). Exposed for tests; production never clears it. */
export function __resetStopCoordinateCache(): void {
  cache.clear()
}

export async function resolveStopCoordinates(
  title: string,
  options: ResolveStopOptions
): Promise<StopCoordinates | null> {
  const trimmed = title?.trim()
  if (!trimmed) return null

  const key = `${options.cityId}::${trimmed.toLowerCase()}`
  if (cache.has(key)) return cache.get(key) ?? null

  const fromRegistry = options.sources.registry(trimmed)
  if (isPlausible(fromRegistry)) {
    cache.set(key, fromRegistry)
    return fromRegistry
  }

  const fromProvider = await options.sources.scopedSearch(trimmed, options.cityId)
  if (isPlausible(fromProvider)) {
    cache.set(key, fromProvider)
    return fromProvider
  }

  // Cache the miss too: a title that does not resolve will not resolve on a
  // second pass, and re-querying the provider per re-render would hammer it.
  cache.set(key, null)
  return null
}