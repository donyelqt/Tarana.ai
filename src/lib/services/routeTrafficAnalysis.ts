/**
 * Route Traffic Analysis Service
 * Enhanced traffic analysis specifically for route optimization
 */

import {
  RouteData,
  RouteTrafficAnalysis,
  RouteSegmentTraffic,
  TrafficLevel,
  TrafficIncident,
  PeakHourAnalysis,
  TrafficHistoryData,
  RouteComparison,
  RouteRecommendation,
  Coordinates
} from '@/types/route-optimization';

import { tomtomTrafficService, LocationTrafficData } from '@/lib/traffic/tomtomTraffic';
import { isPeakHour, getPeakHourMultiplier, getNextPeakHour } from '@/lib/traffic/peakHours';

interface TrafficSegmentAnalysis {
  segmentId: string;
  coordinates: Coordinates[];
  trafficData: LocationTrafficData;
  length: number;
  estimatedTime: number;
}

interface RouteTrafficCache {
  routeId: string;
  analysis: RouteTrafficAnalysis;
  expiry: number;
}

class RouteTrafficAnalyzer {
  private cache: Map<string, RouteTrafficCache> = new Map();
  private readonly CACHE_DURATION = 3 * 60 * 1000; // 3 minutes for route traffic
  private readonly SEGMENT_ANALYSIS_POINTS = 5; // Number of points to analyze per route segment

  /**
   * Analyze traffic conditions for a complete route
   */
  async analyzeRouteTraffic(route: RouteData): Promise<RouteTrafficAnalysis> {
    console.log('🔍 Route Traffic: Analyzing traffic for route', route.id);

    // Check cache first
    const cached = this.cache.get(route.id);
    if (cached && Date.now() < cached.expiry) {
      console.log('📋 Route Traffic: Using cached analysis for route', route.id);
      return cached.analysis;
    }

    try {
      // Analyze route segments
      const segmentAnalyses = await this.analyzeRouteSegments(route);
      
      // Calculate overall traffic metrics
      const overallAnalysis = this.calculateOverallTrafficMetrics(segmentAnalyses);
      
      // Get peak hour analysis
      const peakHourImpact = this.analyzePeakHourImpact(route, overallAnalysis);
      
      // Generate historical comparison
      const historicalComparison = this.generateHistoricalComparison(route, overallAnalysis);
      
      // Calculate recommendation score
      const recommendationScore = this.calculateRouteRecommendationScore(
        overallAnalysis,
        segmentAnalyses,
        peakHourImpact
      );

      const analysis: RouteTrafficAnalysis = {
        overallTrafficLevel: overallAnalysis.trafficLevel,
        segmentAnalysis: segmentAnalyses,
        estimatedDelay: overallAnalysis.totalDelay,
        alternativeRecommendation: overallAnalysis.congestionScore > 70,
        peakHourImpact,
        historicalComparison,
        congestionScore: overallAnalysis.congestionScore,
        recommendationScore,
        lastUpdated: new Date()
      };

      // Cache the result
      this.cache.set(route.id, {
        routeId: route.id,
        analysis,
        expiry: Date.now() + this.CACHE_DURATION
      });

      console.log(`✅ Route Traffic: Analysis complete for route ${route.id}:`, {
        trafficLevel: analysis.overallTrafficLevel,
        congestionScore: analysis.congestionScore,
        recommendationScore: analysis.recommendationScore,
        segmentCount: analysis.segmentAnalysis.length
      });

      return analysis;

    } catch (error) {
      console.error('❌ Route Traffic: Analysis failed for route', route.id, error);
      
      // Return fallback analysis
      return this.createFallbackAnalysis(route);
    }
  }

  /**
   * Compare multiple routes for traffic efficiency
   */
  async compareRouteTraffic(routes: RouteData[]): Promise<RouteComparison> {
    console.log('🏁 Route Traffic: Comparing', routes.length, 'routes');

    if (routes.length === 0) {
      throw new Error('No routes provided for comparison');
    }

    try {
      // Analyze traffic for all routes
      const trafficAnalyses = await Promise.all(
        routes.map(route => this.analyzeRouteTraffic(route))
      );

      // Calculate comparison metrics
      const bestRoute = this.findBestRoute(routes, trafficAnalyses);
      const recommendation = this.generateRouteRecommendation(routes, trafficAnalyses, bestRoute);

      const comparison: RouteComparison = {
        routes,
        trafficAnalyses,
        recommendation,
        bestRouteId: bestRoute.id,
        comparisonMetrics: this.calculateComparisonMetrics(routes, trafficAnalyses)
      };

      console.log(`✅ Route Traffic: Comparison complete - Best route: ${bestRoute.id} (${recommendation.reason})`);

      return comparison;

    } catch (error) {
      console.error('❌ Route Traffic: Route comparison failed:', error);
      throw error;
    }
  }

  /**
   * Predict traffic conditions for future departure times
   */
  async predictTrafficConditions(route: RouteData, departureTime: Date): Promise<RouteTrafficAnalysis> {
    console.log('🔮 Route Traffic: Predicting traffic for departure at', departureTime.toLocaleString());

    try {
      // Get current traffic analysis as baseline
      const currentAnalysis = await this.analyzeRouteTraffic(route);
      
      // Calculate time-based traffic adjustments
      const timeBasedMultiplier = this.calculateTimeBasedTrafficMultiplier(departureTime);
      const peakHourMultiplier = getPeakHourMultiplier(departureTime);
      
      // Apply predictions to current data
      const predictedAnalysis: RouteTrafficAnalysis = {
        ...currentAnalysis,
        congestionScore: Math.min(100, currentAnalysis.congestionScore * timeBasedMultiplier * peakHourMultiplier),
        estimatedDelay: currentAnalysis.estimatedDelay * timeBasedMultiplier * peakHourMultiplier,
        overallTrafficLevel: this.adjustTrafficLevel(currentAnalysis.overallTrafficLevel, timeBasedMultiplier * peakHourMultiplier),
        peakHourImpact: {
          isCurrentlyPeakHour: isPeakHour(departureTime),
          peakHourMultiplier,
          expectedTrafficIncrease: (peakHourMultiplier - 1) * 100,
          nextPeakHour: getNextPeakHour(departureTime) || undefined,
          historicalAverage: currentAnalysis.peakHourImpact.historicalAverage
        },
        lastUpdated: new Date()
      };

      // Recalculate recommendation score
      predictedAnalysis.recommendationScore = this.calculateRouteRecommendationScore(
        { 
          trafficLevel: predictedAnalysis.overallTrafficLevel,
          congestionScore: predictedAnalysis.congestionScore,
          totalDelay: predictedAnalysis.estimatedDelay
        },
        predictedAnalysis.segmentAnalysis,
        predictedAnalysis.peakHourImpact
      );

      console.log(`✅ Route Traffic: Prediction complete - Congestion score: ${predictedAnalysis.congestionScore}%, Recommendation: ${predictedAnalysis.recommendationScore}%`);

      return predictedAnalysis;

    } catch (error) {
      console.error('❌ Route Traffic: Traffic prediction failed:', error);
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Analyze traffic for individual route segments
   */
  private async analyzeRouteSegments(route: RouteData): Promise<RouteSegmentTraffic[]> {
    const segments: RouteSegmentTraffic[] = [];
    
    // Divide route into segments for analysis
    const segmentPoints = this.divideRouteIntoSegments(route.geometry.coordinates);
    
    for (let i = 0; i < segmentPoints.length - 1; i++) {
      try {
        const startPoint = segmentPoints[i];
        const endPoint = segmentPoints[i + 1];
        
        // Analyze traffic at midpoint of segment
        const midPoint = this.calculateMidpoint(startPoint, endPoint);
        const trafficData = await tomtomTrafficService.getLocationTrafficData(midPoint.lat, midPoint.lng);
        
        const segment: RouteSegmentTraffic = {
          segmentId: `segment_${i}`,
          startCoordinate: startPoint,
          endCoordinate: endPoint,
          trafficLevel: trafficData.trafficLevel,
          speedKmh: this.estimateSegmentSpeed(trafficData),
          freeFlowSpeedKmh: this.estimateFreeFlowSpeed(trafficData),
          delaySeconds: this.calculateSegmentDelay(startPoint, endPoint, trafficData),
          incidents: trafficData.incidents,
          roadType: this.determineRoadType(startPoint, endPoint),
          roadName: `Segment ${i + 1}`
        };
        
        segments.push(segment);
        
      } catch (error) {
        console.warn(`⚠️ Route Traffic: Failed to analyze segment ${i}:`, error);
        
        // Add fallback segment
        segments.push(this.createFallbackSegment(i, segmentPoints[i], segmentPoints[i + 1]));
      }
    }
    
    return segments;
  }

  /**
   * Calculate overall traffic metrics from segment analyses
   */
  private calculateOverallTrafficMetrics(segments: RouteSegmentTraffic[]) {
    let totalDelay = 0;
    let totalCongestionScore = 0;
    let highestTrafficLevel: TrafficLevel = 'LOW';
    
    segments.forEach(segment => {
      totalDelay += segment.delaySeconds;
      
      // Calculate segment congestion score
      const speedRatio = segment.speedKmh / Math.max(segment.freeFlowSpeedKmh, 1);
      const segmentCongestion = Math.max(0, (1 - speedRatio) * 100);
      totalCongestionScore += segmentCongestion;
      
      // Track highest traffic level
      if (this.getTrafficLevelValue(segment.trafficLevel) > this.getTrafficLevelValue(highestTrafficLevel)) {
        highestTrafficLevel = segment.trafficLevel;
      }
    });
    
    const avgCongestionScore = segments.length > 0 ? totalCongestionScore / segments.length : 0;
    
    return {
      trafficLevel: highestTrafficLevel,
      totalDelay,
      congestionScore: Math.round(avgCongestionScore)
    };
  }

  /**
   * Analyze peak hour impact on route
   */
  private analyzePeakHourImpact(route: RouteData, overallAnalysis: any): PeakHourAnalysis {
    const now = new Date();
    const isCurrentPeakHour = isPeakHour(now);
    const peakMultiplier = getPeakHourMultiplier(now);
    
    return {
      isCurrentlyPeakHour: isCurrentPeakHour,
      peakHourMultiplier: peakMultiplier,
      expectedTrafficIncrease: (peakMultiplier - 1) * 100,
      nextPeakHour: getNextPeakHour(now) || undefined,
      historicalAverage: route.summary.travelTimeInSeconds / 60 // Convert to minutes
    };
  }

  /**
   * Generate historical traffic comparison
   */
  private generateHistoricalComparison(route: RouteData, overallAnalysis: any): TrafficHistoryData {
    const typicalTime = route.summary.travelTimeInSeconds;
    const currentTime = typicalTime + overallAnalysis.totalDelay;
    
    return {
      typicalTravelTime: typicalTime,
      currentVsTypical: currentTime / typicalTime,
      weekdayPattern: [1.0, 0.8, 0.9, 1.2, 1.4, 1.3, 0.7], // Mock weekday pattern
      hourlyPattern: this.generateHourlyPattern()
    };
  }

  /**
   * Calculate route recommendation score
   */
  private calculateRouteRecommendationScore(
    overallAnalysis: any,
    segments: RouteSegmentTraffic[],
    peakHourImpact: PeakHourAnalysis
  ): number {
    let score = 100;
    
    // Penalize based on congestion score
    score -= overallAnalysis.congestionScore * 0.8;
    
    // Penalize for incidents
    const incidentCount = segments.reduce((sum, seg) => sum + seg.incidents.length, 0);
    score -= Math.min(incidentCount * 15, 40);
    
    // Penalize for peak hour impact
    if (peakHourImpact.isCurrentlyPeakHour) {
      score -= peakHourImpact.expectedTrafficIncrease * 0.5;
    }
    
    // Penalize for severe traffic levels
    const severeSegments = segments.filter(seg => seg.trafficLevel === 'SEVERE').length;
    score -= severeSegments * 20;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Find the best route from comparison
   */
  private findBestRoute(routes: RouteData[], analyses: RouteTrafficAnalysis[]): RouteData {
    let bestRoute = routes[0];
    let bestScore = 0;
    
    routes.forEach((route, index) => {
      const analysis = analyses[index];
      
      // Calculate composite score
      const timeScore = 100 - (route.summary.travelTimeInSeconds / 60); // Lower time is better
      const trafficScore = 100 - analysis.congestionScore; // Lower congestion is better
      const recommendationScore = analysis.recommendationScore;
      
      const compositeScore = (timeScore * 0.4) + (trafficScore * 0.35) + (recommendationScore * 0.25);
      
      if (compositeScore > bestScore) {
        bestScore = compositeScore;
        bestRoute = route;
      }
    });
    
    return bestRoute;
  }

  /**
   * Generate route recommendation
   */
  private generateRouteRecommendation(
    routes: RouteData[],
    analyses: RouteTrafficAnalysis[],
    bestRoute: RouteData
  ): RouteRecommendation {
    const bestIndex = routes.findIndex(r => r.id === bestRoute.id);
    const bestAnalysis = analyses[bestIndex];
    
    let type: 'primary' | 'alternative' | 'avoid';
    let reason: string;
    let priority: 'high' | 'medium' | 'low';
    
    if (bestAnalysis.recommendationScore >= 80) {
      type = 'primary';
      reason = 'Optimal traffic conditions with minimal delays';
      priority = 'high';
    } else if (bestAnalysis.recommendationScore >= 60) {
      type = 'primary';
      reason = 'Good traffic conditions, recommended route';
      priority = 'medium';
    } else if (bestAnalysis.recommendationScore >= 40) {
      type = 'alternative';
      reason = 'Moderate traffic - consider alternative routes';
      priority = 'medium';
    } else {
      type = 'avoid';
      reason = 'Heavy traffic conditions - avoid if possible';
      priority = 'high';
    }
    
    // Calculate time savings vs worst route
    const worstTime = Math.max(...routes.map(r => r.summary.travelTimeInSeconds));
    const timeSavings = Math.round((worstTime - bestRoute.summary.travelTimeInSeconds) / 60);
    
    return {
      type,
      reason,
      timeSavings: timeSavings > 0 ? timeSavings : undefined,
      trafficAdvantage: `${bestAnalysis.congestionScore}% congestion`,
      message: `${reason}${timeSavings > 0 ? ` - saves ${timeSavings} minutes` : ''}`,
      priority
    };
  }

  /**
   * Calculate comparison metrics
   */
  private calculateComparisonMetrics(routes: RouteData[], analyses: RouteTrafficAnalysis[]) {
    const times = routes.map(r => r.summary.travelTimeInSeconds);
    const distances = routes.map(r => r.summary.lengthInMeters);
    const trafficScores = analyses.map(a => a.congestionScore);
    
    return {
      timeDifference: Math.max(...times) - Math.min(...times),
      distanceDifference: Math.max(...distances) - Math.min(...distances),
      trafficScore: Math.min(...trafficScores)
    };
  }

  // Helper methods for segment analysis
  private divideRouteIntoSegments(coordinates: Coordinates[]): Coordinates[] {
    if (coordinates.length <= this.SEGMENT_ANALYSIS_POINTS) {
      return coordinates;
    }
    
    const segmentPoints: Coordinates[] = [];
    const step = Math.floor(coordinates.length / this.SEGMENT_ANALYSIS_POINTS);
    
    for (let i = 0; i < coordinates.length; i += step) {
      segmentPoints.push(coordinates[i]);
    }
    
    // Always include the last point
    if (segmentPoints[segmentPoints.length - 1] !== coordinates[coordinates.length - 1]) {
      segmentPoints.push(coordinates[coordinates.length - 1]);
    }
    
    return segmentPoints;
  }

  private calculateMidpoint(start: Coordinates, end: Coordinates): Coordinates {
    return {
      lat: (start.lat + end.lat) / 2,
      lng: (start.lng + end.lng) / 2
    };
  }

  private estimateSegmentSpeed(trafficData: LocationTrafficData): number {
    // Estimate speed based on traffic level
    const baseSpeed = 50; // km/h
    const congestionFactor = 1 - (trafficData.congestionScore / 100);
    return Math.max(10, baseSpeed * congestionFactor);
  }

  private estimateFreeFlowSpeed(trafficData: LocationTrafficData): number {
    return 60; // Default free flow speed in km/h
  }

  private calculateSegmentDelay(start: Coordinates, end: Coordinates, trafficData: LocationTrafficData): number {
    // Calculate distance and estimate delay
    const distance = this.calculateDistance(start, end);
    const freeFlowTime = (distance / 60) * 3600; // seconds at 60 km/h
    const currentSpeed = this.estimateSegmentSpeed(trafficData);
    const currentTime = (distance / currentSpeed) * 3600;
    
    return Math.max(0, currentTime - freeFlowTime);
  }

  private calculateDistance(start: Coordinates, end: Coordinates): number {
    // Haversine formula for distance calculation
    const R = 6371; // Earth's radius in km
    const dLat = (end.lat - start.lat) * Math.PI / 180;
    const dLng = (end.lng - start.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(start.lat * Math.PI / 180) * Math.cos(end.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private determineRoadType(start: Coordinates, end: Coordinates): string {
    // Simple road type determination based on distance
    const distance = this.calculateDistance(start, end);
    if (distance > 5) return 'highway';
    if (distance > 1) return 'arterial';
    return 'local';
  }

  private createFallbackSegment(index: number, start: Coordinates, end: Coordinates): RouteSegmentTraffic {
    return {
      segmentId: `segment_${index}`,
      startCoordinate: start,
      endCoordinate: end,
      trafficLevel: 'MODERATE',
      speedKmh: 40,
      freeFlowSpeedKmh: 60,
      delaySeconds: 60,
      incidents: [],
      roadType: 'local',
      roadName: `Segment ${index + 1}`
    };
  }

  private getTrafficLevelValue(level: TrafficLevel): number {
    switch (level) {
      case 'LOW': return 1;
      case 'MODERATE': return 2;
      case 'HIGH': return 3;
      case 'SEVERE': return 4;
      default: return 2;
    }
  }

  private adjustTrafficLevel(currentLevel: TrafficLevel, multiplier: number): TrafficLevel {
    const currentValue = this.getTrafficLevelValue(currentLevel);
    const adjustedValue = Math.round(currentValue * multiplier);
    
    if (adjustedValue >= 4) return 'SEVERE';
    if (adjustedValue >= 3) return 'HIGH';
    if (adjustedValue >= 2) return 'MODERATE';
    return 'LOW';
  }

  private calculateTimeBasedTrafficMultiplier(departureTime: Date): number {
    const hour = departureTime.getHours();
    
    // Traffic multipliers by hour
    if (hour >= 7 && hour <= 9) return 1.5; // Morning rush
    if (hour >= 17 && hour <= 19) return 1.6; // Evening rush
    if (hour >= 12 && hour <= 14) return 1.2; // Lunch time
    if (hour >= 22 || hour <= 5) return 0.7; // Late night/early morning
    
    return 1.0; // Normal traffic
  }

  private generateHourlyPattern(): number[] {
    // Mock 24-hour traffic pattern (0-23)
    return [
      0.3, 0.2, 0.2, 0.3, 0.4, 0.6, 0.8, 1.4, 1.6, 1.2,
      1.0, 1.1, 1.3, 1.2, 1.0, 0.9, 1.1, 1.5, 1.7, 1.3,
      1.0, 0.8, 0.6, 0.4
    ];
  }

  private createFallbackAnalysis(route: RouteData): RouteTrafficAnalysis {
    return {
      overallTrafficLevel: 'MODERATE',
      segmentAnalysis: [],
      estimatedDelay: 300, // 5 minutes default
      alternativeRecommendation: false,
      peakHourImpact: {
        isCurrentlyPeakHour: isPeakHour(new Date()),
        peakHourMultiplier: 1.0,
        expectedTrafficIncrease: 0,
        historicalAverage: route.summary.travelTimeInSeconds / 60
      },
      historicalComparison: {
        typicalTravelTime: route.summary.travelTimeInSeconds,
        currentVsTypical: 1.1,
        weekdayPattern: [1.0, 0.8, 0.9, 1.2, 1.4, 1.3, 0.7],
        hourlyPattern: this.generateHourlyPattern()
      },
      congestionScore: 50,
      recommendationScore: 60,
      lastUpdated: new Date()
    };
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    let cleared = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (now >= value.expiry) {
        this.cache.delete(key);
        cleared++;
      }
    }
    
    if (cleared > 0) {
      console.log(`🧹 Route Traffic Analyzer: Cleared ${cleared} expired cache entries`);
    }
  }
}

// Export singleton instance
export const routeTrafficAnalyzer = new RouteTrafficAnalyzer();