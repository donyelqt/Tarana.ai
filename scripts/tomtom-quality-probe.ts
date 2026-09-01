import "dotenv/config"
import { CITY_CONFIGS, type CityId } from "../src/lib/data/cityConfig"

const QUERIES = [
  "restaurants",
  "cafe",
  "park viewpoint",
  "museum landmark",
  "shopping market",
  "beach",
  "church",
  "hotel",
  "lechon",
  "adobo",
]

const CITIES: CityId[] = ["baguio", "cebu", "manila", "davao", "ph-wide"]
const LANGUAGES = ["en-US", "fil"] as const

const API_KEY = process.env.TOMTOM_API_KEY || process.env.NEXT_PUBLIC_TOMTOM_API_KEY || ""
if (!API_KEY) {
  console.error("Missing TOMTOM_API_KEY (or NEXT_PUBLIC_TOMTOM_API_KEY) in env")
  process.exit(1)
}

type ProbeResult = {
  city: CityId
  language: string
  query: string
  latencyMs: number
  count: number
  sampleNames: string[]
}

async function probeOne(city: CityId, language: string, query: string): Promise<ProbeResult> {
  const cfg = CITY_CONFIGS[city]
  const bounds = cfg.bounds
  const params = new URLSearchParams({
    key: API_KEY,
    query,
    limit: "10",
    language,
  })
  if (cfg.countrySet) params.set("countrySet", cfg.countrySet)
  params.set("topLeft", `${bounds.north},${bounds.west}`)
  params.set("btmRight", `${bounds.south},${bounds.east}`)

  const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?${params.toString()}`
  const t0 = Date.now()
  const res = await fetch(url)
  const latencyMs = Date.now() - t0
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    console.warn(`WARN ${city} ${language} "${query}" -> ${res.status} ${text.slice(0,120)}`)
    return { city, language, query, latencyMs, count: 0, sampleNames: [] }
  }
  const json: any = await res.json()
  const results: any[] = Array.isArray(json?.results) ? json.results : []
  const sampleNames = results.slice(0, 3).map((r: any) => r?.poi?.name ?? r?.address?.freeformAddress ?? r?.id ?? "?")
  return { city, language, query, latencyMs, count: results.length, sampleNames }
}

function p50(nums: number[]): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  return s[Math.floor(s.length * 0.5)]
}

function pct(n: number, d: number): string {
  return d === 0 ? "0%" : (n / d * 100).toFixed(1) + "%"
}

async function main() {
  console.log("TomTom quality probe")
  console.log("Cities: " + CITIES.join(", "))
  console.log("Languages: " + LANGUAGES.join(", "))
  console.log("Queries: " + QUERIES.length + " (" + QUERIES.join(" | ") + ")")
  console.log("Total probes: " + (CITIES.length * LANGUAGES.length * QUERIES.length))
  console.log("")

  const all: ProbeResult[] = []
  for (const city of CITIES) {
    for (const lang of LANGUAGES) {
      for (const q of QUERIES) {
        const r = await probeOne(city, lang, q)
        all.push(r)
        const marker = r.count === 0 ? "0" : String(r.count).padStart(2, " ")
        console.log(`${(r.latencyMs+"ms").padStart(6)} ${marker} results  ${city.padEnd(8)} ${lang.padEnd(6)} "${q}"  ${r.sampleNames.join(" | ")}`)
        await new Promise(res => setTimeout(res, 180))
      }
    }
  }

  console.log("\n=== SUMMARY ===")
  const allLat = all.map(a => a.latencyMs)
  console.log("p50 latency: " + p50(allLat) + "ms  (all probes)")
  for (const city of CITIES) {
    for (const lang of LANGUAGES) {
      const subset = all.filter(a => a.city === city && a.language === lang)
      const lat = p50(subset.map(a => a.latencyMs))
      const zero = subset.filter(a => a.count === 0).length
      const total = subset.length
      console.log(`${city.padEnd(8)} ${lang.padEnd(6)} p50 ${String(lat).padStart(4)}ms  0-result ${zero}/${total} (${pct(zero,total)})`)
    }
  }
  const totalZero = all.filter(a => a.count === 0).length
  console.log("Overall 0-result: " + totalZero + "/" + all.length + " (" + pct(totalZero, all.length) + ")")

  const p50All = p50(allLat)
  const zeroRate = totalZero / all.length
  const filSubset = all.filter(a => a.language === "fil")
  const filNonZero = filSubset.filter(a => a.count > 0).length
  const filRate = filNonZero / filSubset.length
  console.log("\n=== GATE ===")
  console.log("p50 " + p50All + "ms " + (p50All < 600 ? "PASS" : "FAIL") + " (target <600ms)")
  console.log("0-result " + pct(totalZero, all.length) + " " + (zeroRate < 0.4 ? "PASS" : "FAIL") + " (target <40%)")
  console.log("fil non-zero " + pct(filNonZero, filSubset.length) + " " + (filRate >= 0.6 ? "PASS" : "WARN require translation dict") + " (target >=60%)")
  if (p50All >= 600 || zeroRate >= 0.4) {
    console.log("\nGATE FAIL -> investigate countrySet/language/bounds before Slice 4")
    process.exitCode = 1
  } else {
    console.log("\nGATE PASS -> proceed to Slice 4")
  }
}

main().catch(e => { console.error(e); process.exit(1) })