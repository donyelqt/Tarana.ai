import { getCityConfig } from '@/lib/data/cityConfig';
import { readFreshPlaces, upsertTouristPlaces } from '@/lib/data/touristPoiCache';
import { logger } from '@/lib/observability/logger';
import {
  isTargetCityId,
  selectInterestPois,
  selectTouristPois,
  TOURIST_POI_RAW_LIMIT,
  TOURIST_POI_TARGET,
  type TargetCityId,
} from '@/lib/data/touristPoi';
import { tomtomRoutingService } from '@/lib/services/tomtomRouting';
import type { SearchResult } from '@/types/route-optimization';

/**
 * Fixed, interest-independent query buckets. They are search phrases, not
 * fabricated places, and each bucket is POI-only at the provider.
 *
 * Source for the POI endpoint contract:
 * https://docs.tomtom.com/search-api/documentation/search-service/points-of-interest-search
 */
export const TOURIST_QUERY_BUCKETS: readonly string[] = [
  'tourist attraction',
  'landmark',
  'museum',
  'park',
  'garden',
  'viewpoint',
  'beach',
  'church',
  'historic site',
  'monument',
];

/** UI interest label → compact provider query term. */
export const INTEREST_QUERY_MAP: Record<string, string> = {
  'Food & Culinary': 'restaurants',
  'Nature & Scenery': 'park viewpoint',
  'Culture & Arts': 'museum landmark',
  'Shopping & Local Finds': 'shopping market',
  'Adventure': 'outdoor attraction',
};

/** Max interest queries per request — bounds upstream calls. */
export const INTEREST_QUERY_LIMIT = 2;
/** Raw provider results fetched per interest query. */
export const INTEREST_RAW_LIMIT = 25;

type TouristPoiSearch = typeof tomtomRoutingService.searchPois;
type TouristPoiCacheReader = typeof readFreshPlaces;
type TouristPoiCacheWriter = typeof upsertTouristPlaces;

export type TouristPoiDeps = {
  searchPois: TouristPoiSearch;
  readFresh: TouristPoiCacheReader;
  writeFresh: TouristPoiCacheWriter;
};

const defaultDeps: TouristPoiDeps = {
  searchPois: tomtomRoutingService.searchPois.bind(tomtomRoutingService),
  readFresh: readFreshPlaces,
  writeFresh: upsertTouristPlaces,
};

/**
 * Interest-targeted POI retrieval — the personalization layer.
 *
 * Gala's non-Baguio path needs the user's stated interests to actually steer
 * retrieval. The tourist allowlist rejects restaurants/cafes by design, so
 * this layer applies structural eligibility (real POI, in-city, finite
 * coords) without the tourist-category requirement, then dedupes.
 *
 * Bounded: at most `INTEREST_QUERY_LIMIT` upstream queries.
 */
export async function getInterestPois(
  cityId: unknown,
  interestLabels: readonly string[],
  limit: number,
  deps: TouristPoiDeps = defaultDeps
): Promise<SearchResult[]> {
  if (!isTargetCityId(cityId) || limit <= 0) return [];

  const labels = interestLabels
    .filter((label) => typeof label === 'string' && label.length > 0 && label !== 'Random')
    .slice(0, INTEREST_QUERY_LIMIT);
  if (labels.length === 0) return [];

  const city = getCityConfig(cityId);
  const bounds = {
    topLeft: { lat: city.bounds.north, lng: city.bounds.west },
    bottomRight: { lat: city.bounds.south, lng: city.bounds.east },
  };

  let accepted: SearchResult[] = [];
  for (const label of labels) {
    if (accepted.length >= limit) break;
    const term = INTEREST_QUERY_MAP[label] ?? label;
    try {
      const batch = await deps.searchPois(`${term} ${city.name}`, bounds, {
        countrySet: city.countrySet,
        language: city.language,
        limit: INTEREST_RAW_LIMIT,
      });
      accepted = selectInterestPois([...accepted, ...batch], cityId, limit);
    } catch (error) {
      logger.warn('Interest POI upstream search failed; continuing with tourist layer', {
        entryPoint: 'touristPoiService',
        cityId,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }

  return accepted;
}

/**
 * Canonical live tourist-POI retrieval for both Gala and Dashboard.
 *
 * Read-first from `places`; TomTom POI backfill only when fresh coverage is
 * below target. Returns up to 50 unique, in-bounds, category-verified POIs.
 * Reconciliation, not accumulation: the newest upstream batch wins, so the
 * result is deterministic for a given cache state.
 *
 * `limit` is clamped to `TOURIST_POI_TARGET` (50) by design; callers cannot
 * raise the pool above the reviewed cap.
 */
export async function getTouristPois(
  cityId: unknown,
  limit: number = TOURIST_POI_TARGET,
  deps: TouristPoiDeps = defaultDeps
): Promise<SearchResult[]> {
  if (!isTargetCityId(cityId)) return [];

  const target = Math.min(Math.max(limit, 1), TOURIST_POI_TARGET);
  const cached = await deps.readFresh(cityId, target);
  if (cached.length >= target) return cached.slice(0, target);

  const city = getCityConfig(cityId);
  const bounds = {
    topLeft: { lat: city.bounds.north, lng: city.bounds.west },
    bottomRight: { lat: city.bounds.south, lng: city.bounds.east },
  };

  // Stop when the ACCEPTED tourist count reaches the target, not when the raw
  // upstream count does. Buckets may be mostly non-tourist/out-of-bounds, so
  // breaking on raw volume would strand coverage below target.
  let accepted = cached;
  try {
    for (const bucket of TOURIST_QUERY_BUCKETS) {
      if (accepted.length >= target) break;
      const batch = await deps.searchPois(`${bucket} ${city.name}`, bounds, {
        countrySet: city.countrySet,
        language: city.language,
        limit: TOURIST_POI_RAW_LIMIT,
      });
      accepted = selectTouristPois([...accepted, ...batch], cityId, target);
    }
  } catch (error) {
    // Upstream failure degrades to whatever fresh cache rows we already have;
    // it must not surface as a request failure or wipe valid cache rows.
    logger.warn('Tourist POI upstream search failed; serving cache-only', {
      entryPoint: 'touristPoiService',
      cityId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
  }

  // readFreshPlaces normalizes cached rows back to the raw provider id, so a
  // plain id comparison is correct and already-cached rows are not rewritten.
  const cachedIds = new Set(cached.map((row) => row.id));
  const newRows = accepted.filter((result) => !cachedIds.has(result.id));
  if (newRows.length > 0) {
    await deps.writeFresh(cityId, newRows);
  }

  return accepted;
}
