/**
 * Performance Optimization Module Index
 * Centralized exports for itinerary generation helpers
 *
 * @author Doniele Arys Antonio
 * @version 3.0.0
 */

// Dead-code cleanup 2026-09-19 (Osmani review): removed exports for
// optimizedPipeline, ultraFastItineraryEngine, performanceBenchmark,
// test-optimizations, test-week1-optimizations — all had zero live consumers
// (only test/bench; the surviving single route uses unstable_cache directly).
export { SmartCacheManager, smartCacheManager } from './smartCacheManager';
export { ParallelTrafficProcessor, parallelTrafficProcessor } from './parallelTrafficProcessor';

// Week 1 Optimization Testing & Monitoring (NEW)
export { performanceMonitor, trackPerformance, WEEK1_BASELINE } from './performanceMonitor';

export type { CacheEntry, CacheStats, SmartCacheConfig } from './smartCacheManager';
export type { TrafficProcessingOptions, TrafficProcessingMetrics } from './parallelTrafficProcessor';