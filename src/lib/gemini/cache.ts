import { CacheItem } from './types';

export const responseCache = new Map<string, CacheItem>();
export const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export function getFromCache<T = any>(key: string): T | null {
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.response as T;
  }
  return null;
}

export function setInCache(key: string, value: unknown) {
  responseCache.set(key, { response: value, timestamp: Date.now() });
}

export function cleanupCache() {
  if (responseCache.size > 100) {
    const now = Date.now();
    for (const [key, value] of responseCache.entries()) {
      if (now - value.timestamp > CACHE_DURATION) {
        responseCache.delete(key);
      }
    }
  }
}