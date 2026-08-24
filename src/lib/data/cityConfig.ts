/**
 * City Config — Single source of truth for city-specific geography
 * Abstracts Baguio hardcodes to support PH/world scale without code duplication
 */

export type CityId = "baguio" | "cebu" | "manila" | "davao" | "ph-wide" | "world"

export interface CityBounds {
  north: number
  south: number
  east: number
  west: number
}

export interface CityConfig {
  id: CityId
  name: string
  center: { lat: number; lon: number }
  bounds: CityBounds
  timezone: string // IANA e.g. Asia/Manila
  countrySet: string // TomTom countrySet, e.g. "PH"
  defaultRadiusMeters: number // TomTom search fallback radius
}

export const CITY_CONFIGS: Record<CityId, CityConfig> = {
  baguio: {
    id: "baguio",
    name: "Baguio City",
    center: { lat: 16.4134, lon: 120.5934 },
    bounds: { north: 16.47, south: 16.35, east: 120.65, west: 120.55 },
    timezone: "Asia/Manila",
    countrySet: "PH",
    defaultRadiusMeters: 50000,
  },
  cebu: {
    id: "cebu",
    name: "Cebu City",
    center: { lat: 10.3157, lon: 123.8854 },
    bounds: { north: 10.45, south: 10.18, east: 124.05, west: 123.75 },
    timezone: "Asia/Manila",
    countrySet: "PH",
    defaultRadiusMeters: 50000,
  },
  manila: {
    id: "manila",
    name: "Manila",
    center: { lat: 14.5995, lon: 120.9842 },
    bounds: { north: 14.8, south: 14.4, east: 121.15, west: 120.85 },
    timezone: "Asia/Manila",
    countrySet: "PH",
    defaultRadiusMeters: 50000,
  },
  davao: {
    id: "davao",
    name: "Davao City",
    center: { lat: 7.1907, lon: 125.4553 },
    bounds: { north: 7.35, south: 7.05, east: 125.6, west: 125.3 },
    timezone: "Asia/Manila",
    countrySet: "PH",
    defaultRadiusMeters: 50000,
  },
  "ph-wide": {
    id: "ph-wide",
    name: "Philippines",
    center: { lat: 12.8797, lon: 121.774 },
    bounds: { north: 21.0, south: 4.5, east: 127.0, west: 116.0 },
    timezone: "Asia/Manila",
    countrySet: "PH",
    defaultRadiusMeters: 100000,
  },
  world: {
    id: "world",
    name: "World",
    center: { lat: 0, lon: 0 },
    bounds: { north: 85, south: -85, east: 180, west: -180 },
    timezone: "UTC",
    countrySet: "", // empty = global TomTom search
    defaultRadiusMeters: 100000,
  },
}

export function getCityConfig(cityId: string): CityConfig {
  const key = (cityId?.toLowerCase() ?? "baguio") as CityId
  return CITY_CONFIGS[key] ?? CITY_CONFIGS.baguio
}

export function getCityCenter(cityId: string) {
  return getCityConfig(cityId).center
}

export function getCityBounds(cityId: string): CityBounds {
  return getCityConfig(cityId).bounds
}

export function isWithinCityBounds(lat: number, lon: number, cityId: string = "baguio"): boolean {
  const b = getCityBounds(cityId)
  return lat >= b.south && lat <= b.north && lon >= b.west && lon <= b.east
}

export function getCityTime(cityId: string = "baguio"): Date {
  const tz = getCityConfig(cityId).timezone
  return new Date(new Date().toLocaleString("en-US", { timeZone: tz }))
}

export function getCityTimezone(cityId: string = "baguio"): string {
  return getCityConfig(cityId).timezone
}
