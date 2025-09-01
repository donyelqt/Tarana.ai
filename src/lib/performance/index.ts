/**
 * Performance Optimization Module Index
 * Centralized exports for ultra-fast itinerary generation
 * 
 * @author Doniele Arys Antonio
 * @version 3.0.0
 */

export { UltraFastItineraryEngine, ultraFastItineraryEngine } from './ultraFastItineraryEngine';
export { SmartCacheManager, smartCacheManager } from './smartCacheManager';
export { ParallelTrafficProcessor, parallelTrafficProcessor } from './parallelTrafficProcessor';
export { OptimizedPipeline, optimizedPipeline } from './optimizedPipeline';
export { PerformanceBenchmark, performanceBenchmark } from './performanceBenchmark';

export type { FastGenerationOptions, GenerationMetrics } from './ultraFastItineraryEngine';
export type { CacheEntry, CacheStats, SmartCacheConfig } from './smartCacheManager';
export type { TrafficProcessingOptions, TrafficProcessingMetrics } from './parallelTrafficProcessor';
export type { PipelineMetrics, OptimizedGenerationRequest } from './optimizedPipeline';
export type { BenchmarkResult, BenchmarkSuite } from './performanceBenchmark';
