import { NextResponse } from 'next/server';
import { getCityConfig, isWithinCityBounds } from '@/lib/data/cityConfig';
import { tomtomRoutingService } from '@/lib/services/tomtomRouting';
import type { BoundingBox } from '@/types/route-optimization';
import { tomtomTrafficService } from '@/lib/traffic/tomtomTraffic';
import { getTrafficLevelFromScore } from '@/lib/utils/trafficColors';
import { enrichActivitiesWithImages } from '@/lib/services/imageService';
import { rotateByDay } from '@/lib/utils/dailyRotation';
import {
  activityToPayload,
  isSpotScopeId,
  spotPool,
  type SpotPayload,
  type SpotScopeId,
} from '@/app/dashboard/utils';

const SUPPORTED: SpotScopeId[] = ['baguio', 'cebu', 'manila', 'davao'];

/** Spots enriched per scope change — photos + traffic for the visible head. */
const ENRICH_LIMIT = 6;

/** Shared-threshold mapping (thresholds live in trafficColors/getTrafficLevel). */
function toBadgeTraffic(level: string): SpotPayload['traffic'] {
  if (level === 'HIGH' || level === 'SEVERE') return 'High';
  if (level === 'MODERATE') return 'Moderate';
  return 'Low';
}

/**
 * True only for a real photo (Wikimedia/Unsplash/Google http URL).
 * TomTom static-map thumbnails and local placeholders never qualify —
 * map filler must never displace curated cards.
 */
function isRealPhoto(image: unknown): boolean {
  if (typeof image !== 'string' || !image.startsWith('http')) return false;
  if (image.includes('api.tomtom.com/map')) return false;
  if (image.includes('comingsoon')) return false;
  return true;
}

/**
 * GET /api/spots?city=baguio|cebu|manila|davao
 * Spot candidates per city. Baguio serves the FULL mixed pool — curated
 * entries (coords, photos, peak hours, zero enrichment) in catalog order
 * plus up to 8 TomTom extras — rotated by day via rotateByDay. Full-pool
 * rotation replaced curated-first because the display slices 3: curated-first
 * pinned extras at indices 37+ where they never rendered, making scale
 * invisible. Quality is guarded at the source instead — extras are enriched
 * (tier-chain photos + measured traffic) and only photo-verified extras
 * (real Wikimedia/Unsplash/Google URL, never TomTom-static-map-only) join
 * the pool, so rotation carries no quality risk. Other cities serve live
 * TomTom POI search, enriched with real photos (imageService tier chain)
 * and measured traffic (TomTom flow → shared thresholds). Anything
 * unmeasurable stays absent — the client hides badge/photo rather than
 * guessing.
 * Ranking stays client-side (rankSpots) for every city.
 */
export async function GET(request: Request) {
  const city = new URL(request.url).searchParams.get('city') ?? 'baguio';

  if (!isSpotScopeId(city) || !SUPPORTED.includes(city)) {
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

        // Enrich extras ONLY — curated entries stay exactly as today.
        const withImages = await enrichActivitiesWithImages(
          candidates.map((s) => ({
            title: s.name,
            lat: s.lat ?? undefined,
            lon: s.lon ?? undefined,
            image: undefined as unknown,
          })),
          { city: cfg.name }
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
              // Badge stays hidden — measured or nothing.
            }
          })
        );

        const verified = candidates.filter((s) => isRealPhoto(s.image));
        const dropped = candidates.length - verified.length;
        if (dropped > 0) {
          console.debug(
            `🔍 BAGUIO EXTRAS: dropped ${dropped}/${candidates.length} map-only extras (no real photo)`
          );
        }

        extras = verified;
      } catch (e) {
        // Scale is best-effort — curated pool still serves on TomTom failure.
        console.error('Baguio extras failed, serving curated only:', e);
      }
      // Full-pool rotation (NOT curated-first): the display slices 3, so
      // curated-first pinned extras at indices 37+ where they never rendered.
      // Photo guard above carries the quality burden — only real-photo extras
      // join — so the whole pool rotates together like every other city.
      const pool = [...curated, ...extras];
      const dayIndex = Math.floor(Date.now() / 86400000);
      const rotated = rotateByDay(pool, dayIndex);
      if (rotated.length > 1) {
        console.log(`🔁 DAILY ROTATION: day ${dayIndex} offset ${dayIndex % rotated.length}/${rotated.length} for baguio (head was "${pool[0]?.name}")`);
      }
      return NextResponse.json({ success: true, city, spots: rotated });
    }

    const cfg = getCityConfig(city);
    const bounds: BoundingBox = {
      topLeft: { lat: cfg.bounds.north, lng: cfg.bounds.west },
      bottomRight: { lat: cfg.bounds.south, lng: cfg.bounds.east },
    };
    const results = await tomtomRoutingService.searchLocations(
      `tourist attractions ${cfg.name}`,
      bounds,
      undefined,
      { countrySet: cfg.countrySet, language: cfg.language }
    );

    const seen = new Set<string>();
    const spots: SpotPayload[] = [];
    for (const r of results) {
      const lat = r.coordinates?.lat;
      const lon = r.coordinates?.lng;
      if (lat == null || lon == null) continue;
      if (!isWithinCityBounds(lat, lon, city)) continue;
      const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      spots.push({ name: r.name, image: null, lat, lon, peakHours: null });
      if (spots.length >= 12) break;
    }

    // Daily rotation (Gala strict-city parity): TomTom order is deterministic,
    // so without rotation the same 3 surface every day. Rotates the 12 before
    // head-6 enrichment so every head is fully dressed. Baguio untouched.
    const dayIndex = Math.floor(Date.now() / 86400000);
    const rotatedSpots = rotateByDay(spots, dayIndex);
    if (rotatedSpots.length > 1) {
      console.log(`🔁 DAILY ROTATION: day ${dayIndex} offset ${dayIndex % rotatedSpots.length}/${rotatedSpots.length} for ${city} (head was "${spots[0]?.name}")`);
    }

    // Enrich only the visible head: real photos (tier chain, cached) and
    // measured traffic (flow → shared thresholds). Per-spot failures degrade
    // to placeholder/undisplayed — never guessed.
    const head = rotatedSpots.slice(0, ENRICH_LIMIT);
    const withImages = await enrichActivitiesWithImages(
      head.map((s) => ({
        title: s.name,
        lat: s.lat ?? undefined,
        lon: s.lon ?? undefined,
        image: undefined as unknown,
      })),
      { city: cfg.name }
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
          // Badge stays hidden — measured or nothing.
        }
      })
    );

    return NextResponse.json({ success: true, city, spots: rotatedSpots });
  } catch (error) {
    console.error('Error in /api/spots:', error);
    return NextResponse.json(
      { error: 'Failed to get spots' },
      { status: 500 }
    );
  }
}
