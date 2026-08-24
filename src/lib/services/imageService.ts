/**
 * ImageService — Accurate per-location image resolution for PH/World scale
 *
 * Tier 0: Curated Baguio image (fastest, most accurate for known titles)
 * Tier 1: Google Places Photos (requires GOOGLE_PLACES_API_KEY + billing — skipped if not set)
 * Tier 2: Wikimedia Commons (free, landmark-accurate)
 * Tier 2b: Unsplash Search (free tier, no billing — category-accurate for food/cafes)
 * Tier 3: TomTom Static Map snapshot (guaranteed, never 404 — already paid via TOMTOM_API_KEY)
 *
 * No Google billing? Tier 2 → 2b → 3 still gives location-accurate images (map thumbnail for eateries).
 * Server-only. Uses 24h in-memory cache.
 */

const IMAGE_CACHE_TTL = 24 * 60 * 60 * 1000 // 24h

type PlaceInput = {
  title: string
  lat?: number
  lon?: number
  city?: string
  placeId?: string
}

type CachedEntry = { url: string; expiry: number }

// In-memory cache (per-instance). For prod, back with Supabase `place_images` table.
const cache = new Map<string, CachedEntry>()

// Curated Baguio title → public image path map (Tier 0). Import lazy to avoid bundle bloat.
const CURATED_IMAGE_MAP: Record<string, string> = {
  "Burnham Park": "/images/burnham.png",
  "Mines View Park": "/images/viewspark.png",
  "Baguio Cathedral": "/images/baguio_cathedral.jpg",
  "Botanical Garden": "/images/botanicalbaguio.jpg",
  "The Mansion": "/images/the_mansion_baguio.jpg",
  "Wright Park": "/images/wrightpark.jpg",
  "Camp John Hay": "/images/campjohnhay.jpg",
  "Bencab Museum": "/images/bencab.png",
  "Tam-Awan Village": "/images/tamawan.png",
  "Baguio Night Market": "/images/nightmarket.png",
  "SM City Baguio": "/images/smbaguio.jpg",
  "Baguio Public Market": "/images/baguiopublicmarket.jpg",
  "Good Shepherd Convent": "/images/goodsheperdconventbaguio.jpg",
  "Mirador Heritage and Eco Park": "/images/miradorheritageandecopark.jpg",
  "Diplomat Hotel": "/images/diplomat_hotel.jpg",
  "Lions Head": "/images/lion_heads_baguio.jpg",
  "Ili-Likha Artists Village": "/images/ili_likha_baguio.jpg",
  "Philippine Military Academy": "/images/pma.jpg",
  "Great wall of Baguio": "/images/great_wall_of_baguio.jpg",
  "Camp John Hay Yellow Trail": "/images/yellow_trail.png",
  "Valley of Colors": "/images/valley_of_colors.jpg",
  "Easter Weaving Room": "/images/easter_weaving_room.jpg",
  "Mt. Kalugong": "/images/mt_kalugong.jpg",
  "Chimichanga by Jaimes Family Feast": "/images/chimichanga_taranagala.jpg",
  "Kapi Kullaaw": "/images/kapi_kullaaw.jpg",
  "Itaewon Cafe": "/images/itaewon.jpg",
  "Agara Ramen": "/images/agara_ramen.jpg",
  "KoCo Cafe": "/images/koco_cafe.jpg",
  "Good Sheperd Cafe": "/images/goodsheperd_cafe_taranagala.jpg",
  "Tavern Cafe": "/images/tavern_cafe.jpg",
  "Oh My Gulay": "/images/ohmygulay_taranagala.jpg",
  "Hill Station": "/images/hillstation.png",
  "Hiraya Cafe": "/images/hiraya_cafe.jpg",
  "Uji-Matcha Cafe": "/images/ujimatcha_taranagala.jpg",
  "K-Flavors Buffet": "/images/kflavors_taranagala.JPG",
  "Korean Palace Kung Jeon": "/images/kj_korean_palace_baguio_taranagala.jpg",
  "Myeong Dong Jjigae Restaurant": "/images/MyeongDongJjigae_taranagala.jpg",
}

function getCacheKey(p: PlaceInput): string {
  return `img:${p.title.toLowerCase().trim()}:${p.lat?.toFixed(3) ?? "x"}:${p.lon?.toFixed(3) ?? "x"}`
}

function getGoogleKey(): string | null {
  // Only dedicated Places key — requires billing. Gemini key is NOT valid for Places (probe: REQUEST_DENIED).
  // Without GOOGLE_PLACES_API_KEY, Tier1 is skipped instantly (no wasted 4s fetch).
  return process.env.GOOGLE_PLACES_API_KEY || null
}

function getUnsplashKey(): string | null {
  return process.env.UNSPLASH_ACCESS_KEY || process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY || null
}

function getTomTomKey(): string | null {
  return process.env.TOMTOM_API_KEY || process.env.NEXT_PUBLIC_TOMTOM_API_KEY || null
}

// ─────────────────────────────────────────────────────────────
// Tier 1: Google Places Photos (most accurate per place_id)
// ─────────────────────────────────────────────────────────────
async function fetchGooglePhoto(place: PlaceInput): Promise<string | null> {
  const apiKey = getGoogleKey()
  if (!apiKey) return null
  if (typeof window !== "undefined") return null // server only — key must not leak

  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 4000)

    // Step 1: Find place_id via Text Search (biased by coordinates if available)
    const query = encodeURIComponent(place.city ? `${place.title} ${place.city}` : place.title)
    let searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${apiKey}`
    if (place.lat != null && place.lon != null) {
      searchUrl += `&location=${place.lat},${place.lon}&radius=5000`
    }

    const searchRes = await fetch(searchUrl, { signal: controller.signal })
    if (!searchRes.ok) {
      clearTimeout(t)
      return null
    }
    const searchData = (await searchRes.json()) as {
      status: string
      results?: Array<{ place_id: string; photos?: Array<{ photo_reference: string }> }>
    }

    const first = searchData.results?.[0]
    let photoRef: string | null = first?.photos?.[0]?.photo_reference ?? null

    // Step 2: If no photo in search result, fetch details for photos
    if (!photoRef && first?.place_id) {
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${first.place_id}&fields=photos&key=${apiKey}`
      const detailsRes = await fetch(detailsUrl, { signal: controller.signal })
      if (detailsRes.ok) {
        const detailsData = (await detailsRes.json()) as {
          status: string
          result?: { photos?: Array<{ photo_reference: string }> }
        }
        photoRef = detailsData.result?.photos?.[0]?.photo_reference ?? null
      }
    }

    clearTimeout(t)

    if (!photoRef) return null

    // Construct photo URL — client can fetch this directly (no key leak if we proxy, but URL contains key)
    // We return the Google photo URL; Next.js Image with `unoptimized` or `remotePatterns` will handle it.
    // To avoid leaking key to client, we proxy via our own API if needed — for now return the direct URL
    // and let the caller decide to proxy.
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${apiKey}`
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────
// Tier 2: Wikimedia Commons (free, accurate for landmarks/museums/parks)
// Tier 2b: Unsplash (free tier, no billing — category-accurate for food/cafes)
// ─────────────────────────────────────────────────────────────
async function fetchUnsplashPhoto(place: PlaceInput): Promise<string | null> {
  const key = getUnsplashKey()
  if (!key) return null
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 3000)
    const query = encodeURIComponent(`${place.title} ${place.city || ""}`.trim())
    const url = `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape&content_filter=high&client_id=${key}`
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(t)
    if (!res.ok) return null
    const data = (await res.json()) as { results?: Array<{ urls?: { regular?: string; small?: string } }> }
    return data.results?.[0]?.urls?.regular || data.results?.[0]?.urls?.small || null
  } catch {
    return null
  }
}
async function fetchWikimediaThumb(place: PlaceInput): Promise<string | null> {
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 3000)

    // Search Wikimedia for title, then fetch thumbnail
    const searchUrl =
      `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=600&titles=${encodeURIComponent(place.title)}`

    const res = await fetch(searchUrl, { signal: controller.signal })
    clearTimeout(t)
    if (!res.ok) return null

    const data = (await res.json()) as {
      query?: { pages?: Record<string, { thumbnail?: { source: string }; missing?: boolean }> }
    }

    const pages = data.query?.pages
    if (!pages) return null

    for (const page of Object.values(pages)) {
      if (page.thumbnail?.source) return page.thumbnail.source
    }
    return null
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────
// Tier 3: TomTom Static Map (guaranteed, shows actual location)
// ─────────────────────────────────────────────────────────────
function getTomTomStaticMap(lat: number, lon: number): string | null {
  const key = getTomTomKey()
  if (!key || lat == null || lon == null) return null
  // 600x400 basic map centered on POI — always returns an image
  return `https://api.tomtom.com/map/1/staticimage?key=${key}&center=${lon},${lat}&zoom=15&format=jpg&layer=basic&style=main&width=600&height=400&view=Unified`
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

export async function getAccurateImageForPlace(place: PlaceInput): Promise<string> {
  const cacheKey = getCacheKey(place)
  const cached = cache.get(cacheKey)
  if (cached && Date.now() < cached.expiry) return cached.url

  // Tier 0: Curated Baguio — instant, no network
  const curated = CURATED_IMAGE_MAP[place.title]
  if (curated) {
    cache.set(cacheKey, { url: curated, expiry: Date.now() + IMAGE_CACHE_TTL })
    return curated
  }

  // Tier 1: Google Places Photo (most accurate)
  const google = await fetchGooglePhoto(place)
  if (google) {
    cache.set(cacheKey, { url: google, expiry: Date.now() + IMAGE_CACHE_TTL })
    return google
  }

  // Tier 2: Wikimedia (landmarks)
  const wiki = await fetchWikimediaThumb(place)
  if (wiki) {
    cache.set(cacheKey, { url: wiki, expiry: Date.now() + IMAGE_CACHE_TTL })
    return wiki
  }

  // Tier 2b: Unsplash (free, no billing) — category-accurate for food/cafes where Wikimedia misses
  const unsplash = await fetchUnsplashPhoto(place)
  if (unsplash) {
    cache.set(cacheKey, { url: unsplash, expiry: Date.now() + IMAGE_CACHE_TTL })
    return unsplash
  }

  // Tier 3: TomTom static map (guaranteed)
  if (place.lat != null && place.lon != null) {
    const tomtom = getTomTomStaticMap(place.lat, place.lon)
    if (tomtom) {
      cache.set(cacheKey, { url: tomtom, expiry: Date.now() + IMAGE_CACHE_TTL })
      return tomtom
    }
  }

  // Tier 4: Category fallback (never empty — prevents broken <img>)
  const fallback = "/images/comingsoon.png"
  cache.set(cacheKey, { url: fallback, expiry: Date.now() + IMAGE_CACHE_TTL })
  return fallback
}

/**
 * Batch enrich activities with accurate images — parallel with concurrency limit.
 * Keeps Baguio curated images instantly, fetches world/PH images in background.
 */
export async function enrichActivitiesWithImages<T extends { title: string; lat?: number; lon?: number; image?: unknown }>(
  activities: T[],
  options: { concurrency?: number; city?: string } = {}
): Promise<T[]> {
  const concurrency = options.concurrency ?? 5

  // Fast path: if all have curated images, return immediately (Baguio)
  const needsFetch = activities.filter((a) => !CURATED_IMAGE_MAP[a.title])
  if (needsFetch.length === 0) return activities

  const results: T[] = [...activities]
  const queue = activities.map((act, idx) => ({ act, idx }))

  // Process in batches of `concurrency` to respect rate limits
  for (let i = 0; i < queue.length; i += concurrency) {
    const batch = queue.slice(i, i + concurrency)
    await Promise.all(
      batch.map(async ({ act, idx }) => {
        // Skip if already has curated image
        if (CURATED_IMAGE_MAP[act.title]) return
        try {
          const url = await getAccurateImageForPlace({
            title: act.title,
            lat: act.lat,
            lon: act.lon,
            city: options.city,
          })
          results[idx] = { ...act, image: url }
        } catch {
          // Keep original image on failure
        }
      })
    )
  }

  return results
}

export const imageService = {
  getAccurateImageForPlace,
  enrichActivitiesWithImages,
  clearCache: () => cache.clear(),
}
