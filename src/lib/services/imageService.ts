
import type { CityId } from '@/lib/data/cityConfig';

const IMAGE_CACHE_TTL = 24 * 60 * 60 * 1000 

export const RENDERABLE_IMAGE_HOSTS: readonly string[] = [
  'images.unsplash.com',
  'upload.wikimedia.org',
  'thumb.wikimedia.org',
]

export function isRenderableImageUrl(url: string | null | undefined): boolean {
  if (!url) return false
  if (url.startsWith('/')) return true
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    return RENDERABLE_IMAGE_HOSTS.includes(parsed.hostname)
  } catch {
    return false
  }
}

type PlaceInput = {
  title: string
  lat?: number
  lon?: number
  city?: string
  cityId?: CityId
  placeId?: string
}

function curatedImageFor(title: string, cityId?: CityId): string | undefined {
  if (cityId !== 'baguio') return undefined
  if (!title) return undefined
  const direct = CURATED_IMAGE_MAP[title]
  if (direct) return direct
  const stripped = title.replace(/,\s*[^,]+$/, '').trim()
  if (stripped && stripped !== title) return CURATED_IMAGE_MAP[stripped]
  return undefined
}
type CachedEntry = { url: string; expiry: number }

const cache = new Map<string, CachedEntry>()

const GLOBAL_IMAGE_CONCURRENCY = 20;
let globalRunning = 0;
const globalWaiters: Array<() => void> = [];
async function withGlobalImageLimit<T>(fn: () => Promise<T>): Promise<T> {
  if (globalRunning >= GLOBAL_IMAGE_CONCURRENCY) {
    await new Promise<void>((r) => globalWaiters.push(r));
  }
  globalRunning++;
  try { return await fn(); } finally {
    globalRunning--;
    const next = globalWaiters.shift();
    if (next) next();
  }
}

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
  "K-Flavors Buffet": "/images/kflavors_taranagala.jpg",
  "Korean Palace Kung Jeon": "/images/kj_korean_palace_baguio_taranagala.JPG",
  "Myeong Dong Jjigae Restaurant": "/images/MyeongDongJjigae_taranagala.jpg",
}

function getCacheKey(p: PlaceInput): string {
  return `img:${p.cityId ?? "none"}:${p.title.toLowerCase().trim()}:${p.lat?.toFixed(3) ?? "x"}:${p.lon?.toFixed(3) ?? "x"}`
}

function getUnsplashKey(): string | null {
  return process.env.UNSPLASH_ACCESS_KEY || process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY || null
}

function getTomTomKey(): string | null {
  return process.env.TOMTOM_API_KEY || process.env.NEXT_PUBLIC_TOMTOM_API_KEY || null
}


const WIKIMEDIA_FILE_OVERRIDES: Record<string, string> = {
  "Manila Central University":
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/08/Manila_Central_University%2C_Caloocan%2C_Mar_2024_%281%29.jpg/960px-Manila_Central_University%2C_Caloocan%2C_Mar_2024_%281%29.jpg",
};

async function fetchUnsplashPhoto(place: PlaceInput): Promise<string | null> {
  const key = getUnsplashKey()
  if (!key) {
    console.log(`🖼️ Tier2b Unsplash: skipped "${place.title}" (missing-key: UNSPLASH_ACCESS_KEY not set)`)
    return null
  }
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 3000)
    const query = encodeURIComponent(`${place.title} ${place.city || ""}`.trim())
    const url = `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape&content_filter=high&client_id=${key}`
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(t)
    if (!res.ok) {
      console.warn(`🖼️ Tier2b Unsplash: miss "${place.title}" (http-${res.status}${res.status === 403 ? ' rate-limited-or-forbidden' : ''})`)
      return null
    }
    const data = (await res.json()) as { results?: Array<{ urls?: { regular?: string; small?: string } }> }
    const hit = data.results?.[0]?.urls?.regular || data.results?.[0]?.urls?.small || null
    if (!hit) {
      console.log(`🖼️ Tier2b Unsplash: miss "${place.title}" (empty: no results for query)`)
      return null
    }
    if (!isRenderableImageUrl(hit)) {
      console.warn(`🖼️ Tier2b Unsplash: miss "${place.title}" (unrenderable-host)`)
      return null
    }
    return hit
  } catch {
    console.warn(`🖼️ Tier2b Unsplash: miss "${place.title}" (network-or-timeout)`)
    return null
  }
}
async function fetchWikimediaThumb(place: PlaceInput): Promise<string | null> {
  const override = WIKIMEDIA_FILE_OVERRIDES[place.title]
  if (override) {
    if (!isRenderableImageUrl(override)) {
      console.warn(`🖼️ Tier2 Wikimedia: miss "${place.title}" (unrenderable-host override)`)
      return null
    }
    return override
  }
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 3000)

    const searchUrl =
      `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=600&titles=${encodeURIComponent(place.title)}`

    const res = await fetch(searchUrl, { signal: controller.signal })
    clearTimeout(t)
    if (!res.ok) {
      console.log(`🖼️ Tier2 Wikimedia: miss "${place.title}" (http-${res.status})`)
      return null
    }

    const data = (await res.json()) as {
      query?: { pages?: Record<string, { thumbnail?: { source: string }; missing?: boolean }> }
    }

    const pages = data.query?.pages
    if (!pages) return null

    for (const page of Object.values(pages)) {
      const source = page.thumbnail?.source
      if (!source) continue
      if (!isRenderableImageUrl(source)) {
        console.warn(`🖼️ Tier2 Wikimedia: miss "${place.title}" (unrenderable-host: ${source.slice(0, 60)})`)
        return null
      }
      return source
    }
    console.log(`🖼️ Tier2 Wikimedia: miss "${place.title}" (empty: no page thumbnail)`)
    return null
  } catch {
    console.warn(`🖼️ Tier2 Wikimedia: miss "${place.title}" (network-or-timeout)`)
    return null
  }
}

function getTomTomStaticMap(lat: number, lon: number): string | null {
  const key = getTomTomKey()
  if (!key || lat == null || lon == null) return null
  return `https://api.tomtom.com/map/1/staticimage?key=${key}&center=${lon},${lat}&zoom=15&format=jpg&layer=basic&style=main&width=600&height=400&view=Unified`
}


export async function getAccurateImageForPlace(place: PlaceInput): Promise<string | null> {
  const cacheKey = getCacheKey(place)
  const cached = cache.get(cacheKey)
  if (cached && Date.now() < cached.expiry) return cached.url

  const curated = curatedImageFor(place.title, place.cityId);
  if (curated) {
    cache.set(cacheKey, { url: curated, expiry: Date.now() + IMAGE_CACHE_TTL })
    return curated
  }

  const wiki = await fetchWikimediaThumb(place)
  if (wiki) {
    console.log(`🖼️ Image for "${place.title}": tier=wikimedia`)
    cache.set(cacheKey, { url: wiki, expiry: Date.now() + IMAGE_CACHE_TTL })
    return wiki
  }

  const unsplash = await fetchUnsplashPhoto(place)
  if (unsplash) {
    console.log(`🖼️ Image for "${place.title}": tier=unsplash`)
    cache.set(cacheKey, { url: unsplash, expiry: Date.now() + IMAGE_CACHE_TTL })
    return unsplash
  }

  if (place.lat != null && place.lon != null) {
    const tomtom = getTomTomStaticMap(place.lat, place.lon)
    if (tomtom) {
      console.log(`🖼️ Image for "${place.title}": tier=tomtom-static-map → rejected (not a photo)`)
      return null
    }
    console.warn(`🖼️ Tier3 TomTom: miss "${place.title}" (missing-key: TOMTOM_API_KEY not set)`)
  }

  console.log(`🖼️ Image for "${place.title}": tier=no-photo → null (logo fallback)`)
  return null
}

export async function enrichActivitiesWithImages<T extends { title: string; lat?: number; lon?: number; image?: unknown }>(
  activities: T[],
  options: { concurrency?: number; city?: string; cityId?: CityId } = {}
): Promise<T[]> {
  const concurrency = options.concurrency ?? 5
  const cityId = options.cityId

  const applyCurated = (act: T): T => {
    const curated = curatedImageFor(act.title, cityId)
    return curated ? { ...act, image: curated } : act
  }

  const results: T[] = activities.map(applyCurated)

  const needsFetch = activities.filter((a) => !curatedImageFor(a.title, cityId))
  if (needsFetch.length === 0) return results

  const queue = activities
    .map((act, idx) => ({ act, idx }))
    .filter(({ act }) => !curatedImageFor(act.title, cityId))

  for (let i = 0; i < queue.length; i += concurrency) {
    const batch = queue.slice(i, i + concurrency)
    await Promise.all(
      batch.map(async ({ act, idx }) => {
        try {
          const url = await withGlobalImageLimit(() => getAccurateImageForPlace({
            title: act.title,
            lat: act.lat,
            lon: act.lon,
            city: options.city,
            cityId,
          }))
          if (url) results[idx] = { ...act, image: url }
        } catch {
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
