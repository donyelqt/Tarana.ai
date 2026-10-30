
export interface StopCoordinates {
  lat: number
  lon: number
}

export interface CoordinateSources {
  registry: (title: string) => StopCoordinates | null
  scopedSearch: (title: string, cityId: string) => Promise<StopCoordinates | null>
}

export interface ResolveStopOptions {
  cityId: string
  cityCenter: StopCoordinates
  sources: CoordinateSources
}

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
    !(lat === 0 && lon === 0)
  )
}

const cache = new Map<string, StopCoordinates | null>()

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

  cache.set(key, null)
  return null
}