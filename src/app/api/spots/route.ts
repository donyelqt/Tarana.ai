import { NextRequest, NextResponse } from 'next/server';
import { timedHttp } from '@/lib/observability/httpMetrics';
import { logger } from '@/lib/observability/logger';
import { getRequestId } from '@/middleware/requestId';
import { getCityConfig, isWithinCityBounds, type CityId } from '@/lib/data/cityConfig';
import { getTouristPois } from '@/lib/services/touristPoiService';
import { tomtomRoutingService } from '@/lib/services/tomtomRouting';
import type { BoundingBox } from '@/types/route-optimization';
import { tomtomTrafficService } from '@/lib/traffic/tomtomTraffic';
import { getTrafficLevelFromScore } from '@/lib/utils/trafficColors';
import { enrichActivitiesWithImages } from '@/lib/services/imageService';
import { rotateByDay } from '@/lib/utils/dailyRotation';
import { createRateLimitMiddleware, rateLimitConfigs } from '@/lib/security/rateLimiter';
import {
  activityToPayload,
  spotPool,
  withSpotOverlays,
  type SpotPayload,
} from '@/app/dashboard/utils';




const SUPPORTED = ['baguio', 'cebu', 'manila', 'davao', 'boracay', 'el_nido'] as const;


const ENRICH_LIMIT = 6;


function toBadgeTraffic(level: string): SpotPayload['traffic'] {
  if (level === 'HIGH' || level === 'SEVERE') return 'High';
  if (level === 'MODERATE') return 'Moderate';
  return 'Low';
}


function isRealPhoto(image: unknown): boolean {
  if (typeof image !== 'string' || !image.startsWith('http')) return false;
  if (image.includes('api.tomtom.com/map')) return false;
  if (image.includes('comingsoon')) return false;
  return true;
}


export async function GET(request: Request) {
  return timedHttp('/api/spots', 'GET', async () => {
  const req = request as NextRequest;
  const limited = createRateLimitMiddleware(rateLimitConfigs.api)(req);
  if (!limited.allowed) {
    const res = NextResponse.json({ error: 'Rate limit exceeded. Please slow down your requests.' }, { status: 429 });
    if (limited.retryAfter) res.headers.set('Retry-After', String(limited.retryAfter));
    return res;
  }
  const requestId = getRequestId(req);
  const city = new URL(request.url).searchParams.get('city') ?? 'baguio';

  if (!(SUPPORTED as readonly string[]).includes(city)) {
    return NextResponse.json(
      { error: 'Unsupported city', supported: SUPPORTED },
      { status: 400 }
    );
  }

  try {
    if (city === 'baguio') {
      const curated: SpotPayload[] = spotPool().map(activityToPayload);
      const cfg = getCityConfig('baguio');
      const bounds: BoundingBox = {
        topLeft: { lat: cfg.bounds.north, lng: cfg.bounds.west },
        bottomRight: { lat: cfg.bounds.south, lng: cfg.bounds.east },
      };
      let extras: SpotPayload[] = [];
      try {
        const results = await tomtomRoutingService.searchLocations(
          `tourist attractions ${cfg.name}`,
          bounds,
          undefined,
          { countrySet: cfg.countrySet, language: cfg.language }
        );

        const seen = new Set<string>(
          curated
            .filter((s) => s.lat != null && s.lon != null)
            .map(
              (s) =>
                `${(s.lat as number).toFixed(3)},${(s.lon as number).toFixed(3)}`
            )
        );
        const candidates: SpotPayload[] = [];
        for (const r of results) {
          const lat = r.coordinates?.lat;
          const lon = r.coordinates?.lng;
          if (lat == null || lon == null) continue;
          if (!isWithinCityBounds(lat, lon, 'baguio')) continue;
          const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          candidates.push({ name: r.name, image: null, lat, lon, peakHours: null });
          if (candidates.length >= 8) break;
        }

        
        const withImages = await enrichActivitiesWithImages(
          candidates.map((s) => ({
            title: s.name,
            lat: s.lat ?? undefined,
            lon: s.lon ?? undefined,
            image: undefined as unknown,
          })),
          { city: cfg.name, cityId: city as CityId }
        );
        await Promise.all(
          candidates.map(async (s, i) => {
            const img = withImages[i]?.image;
            if (typeof img === 'string' && img) s.image = img;
            try {
              const t = await tomtomTrafficService.getLocationTrafficData(
                s.lat as number,
                s.lon as number
              );
              s.traffic = toBadgeTraffic(getTrafficLevelFromScore(t.congestionScore));
            } catch {
              
            }
          })
        );

        const verified = candidates.filter((s) => isRealPhoto(s.image));
        const dropped = candidates.length - verified.length;
        if (dropped > 0) {
          logger.debug(
            'Baguio extras dropped',
            { dropped, total: candidates.length, entryPoint: '/api/spots' },
            requestId
          );
        }

        extras = verified;
      } catch (e) {
        
        logger.error(
          'Baguio extras failed, serving curated only',
          {
            entryPoint: '/api/spots',
            errorName: e instanceof Error ? e.name : 'UnknownError',
            errorMessage: e instanceof Error ? e.message : 'Unknown error',
          },
          requestId
        );
      }
      
      
      
      
      const pool = [...curated, ...extras];
      const dayIndex = Math.floor(Date.now() / 86400000);
      const rotated = rotateByDay(pool, dayIndex);
      if (rotated.length > 1) {
        logger.info(
          'Daily rotation',
          {
            dayIndex,
            offset: dayIndex % rotated.length,
            total: rotated.length,
            city: 'baguio',
            head: pool[0]?.name,
            entryPoint: '/api/spots',
          },
          requestId
        );
      }
      return NextResponse.json({ success: true, city, spots: rotated });
    }

    const cfg = getCityConfig(city);
    
    
    
    const touristPois = await getTouristPois(city);
    const live: SpotPayload[] = touristPois.map((r) => ({
      name: r.name,
      image: null,
      lat: r.coordinates.lat,
      lon: r.coordinates.lng,
      peakHours: null,
    }));
    
    
    
    const spots = withSpotOverlays(city, live);
    
    
    
    const dayIndex = Math.floor(Date.now() / 86400000);
    const rotatedSpots = rotateByDay(spots, dayIndex);
    if (rotatedSpots.length > 1) {
      logger.info(
        'Daily rotation',
        {
          dayIndex,
          offset: dayIndex % rotatedSpots.length,
          total: rotatedSpots.length,
          city,
          head: spots[0]?.name,
          entryPoint: '/api/spots',
        },
        requestId
      );
    }

    
    
    
    const head = rotatedSpots.slice(0, ENRICH_LIMIT);
    const withImages = await enrichActivitiesWithImages(
      head.map((s) => ({
        title: s.name,
        lat: s.lat ?? undefined,
        lon: s.lon ?? undefined,
        image: undefined as unknown,
      })),
      { city: cfg.name, cityId: city as CityId }
    );
    await Promise.all(
      head.map(async (s, i) => {
        const img = withImages[i]?.image;
        if (typeof img === 'string' && img) s.image = img;
        try {
          const t = await tomtomTrafficService.getLocationTrafficData(
            s.lat as number,
            s.lon as number
          );
          s.traffic = toBadgeTraffic(getTrafficLevelFromScore(t.congestionScore));
        } catch {
          
        }
      })
    );

    return NextResponse.json({ success: true, city, spots: rotatedSpots });
  } catch (error) {
    logger.error(
      'Error in /api/spots',
      {
        entryPoint: '/api/spots',
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
      requestId
    );
    return NextResponse.json(
      { error: 'Failed to get spots' },
      { status: 500 }
    );
  }
  }, (res) => res.status);
}
