import { supabaseAdmin } from '@/lib/data/supabaseAdmin';
import { logger } from '@/lib/observability/logger';
import type { SearchResult } from '@/types/route-optimization';
import type { TargetCityId } from '@/lib/data/touristPoi';

export const TOURIST_PLACE_VALIDITY_DAYS = 7;
const TABLE_NAME = 'places' as const;

type PlaceRow = {
  id: string;
  city_id: string;
  title: string;
  lat: number;
  lon: number;
  category: string | null;
  metadata: Record<string, unknown> | null;
};

/** Cache reads should never fail a user request; unavailability degrades to TomTom. */
export function isTouristPoiCacheEnabled(): boolean {
  return process.env.TOURIST_POI_CACHE_ENABLED !== 'false';
}

/**
 * Fresh rows only: unexpired by valid_until, newest first.
 * Returns [] on any DB failure so callers can fall back to live upstream.
 */
export async function readFreshPlaces(
  cityId: TargetCityId,
  limit: number
): Promise<SearchResult[]> {
  if (!isTouristPoiCacheEnabled()) return [];

  try {
    const { data, error } = await supabaseAdmin
      .from(TABLE_NAME)
      .select('id,city_id,title,lat,lon,category,metadata')
      .eq('city_id', cityId)
      .or('valid_until.is.null,valid_until.gt.' + new Date().toISOString())
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.warn('Tourist POI cache read failed; falling back to TomTom', {
        entryPoint: 'touristPoiCache',
        cityId,
        errorName: 'SupabaseError',
      });
      return [];
    }

    return (data ?? []).flatMap((row) => {
      const place = row as PlaceRow;
      if (
        typeof place.id !== 'string' ||
        typeof place.title !== 'string' ||
        !Number.isFinite(place.lat) ||
        !Number.isFinite(place.lon)
      ) {
        return [];
      }

      const metadata = place.metadata ?? {};
      const categories = Array.isArray(metadata.categories)
        ? metadata.categories.filter((value): value is string => typeof value === 'string')
        : place.category
          ? [place.category]
          : [];
      // Stored ids are `${city}:${tomtomId}`. Return the raw provider id so
      // cache hits and upstream results share one identity namespace.
      const providerId = typeof metadata.tomtomId === 'string' && metadata.tomtomId
        ? metadata.tomtomId
        : place.id;

      return [{
        id: providerId,
        name: place.title,
        address: typeof metadata.address === 'string' ? metadata.address : '',
        coordinates: { lat: place.lat, lng: place.lon },
        category: place.category ?? 'Location',
        categories,
        categorySet: Array.isArray(metadata.categorySet)
          ? metadata.categorySet.filter((value): value is number => typeof value === 'number')
          : [],
        relevanceScore: typeof metadata.score === 'number' ? metadata.score : 0,
        popularityIndex: typeof metadata.score === 'number' ? Math.min(metadata.score * 10, 100) : 0,
        placeType: 'POI',
      }];
    });
  } catch (error) {
    logger.warn('Tourist POI cache read threw; falling back to TomTom', {
      entryPoint: 'touristPoiCache',
      cityId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    return [];
  }
}

/** Best-effort persistence; a cache write must not fail the user request. */
export async function upsertTouristPlaces(
  cityId: TargetCityId,
  results: readonly SearchResult[]
): Promise<void> {
  if (!isTouristPoiCacheEnabled() || results.length === 0) return;

  const validUntil = new Date(
    Date.now() + TOURIST_PLACE_VALIDITY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  try {
    const rows = results.map((result) => ({
      id: `${cityId}:${result.id}`,
      city_id: cityId,
      title: result.name,
      lat: result.coordinates.lat,
      lon: result.coordinates.lng,
      category: result.category,
      source: 'tomtom' as const,
      metadata: {
        tomtomId: result.id,
        score: result.relevanceScore,
        categories: result.categories ?? [],
        categorySet: result.categorySet ?? [],
        address: result.address,
      },
      valid_until: validUntil,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabaseAdmin
      .from(TABLE_NAME)
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      logger.warn('Tourist POI cache upsert failed', {
        entryPoint: 'touristPoiCache',
        cityId,
        errorName: 'SupabaseError',
      });
    }
  } catch (error) {
    logger.warn('Tourist POI cache upsert threw', {
      entryPoint: 'touristPoiCache',
      cityId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
  }
}
