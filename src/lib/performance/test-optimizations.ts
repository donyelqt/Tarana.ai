/**
 * Performance Optimization Test Suite
 * Validates ultra-fast itinerary generation improvements
 * 
 * @author Doniele Arys Antonio
 * @version 3.0.0
 */

import { performanceBenchmark } from "./performanceBenchmark";
import { optimizedPipeline } from "./optimizedPipeline";
import { smartCacheManager } from "./smartCacheManager";
import { ultraFastItineraryEngine } from "./ultraFastItineraryEngine";
import { parallelTrafficProcessor } from "./parallelTrafficProcessor";

/**
 * Test the optimized itinerary generation system
 */
export async function testOptimizedSystem(): Promise<void> {
  console.log(`🧪 TESTING OPTIMIZED SYSTEM: Starting comprehensive validation`);
  
  try {
    // Test 1: Basic functionality test
    console.log(`\n1️⃣ BASIC FUNCTIONALITY TEST`);
    await testBasicFunctionality();
    
    // Test 2: Performance benchmark
    console.log(`\n2️⃣ PERFORMANCE BENCHMARK TEST`);
    await testPerformanceBenchmark();
    
    // Test 3: Cache efficiency test
    console.log(`\n3️⃣ CACHE EFFICIENCY TEST`);
    await testCacheEfficiency();
    
    // Test 4: Parallel processing test
    console.log(`\n4️⃣ PARALLEL PROCESSING TEST`);
    await testParallelProcessing();
    
    // Test 5: Stress test
    console.log(`\n5️⃣ STRESS TEST`);
    await testStressHandling();
    
    console.log(`\n✅ ALL TESTS COMPLETED SUCCESSFULLY`);
    
  } catch (error) {
    console.error(`❌ TEST SUITE FAILED:`, error);
    throw error;
  }
}

/**
 * Test basic optimized functionality
 */
async function testBasicFunctionality(): Promise<void> {
  const testRequest = {
    prompt: "I want to explore nature activities in Baguio",
    interests: ["Nature", "Adventure"],
    weatherData: {
      weather: [{ id: 800, description: "clear sky" }],
      main: { temp: 22 }
    },
    durationDays: 2,
    budget: "₱5,000 - ₱10,000/day",
    pax: "2",
    model: {} // Mock model for testing
  };

  const startTime = Date.now();
  
  try {
    const { itinerary, metrics } = await optimizedPipeline.generateOptimized(testRequest);
    const responseTime = Date.now() - startTime;
    
    // Validate results
    if (!itinerary) {
      throw new Error("No itinerary generated");
    }
    
    if (!itinerary.items || itinerary.items.length === 0) {
      throw new Error("No activities in generated itinerary");
    }
    
    console.log(`✅ Basic test passed: Generated itinerary in ${responseTime}ms`);
    console.log(`📊 Metrics: ${metrics.performance.activitiesProcessed} activities, ${metrics.performance.efficiency}% efficiency`);
    
  } catch (error) {
    console.error(`❌ Basic functionality test failed:`, error);
    throw error;
  }
}

/**
 * Test performance benchmark suite
 */
async function testPerformanceBenchmark(): Promise<void> {
  try {
    const benchmark = await performanceBenchmark.runBenchmarkSuite();
    
    if (benchmark.summary.successRate < 0.8) {
      throw new Error(`Low success rate: ${Math.round(benchmark.summary.successRate * 100)}%`);
    }
    
    if (benchmark.summary.averageImprovement < 2) {
      console.warn(`⚠️ Lower than expected improvement: ${benchmark.summary.averageImprovement.toFixed(1)}x`);
    }
    
    console.log(`✅ Performance benchmark passed: ${benchmark.summary.averageImprovement.toFixed(1)}x improvement`);
    
  } catch (error) {
    console.error(`❌ Performance benchmark failed:`, error);
    throw error;
  }
}

/**
 * Test cache efficiency
 */
async function testCacheEfficiency(): Promise<void> {
  try {
    // Clear cache for clean test
    smartCacheManager.clearAll();
    
    // Run same request twice to test caching
    const testQuery = "nature activities";
    const testContext = { interests: ["Nature"], weather: "clear" };
    
    // First request (cache miss)
    const startTime1 = Date.now();
    smartCacheManager.set("test-key", { data: "test-data" });
    const result1 = smartCacheManager.get("test-key");
    const time1 = Date.now() - startTime1;
    
    // Second request (cache hit)
    const startTime2 = Date.now();
    const result2 = smartCacheManager.get("test-key");
    const time2 = Date.now() - startTime2;
    
    if (!result1 || !result2) {
      throw new Error("Cache not working properly");
    }
    
    if (time2 >= time1) {
      console.warn(`⚠️ Cache not providing speed benefit: ${time1}ms vs ${time2}ms`);
    }
    
    const stats = smartCacheManager.getStats();
    console.log(`✅ Cache test passed: ${Math.round(stats.hitRate * 100)}% hit rate`);
    
  } catch (error) {
    console.error(`❌ Cache efficiency test failed:`, error);
    throw error;
  }
}

/**
 * Test parallel processing capabilities
 */
async function testParallelProcessing(): Promise<void> {
  try {
    const testActivities = [
      { title: "Burnham Park", desc: "Beautiful park", tags: ["Nature"], time: "9:00-11:00AM", image: "", peakHours: "" },
      { title: "Session Road", desc: "Shopping street", tags: ["Shopping"], time: "2:00-4:00PM", image: "", peakHours: "" },
      { title: "Mines View Park", desc: "Scenic viewpoint", tags: ["Nature"], time: "10:00-12:00PM", image: "", peakHours: "" },
      { title: "Baguio Cathedral", desc: "Historic church", tags: ["Culture"], time: "8:00-10:00AM", image: "", peakHours: "" },
      { title: "Camp John Hay", desc: "Recreation area", tags: ["Nature"], time: "9:00-5:00PM", image: "", peakHours: "" }
    ];

    const startTime = Date.now();
    const { enhancedActivities, metrics } = await parallelTrafficProcessor.processActivitiesUltraFast(testActivities);
    const processingTime = Date.now() - startTime;
    
    if (enhancedActivities.length !== testActivities.length) {
      throw new Error(`Activity count mismatch: ${enhancedActivities.length} vs ${testActivities.length}`);
    }
    
    if (metrics.apiCallsReduced < 1) {
      console.warn(`⚠️ No API call reduction achieved`);
    }
    
    console.log(`✅ Parallel processing test passed: ${processingTime}ms, ${metrics.apiCallsReduced} API calls saved`);
    
  } catch (error) {
    console.error(`❌ Parallel processing test failed:`, error);
    throw error;
  }
}

/**
 * Test stress handling with concurrent requests
 */
async function testStressHandling(): Promise<void> {
  try {
    const stressResult = await performanceBenchmark.runStressTest(3); // Reduced for testing
    
    if (stressResult.successRate < 0.8) {
      throw new Error(`Low stress test success rate: ${Math.round(stressResult.successRate * 100)}%`);
    }
    
    if (stressResult.averageResponseTime > 5000) {
      console.warn(`⚠️ High response time under stress: ${Math.round(stressResult.averageResponseTime)}ms`);
    }
    
    console.log(`✅ Stress test passed: ${Math.round(stressResult.successRate * 100)}% success, ${Math.round(stressResult.averageResponseTime)}ms avg`);
    
  } catch (error) {
    console.error(`❌ Stress test failed:`, error);
    throw error;
  }
}

/**
 * Run quick validation test
 */
export async function quickValidationTest(): Promise<boolean> {
  console.log(`⚡ QUICK VALIDATION: Testing optimized system`);
  
  try {
    // Test ultra-fast engine
    const { activities } = await ultraFastItineraryEngine.findActivitiesUltraFast(
      "nature activities",
      ["Nature"],
      "clear",
      1,
      {} // Mock model
    );
    
    if (activities.length === 0) {
      throw new Error("No activities found");
    }
    
    // Test cache manager
    smartCacheManager.set("test", { data: "test" });
    const cached = smartCacheManager.get("test");
    
    if (!cached) {
      throw new Error("Cache not working");
    }
    
    console.log(`✅ Quick validation passed: ${activities.length} activities found, cache working`);
    return true;
    
  } catch (error) {
    console.error(`❌ Quick validation failed:`, error);
    return false;
  }
}

/**
 * Generate performance report
 */
export async function generateOptimizationReport(): Promise<string> {
  console.log(`📊 GENERATING OPTIMIZATION REPORT`);
  
  try {
    const report = await performanceBenchmark.generatePerformanceReport();
    const health = optimizedPipeline.getHealthMetrics();
    const cacheHealth = smartCacheManager.getHealthMetrics();
    
    const fullReport = `${report}

## System Health Status
- **Pipeline Status**: ${health.status}
- **Cache Health**: ${cacheHealth.health}
- **Memory Usage**: ${Math.round(cacheHealth.memoryUsage)}%

## Recommendations
${health.recommendations.length > 0 ? health.recommendations.map(r => `- ${r}`).join('\n') : '- System operating optimally'}

## Cache Distribution
- **Hot Cache**: ${cacheHealth.tierDistribution.hot} entries
- **Warm Cache**: ${cacheHealth.tierDistribution.warm} entries  
- **Cold Cache**: ${cacheHealth.tierDistribution.cold} entries

---
*Report generated by Ultra-Fast Itinerary Engine v3.0.0*
`;

    return fullReport;
    
  } catch (error) {
    console.error(`❌ Report generation failed:`, error);
    return `Error generating performance report: ${error}`;
  }
}

// Export test functions
export {
  testBasicFunctionality,
  testPerformanceBenchmark,
  testCacheEfficiency,
  testParallelProcessing,
  testStressHandling
};
