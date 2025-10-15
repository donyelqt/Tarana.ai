/**
 * Real-Time Performance Monitor
 * Track and compare performance metrics before/after Week 1 optimizations
 */

interface PerformanceMetric {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  cacheHit?: boolean;
  strategyUsed?: string;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private activeOperations: Map<string, number> = new Map();
  
  /**
   * Start tracking an operation
   */
  start(operationId: string, operation: string): void {
    this.activeOperations.set(operationId, Date.now());
    
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
  }
  
  /**
   * End tracking an operation
   */
  end(operationId: string, operation: string, metadata?: {
    cacheHit?: boolean;
    strategyUsed?: string;
  }): number {
    const startTime = this.activeOperations.get(operationId);
    if (!startTime) {
      console.warn(`⚠️ No start time found for operation: ${operationId}`);
      return 0;
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const metric: PerformanceMetric = {
      operation,
      startTime,
      endTime,
      duration,
      ...metadata
    };
    
    const operationMetrics = this.metrics.get(operation) || [];
    operationMetrics.push(metric);
    this.metrics.set(operation, operationMetrics);
    
    this.activeOperations.delete(operationId);
    
    return duration;
  }
  
  /**
   * Get statistics for an operation
   */
  getStats(operation: string): {
    count: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    cacheHitRate: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const metrics = this.metrics.get(operation);
    if (!metrics || metrics.length === 0) return null;
    
    const durations = metrics.map(m => m.duration!).sort((a, b) => a - b);
    const cacheHits = metrics.filter(m => m.cacheHit).length;
    
    return {
      count: metrics.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      cacheHitRate: (cacheHits / metrics.length) * 100,
      p50: durations[Math.floor(durations.length * 0.5)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)]
    };
  }
  
  /**
   * Get comprehensive report
   */
  getReport(): string {
    let report = '\n═══════════════════════════════════════════════════\n';
    report += '📊 PERFORMANCE MONITORING REPORT\n';
    report += '═══════════════════════════════════════════════════\n\n';
    
    for (const [operation, metrics] of this.metrics.entries()) {
      if (metrics.length === 0) continue;
      
      const stats = this.getStats(operation);
      if (!stats) continue;
      
      report += `🎯 ${operation}\n`;
      report += `   Total Requests: ${stats.count}\n`;
      report += `   Average: ${stats.avgDuration.toFixed(0)}ms\n`;
      report += `   Min: ${stats.minDuration.toFixed(0)}ms | Max: ${stats.maxDuration.toFixed(0)}ms\n`;
      report += `   P50: ${stats.p50.toFixed(0)}ms | P95: ${stats.p95.toFixed(0)}ms | P99: ${stats.p99.toFixed(0)}ms\n`;
      
      if (stats.cacheHitRate > 0) {
        report += `   Cache Hit Rate: ${stats.cacheHitRate.toFixed(1)}%\n`;
      }
      
      report += '\n';
    }
    
    report += '═══════════════════════════════════════════════════\n';
    
    return report;
  }
  
  /**
   * Compare with baseline (before optimizations)
   */
  compareWithBaseline(baseline: {
    operation: string;
    avgDuration: number;
  }[]): string {
    let comparison = '\n═══════════════════════════════════════════════════\n';
    comparison += '📈 PERFORMANCE COMPARISON (Before vs After)\n';
    comparison += '═══════════════════════════════════════════════════\n\n';
    
    for (const base of baseline) {
      const stats = this.getStats(base.operation);
      if (!stats) continue;
      
      const improvement = ((base.avgDuration - stats.avgDuration) / base.avgDuration) * 100;
      const speedup = base.avgDuration / stats.avgDuration;
      
      comparison += `🎯 ${base.operation}\n`;
      comparison += `   Before: ${base.avgDuration.toFixed(0)}ms\n`;
      comparison += `   After:  ${stats.avgDuration.toFixed(0)}ms\n`;
      
      if (improvement > 0) {
        comparison += `   ✅ Improvement: ${improvement.toFixed(1)}% faster (${speedup.toFixed(1)}x)\n`;
      } else {
        comparison += `   ⚠️ Regression: ${Math.abs(improvement).toFixed(1)}% slower\n`;
      }
      
      comparison += '\n';
    }
    
    comparison += '═══════════════════════════════════════════════════\n';
    
    return comparison;
  }
  
  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    this.activeOperations.clear();
  }
  
  /**
   * Export metrics as JSON
   */
  exportMetrics(): string {
    const data: any = {};
    
    for (const [operation, metrics] of this.metrics.entries()) {
      data[operation] = {
        metrics: metrics,
        stats: this.getStats(operation)
      };
    }
    
    return JSON.stringify(data, null, 2);
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Convenience decorator for automatic tracking
 */
export function trackPerformance(operation: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const operationId = `${operation}_${Date.now()}_${Math.random()}`;
      
      performanceMonitor.start(operationId, operation);
      
      try {
        const result = await originalMethod.apply(this, args);
        performanceMonitor.end(operationId, operation);
        return result;
      } catch (error) {
        performanceMonitor.end(operationId, operation);
        throw error;
      }
    };
    
    return descriptor;
  };
}

/**
 * Week 1 Baseline Metrics (Before Optimization)
 */
export const WEEK1_BASELINE = [
  { operation: 'search_phase', avgDuration: 350 },
  { operation: 'traffic_phase', avgDuration: 550 },
  { operation: 'ai_generation_phase', avgDuration: 2000 },
  { operation: 'processing_phase', avgDuration: 200 },
  { operation: 'total_pipeline', avgDuration: 3100 }
];

/**
 * Quick test function
 */
export async function runPerformanceTest() {
  console.log('🧪 Running performance test...\n');
  
  // Simulate operations
  const operations = ['search_phase', 'traffic_phase', 'ai_generation_phase', 'processing_phase'];
  
  for (let i = 0; i < 10; i++) {
    for (const op of operations) {
      const operationId = `${op}_${i}`;
      performanceMonitor.start(operationId, op);
      
      // Simulate work
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
      
      performanceMonitor.end(operationId, op, {
        cacheHit: Math.random() > 0.5
      });
    }
  }
  
  console.log(performanceMonitor.getReport());
  console.log(performanceMonitor.compareWithBaseline(WEEK1_BASELINE));
}

export default performanceMonitor;
