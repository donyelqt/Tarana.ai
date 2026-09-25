import "dotenv/config"
import { getCityConfig } from "../src/lib/data/cityConfig"
import { isTouristPoi, selectTouristPois, TOURIST_POI_TARGET, TARGET_CITY_IDS, type TargetCityId } from "../src/lib/data/touristPoi"
import { TOURIST_QUERY_BUCKETS } from "../src/lib/services/touristPoiService"
import type { SearchResult } from "../src/types/route-optimization"

/**
 * Read-only live coverage probe for the 50-tourist-POI target.
 *
 * It calls TomTom directly instead of importing the service so it never touches
 * Supabase or the `places` cache. Intended use is pre-implementation evidence
 * and post-deploy spot checks, not a CI gate (it needs a live API key).
 *
 * No API key or raw request URL is printed.
 */

const API_KEY = process.env.TOMTOM_API_KEY || process.env.NEXT_PUBLIC_TOMTOM_API_KEY || ""
if (!API_KEY) {
  console.error("BLOCKED: Missing TOMTOM_API_KEY (or NEXT_PUBLIC_TOMTOM_API_KEY) in env")
  process.exit(1)
}

const REFERER =
  process.env.TOMTOM_REFERER ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXTAUTH_URL ||
  "https://tarana-ai.vercel.app"

const REQUEST_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "User-Agent": "Tarana.ai/1.0",
  Referer: REFERER,
}
try {
  REQUEST_HEADERS.Origin = new URL(REFERER).origin
} catch {
  // Non-URL referer: forward as Referer only, mirroring the service.
}

type CoverageRow = {
  city: string
  raw: number
  accepted: number
  outOfBounds: number
  ineligible: number
  overCap: number
  latencyMs: number
  sample: string[]
  topRejected: string[]
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

/** Map one untrusted TomTom result; the shape is read field-by-field. */
function mapResult(raw: unknown): SearchResult {
  const record = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const poi = (record.poi && typeof record.poi === "object" ? record.poi : {}) as Record<string, unknown>
  const address = (record.address && typeof record.address === "object" ? record.address : {}) as Record<string, unknown>
  const position = (record.position && typeof record.position === "object" ? record.position : {}) as Record<string, unknown>
  const categories = Array.isArray(poi.categories)
    ? poi.categories.filter((value): value is string => typeof value === "string")
    : []
  const categorySet = Array.isArray(poi.categorySet)
    ? poi.categorySet
        .map((entry) => (entry && typeof entry === "object" ? readNumber((entry as Record<string, unknown>).id) : 0))
        .filter((id) => id > 0)
    : []
  const score = readNumber(record.score)

  return {
    id: readString(record.id),
    name: readString(poi.name) || readString(address.freeformAddress),
    address: readString(address.freeformAddress),
    coordinates: { lat: readNumber(position.lat), lng: readNumber(position.lon) },
    category: categories[0] ?? "Location",
    categories,
    categorySet,
    relevanceScore: score,
    popularityIndex: Math.min(score * 10, 100),
    placeType: readString(record.type),
  }
}

async function probeCity(cityId: string): Promise<CoverageRow> {
  const city = getCityConfig(cityId)
  const bounds = city.bounds
  const raw: SearchResult[] = []
  const t0 = Date.now()

  for (const bucket of TOURIST_QUERY_BUCKETS) {
    const params = new URLSearchParams({
      key: API_KEY,
      query: `${bucket} ${city.name}`,
      limit: "100",
      language: city.language,
      view: "Unified",
    })
    if (city.countrySet) params.set("countrySet", city.countrySet)
    params.set("topLeft", `${bounds.north},${bounds.west}`)
    params.set("btmRight", `${bounds.south},${bounds.east}`)

    const url = `https://api.tomtom.com/search/2/poiSearch/${encodeURIComponent(`${bucket} ${city.name}`)}.json?${params.toString()}`
    const res = await fetch(url, { headers: REQUEST_HEADERS })
    if (!res.ok) {
      console.warn(`WARN ${cityId} bucket "${bucket}" -> ${res.status}`)
      continue
    }
    const json = (await res.json()) as { results?: unknown[] }
    raw.push(...(Array.isArray(json.results) ? json.results.map(mapResult) : []))
    if (raw.length >= TOURIST_POI_TARGET * 2) break
    const { promise, resolve } = Promise.withResolvers<void>()
    setTimeout(resolve, 180)
    await promise
  }

  const accepted = selectTouristPois(raw, cityId as TargetCityId, TOURIST_POI_TARGET)
  const acceptedIds = new Set(accepted.map((row) => row.id))
  const ineligibleCounts = new Map<string, number>()
  let ineligible = 0
  let overCap = 0
  for (const row of raw) {
    if (acceptedIds.has(row.id)) continue
    // Distinguish "failed the tourist rules" from "eligible but beyond the cap"
    // so a capped city is not misreported as having a quality gap.
    if (isTouristPoi(row, cityId as TargetCityId)) {
      overCap += 1
      continue
    }
    ineligible += 1
    const key = row.category || "unknown"
    ineligibleCounts.set(key, (ineligibleCounts.get(key) ?? 0) + 1)
  }
  const topRejected = [...ineligibleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([category, count]) => `${category}:${count}`)
  const outOfBounds = raw.filter((row) => {
    const { lat, lng } = row.coordinates
    return lat < bounds.south || lat > bounds.north || lng < bounds.west || lng > bounds.east
  }).length

  return {
    city: cityId,
    raw: raw.length,
    accepted: accepted.length,
    outOfBounds,
    ineligible,
    overCap,
    latencyMs: Date.now() - t0,
    sample: accepted.slice(0, 5).map((row) => row.name),
    topRejected,
  }
}

async function main() {
  console.log("Tourist POI coverage probe")
  console.log(`Target: ${TOURIST_POI_TARGET} accepted POIs per city`)
  console.log(`Cities: ${TARGET_CITY_IDS.join(", ")}`)
  console.log("")

  const rows: CoverageRow[] = []
  for (const cityId of TARGET_CITY_IDS) {
    const row = await probeCity(cityId)
    rows.push(row)
    const status = row.accepted >= TOURIST_POI_TARGET ? "PASS" : "SHORT"
    console.log(
      `${status} ${cityId.padEnd(7)} raw=${String(row.raw).padStart(3)} accepted=${String(row.accepted).padStart(2)} ` +
      `oob=${String(row.outOfBounds).padStart(3)} ineligible=${String(row.ineligible).padStart(3)} ` +
      `overCap=${String(row.overCap).padStart(3)} ${String(row.latencyMs).padStart(5)}ms  ${row.sample.join(" | ")}`
    )
    if (row.topRejected.length > 0) {
      console.log(`      rejected: ${row.topRejected.join(" | ")}`)
    }
    if (row.accepted < TOURIST_POI_TARGET) {
      const suspicious = row.topRejected.filter((entry) =>
        /attraction|tourist|park|museum|landmark|historic|monument|garden/i.test(entry)
      )
      if (suspicious.length > 0) {
        console.log(`      ALLOWLIST GAP? ${suspicious.join(" | ")}`)
      }
    }
  }

  const short = rows.filter((row) => row.accepted < TOURIST_POI_TARGET)
  console.log("")
  if (short.length > 0) {
    console.log(`COVERAGE SHORT: ${short.map((row) => `${row.city}=${row.accepted}`).join(", ")}`)
    console.log("Do not pad with non-tourist results; report the measured gap.")
    process.exitCode = 1
  } else {
    console.log("COVERAGE PASS: every target city reached the 50-POI pool.")
  }
}

main().catch((error) => {
  console.error("Probe failed:", error instanceof Error ? error.message : "unknown error")
  process.exit(1)
})
