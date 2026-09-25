import { isWithinCityBounds } from '@/lib/data/cityConfig';
import type { SearchResult } from '@/types/route-optimization';

export type TargetCityId = 'cebu' | 'manila' | 'davao';

export const TARGET_CITY_IDS: readonly TargetCityId[] = ['cebu', 'manila', 'davao'];

/** Candidate pool target; consumers keep their own smaller render/enrichment caps. */
export const TOURIST_POI_TARGET = 50;

/** TomTom's documented maximum `limit` for one Search request. */
export const TOURIST_POI_RAW_LIMIT = 100;

/**
 * Category-name allowlist for "tourist spot".
 *
 * TomTom's numeric category IDs are not pinned here on purpose: the POI
 * response is the authority, and category names are reviewable. Matching is
 * normalized substring matching, so "important tourist attraction" and
 * "tourist attraction" both qualify, while "restaurant" and "office" do not.
 */
export const TOURIST_CATEGORY_ALLOWLIST: readonly string[] = [
  'attraction',
  'tourist',
  'landmark',
  'monument',
  'historic',
  'historical',
  'heritage',
  'museum',
  'cultural',
  'arts center',
  'gallery',
  'park',
  'garden',
  'botanical',
  'nature reserve',
  'wildlife',
  'viewpoint',
  'scenic',
  'observation',
  'beach',
  'waterfall',
  'lake',
  'island',
  'zoo',
  'aquarium',
  'amusement',
  'theme park',
  'cathedral',
  'church',
  'temple',
  'mosque',
  'religious site',
  'palace',
  'fort',
  'castle',
  'promenade',
  'pier',
  'marina',
  'trail',
  'mountain',
];

export function isTargetCityId(value: unknown): value is TargetCityId {
  return typeof value === 'string' && (TARGET_CITY_IDS as readonly string[]).includes(value);
}

function normalizedCategories(result: SearchResult): string[] {
  return [result.category, ...(result.categories ?? [])]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .map((value) => value.toLowerCase().trim());
}

/**
 * Word-boundary match keeps short terms from false-accepting unrelated
 * categories: "church" must not match "churchill", "park" must not match
 * "shopping park", "lake" must not match "lakeland", "trail" must not match
 * "trailers". The term still matches inside a longer phrase when it appears as
 * a whole word ("important tourist attraction" → "tourist").
 */
function categoryMatchesTerm(category: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(category);
}

/** True when the provider result is a category-verified tourist POI in-city. */
export function isTouristPoi(result: SearchResult, cityId: TargetCityId): boolean {
  const placeType = typeof result.placeType === 'string' ? result.placeType.trim() : '';
  if (!/^poi$/i.test(placeType)) return false;
  if (!result.id || !result.name) return false;

  const lat = result.coordinates?.lat;
  const lon = result.coordinates?.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (!isWithinCityBounds(lat, lon, cityId)) return false;

  const categories = normalizedCategories(result);
  return categories.some((category) =>
    TOURIST_CATEGORY_ALLOWLIST.some((term) => categoryMatchesTerm(category, term))
  );
}

function normalizedName(result: SearchResult): string {
  return result.name.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Stable identity for duplicate suppression.
 *
 * Coordinate-only keys collapse distinct venues inside one building, so the
 * provider ID and normalized name come first. Same-name results within the
 * same ~100m coordinate bucket are provider jitter and collapse to the best
 * score; distinct names at identical coordinates stay distinct.
 */
function identityKeys(result: SearchResult): string[] {
  const lat = result.coordinates.lat;
  const lon = result.coordinates.lng;
  const name = normalizedName(result);
  return [
    `id:${result.id}`,
    `name:${name}|coord:${lat.toFixed(4)},${lon.toFixed(4)}`,
    `name:${name}|bucket:${lat.toFixed(3)},${lon.toFixed(3)}`,
  ];
}

/**
 * Interest-targeted eligibility.
 *
 * The tourist allowlist intentionally rejects restaurants/cafes, but a user
 * who picks "Food & Culinary" is explicitly asking for them. This keeps the
 * same structural guarantees (real POI, in-city, finite coords) while
 * dropping only the tourist-category requirement.
 */
export function isInterestPoi(result: SearchResult, cityId: TargetCityId): boolean {
  const placeType = typeof result.placeType === 'string' ? result.placeType.trim() : '';
  if (!/^poi$/i.test(placeType)) return false;
  if (!result.id || !result.name) return false;

  const lat = result.coordinates?.lat;
  const lon = result.coordinates?.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  return isWithinCityBounds(lat, lon, cityId);
}

/**
 * Interest-layer selection: structural eligibility + the same stable dedupe,
 * but no tourist allowlist. Used for the personalization layer only.
 */
export function selectInterestPois(
  results: readonly SearchResult[],
  cityId: TargetCityId,
  limit: number
): SearchResult[] {
  const seen = new Set<string>();
  const accepted: SearchResult[] = [];

  for (const result of [...results].sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))) {
    if (!isInterestPoi(result, cityId)) continue;
    const keys = identityKeys(result);
    if (keys.some((key) => seen.has(key))) continue;
    for (const key of keys) seen.add(key);
    accepted.push(result);
    if (accepted.length >= limit) break;
  }

  return accepted;
}

/**
 * Merge the personalization layer ahead of the coverage layer.
 *
 * Interests must genuinely lead: sorting both layers together by provider
 * score would let a high-scoring tourist POI outrank an interest match. This
 * takes interest matches first (score-ordered within the layer), then fills
 * the remaining slots from the tourist pool, deduping across both.
 */
export function mergeInterestFirst(
  interest: readonly SearchResult[],
  tourist: readonly SearchResult[],
  cityId: TargetCityId,
  limit: number = TOURIST_POI_TARGET
): SearchResult[] {
  const seen = new Set<string>();
  const accepted: SearchResult[] = [];

  const push = (result: SearchResult) => {
    if (!isInterestPoi(result, cityId)) return;
    const keys = identityKeys(result);
    if (keys.some((key) => seen.has(key))) return;
    for (const key of keys) seen.add(key);
    accepted.push(result);
  };

  for (const result of [...interest].sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))) {
    if (accepted.length >= limit) break;
    push(result);
  }
  for (const result of [...tourist].sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))) {
    if (accepted.length >= limit) break;
    push(result);
  }

  return accepted;
}

/**
 * Filter to eligible tourist POIs and dedupe without synthetic padding.
 * Sorted by provider relevance descending; callers may re-rank for interests.
 */
export function selectTouristPois(
  results: readonly SearchResult[],
  cityId: TargetCityId,
  limit: number = TOURIST_POI_TARGET
): SearchResult[] {
  const seen = new Set<string>();
  const accepted: SearchResult[] = [];

  for (const result of [...results].sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))) {
    if (!isTouristPoi(result, cityId)) continue;
    const keys = identityKeys(result);
    if (keys.some((key) => seen.has(key))) continue;
    for (const key of keys) seen.add(key);
    accepted.push(result);
    if (accepted.length >= limit) break;
  }

  return accepted;
}
