// AI & Machine Learning Module
// Gala full 6: intelligentCache ported to smartCacheManager (file to be deleted after consumers ported)
// Re-export smartCacheManager as intelligentCacheManager for backward compat during migration
// TODO(full 6): after all 5 consumers ported, delete this re-export and update imports to @/lib/performance/smartCacheManager directly

export * from "./embeddings";
import { smartCacheManager } from "@/lib/performance/smartCacheManager";
// Compat aliases: intelligentCache used getCacheStats/warmupCache, smart uses getStats/ensureWarmup
if (!(smartCacheManager as any).getCacheStats) {
  (smartCacheManager as any).getCacheStats = () => (smartCacheManager as any).getStats();
}
if (!(smartCacheManager as any).warmupCache) {
  (smartCacheManager as any).warmupCache = (...args: any[]) => (smartCacheManager as any).ensureWarmup?.(...args) ?? Promise.resolve();
}
export { smartCacheManager as intelligentCacheManager };
export type { CacheEntry, CacheStats } from "@/lib/performance/smartCacheManager";
