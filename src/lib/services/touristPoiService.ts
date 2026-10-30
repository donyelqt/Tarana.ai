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

export const INTEREST_QUERY_MAP: Record<string, string> = {
  'Food & Culinary': 'restaurants',
  'Nature & Scenery': 'park viewpoint',
  'Culture & Arts': 'museum landmark',
  'Shopping & Local Finds': 'shopping market',
  'Adventure': 'outdoor attraction',
};

export const INTEREST_QUERY_LIMIT = 2;
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
    logger.warn('Tourist POI upstream search failed; serving cache-only', {
      entryPoint: 'touristPoiService',
      cityId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
  }

  const cachedIds = new Set(cached.map((row) => row.id));
  const newRows = accepted.filter((result) => !cachedIds.has(result.id));
  if (newRows.length > 0) {
    await deps.writeFresh(cityId, newRows);
  }

  return accepted;
}
