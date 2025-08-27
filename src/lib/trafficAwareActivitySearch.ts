/**
 * Traffic-Aware Activity Search Enhancement
 * Integrates real-time traffic data with activity search and scoring
 */

import { agenticTrafficAnalyzer, createTrafficContext, TrafficAnalysisResult } from './agenticTrafficAnalyzer';
import { getActivityCoordinates } from './baguioCoordinates';
import { isCurrentlyPeakHours } from './peakHours';
import type { Activity } from '@/app/itinerary-generator/data/itineraryData';

export interface TrafficEnhancedActivity extends Activity {
  trafficAnalysis?: TrafficAnalysisResult;
  combinedTrafficScore: number; // 0-100 (higher = better to visit now)
  trafficRecommendation: 'VISIT_NOW' | 'VISIT_SOON' | 'AVOID_NOW' | 'PLAN_LATER';
  crowdLevel: 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
}

export interface TrafficAwareSearchOptions {
  prioritizeTraffic: boolean;
  avoidCrowds: boolean;
  flexibleTiming: boolean;
  maxTrafficLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
  weatherCondition?: string;
}

class TrafficAwareActivitySearchService {
  /**
   * Enhance activities with real-time traffic data
   */
  async enhanceActivitiesWithTraffic(
    activities: Activity[],
    options: TrafficAwareSearchOptions = {
      prioritizeTraffic: true,
      avoidCrowds: true,
      flexibleTiming: true,
      maxTrafficLevel: 'HIGH'
    }
  ): Promise<TrafficEnhancedActivity[]> {
    const context = createTrafficContext({
      avoidCrowds: options.avoidCrowds,
      flexibleTiming: options.flexibleTiming,
      prioritizeTraffic: options.prioritizeTraffic
    });

    const enhancedActivities: TrafficEnhancedActivity[] = [];

    // Process activities in batches for better performance
    const batchSize = 5;
    for (let i = 0; i < activities.length; i += batchSize) {
      const batch = activities.slice(i, i + batchSize);
      const batchResults = await this.processBatch(batch, context, options);
      enhancedActivities.push(...batchResults);
    }

    return enhancedActivities;
  }

  /**
   * Process a batch of activities with traffic analysis
   */
  private async processBatch(
    activities: Activity[],
    context: any,
    options: TrafficAwareSearchOptions
  ): Promise<TrafficEnhancedActivity[]> {
    const results: TrafficEnhancedActivity[] = [];

    for (const activity of activities) {
      try {
        const enhanced = await this.enhanceSingleActivity(activity, context, options);
        results.push(enhanced);
      } catch (error) {
        console.error(`Error enhancing activity ${activity.title}:`, error);
        // Add fallback enhancement
        results.push(this.createFallbackEnhancement(activity, options));
      }
    }

    return results;
  }

  /**
   * Enhance a single activity with traffic data
   */
  private async enhanceSingleActivity(
    activity: Activity,
    context: any,
    options: TrafficAwareSearchOptions
  ): Promise<TrafficEnhancedActivity> {
    // Get coordinates for the activity
    const coordinates = getActivityCoordinates(activity.title);
    
    let trafficAnalysis: TrafficAnalysisResult | undefined;
    let combinedTrafficScore = 50; // Default moderate score
    let trafficRecommendation: 'VISIT_NOW' | 'VISIT_SOON' | 'AVOID_NOW' | 'PLAN_LATER' = 'VISIT_SOON';
    let crowdLevel: 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH' = 'MODERATE';

    if (coordinates) {
      // Perform traffic analysis
      trafficAnalysis = await agenticTrafficAnalyzer.analyzeActivityTraffic(
        activity.title,
        activity.title,
        coordinates.lat,
        coordinates.lon,
        activity.peakHours || '',
        context
      );

      combinedTrafficScore = trafficAnalysis.combinedScore;
      trafficRecommendation = trafficAnalysis.recommendation;
      crowdLevel = trafficAnalysis.crowdLevel;

      // Update activity with coordinates and traffic data
      activity.lat = coordinates.lat;
      activity.lon = coordinates.lon;
      activity.trafficData = {
        congestionScore: trafficAnalysis.realTimeTraffic.congestionScore,
        recommendationScore: trafficAnalysis.realTimeTraffic.recommendationScore,
        trafficLevel: trafficAnalysis.realTimeTraffic.trafficLevel,
        lastUpdated: trafficAnalysis.lastAnalyzed
      };
    } else {
      // Fallback to peak hours analysis only
      const isCurrentlyPeak = isCurrentlyPeakHours(activity.peakHours || '');
      combinedTrafficScore = isCurrentlyPeak ? 30 : 70;
      trafficRecommendation = isCurrentlyPeak ? 'PLAN_LATER' : 'VISIT_SOON';
      crowdLevel = isCurrentlyPeak ? 'HIGH' : 'MODERATE';
    }

    return {
      ...activity,
      trafficAnalysis,
      combinedTrafficScore,
      trafficRecommendation,
      crowdLevel
    };
  }

  /**
   * Create fallback enhancement when traffic analysis fails
   */
  private createFallbackEnhancement(
    activity: Activity,
    options: TrafficAwareSearchOptions
  ): TrafficEnhancedActivity {
    const isCurrentlyPeak = isCurrentlyPeakHours(activity.peakHours || '');
    
    return {
      ...activity,
      combinedTrafficScore: isCurrentlyPeak ? 35 : 65,
      trafficRecommendation: isCurrentlyPeak ? 'PLAN_LATER' : 'VISIT_SOON',
      crowdLevel: isCurrentlyPeak ? 'HIGH' : 'MODERATE'
    };
  }

  /**
   * Filter and sort activities based on traffic conditions
   */
  filterAndSortByTraffic(
    activities: TrafficEnhancedActivity[],
    options: TrafficAwareSearchOptions
  ): TrafficEnhancedActivity[] {
    let filtered = activities;

    // Filter by traffic level if specified
    if (options.maxTrafficLevel) {
      const maxLevelValue = this.getTrafficLevelValue(options.maxTrafficLevel);
      filtered = filtered.filter(activity => {
        const activityLevel = activity.trafficData?.trafficLevel || 'MODERATE';
        return this.getTrafficLevelValue(activityLevel) <= maxLevelValue;
      });
    }

    // Filter by crowd avoidance preference
    if (options.avoidCrowds) {
      filtered = filtered.filter(activity => 
        activity.crowdLevel !== 'VERY_HIGH' && activity.crowdLevel !== 'HIGH'
      );
    }

    // Sort by combined traffic score (higher = better)
    filtered.sort((a, b) => {
      if (options.prioritizeTraffic) {
        // Primary sort by traffic score
        const scoreDiff = b.combinedTrafficScore - a.combinedTrafficScore;
        if (Math.abs(scoreDiff) > 10) return scoreDiff;
        
        // Secondary sort by relevance score if traffic scores are similar
        return (b.relevanceScore || 0) - (a.relevanceScore || 0);
      } else {
        // Primary sort by relevance score
        const relevanceDiff = (b.relevanceScore || 0) - (a.relevanceScore || 0);
        if (Math.abs(relevanceDiff) > 0.1) return relevanceDiff;
        
        // Secondary sort by traffic score
        return b.combinedTrafficScore - a.combinedTrafficScore;
      }
    });

    return filtered;
  }

  /**
   * Get numeric value for traffic level comparison
   */
  private getTrafficLevelValue(level: string): number {
    switch (level) {
      case 'LOW': return 1;
      case 'MODERATE': return 2;
      case 'HIGH': return 3;
      case 'SEVERE': return 4;
      default: return 2;
    }
  }

  /**
   * Generate traffic-aware activity recommendations
   */
  generateTrafficRecommendations(activities: TrafficEnhancedActivity[]): {
    visitNow: TrafficEnhancedActivity[];
    visitSoon: TrafficEnhancedActivity[];
    avoidNow: TrafficEnhancedActivity[];
    planLater: TrafficEnhancedActivity[];
  } {
    const recommendations = {
      visitNow: [] as TrafficEnhancedActivity[],
      visitSoon: [] as TrafficEnhancedActivity[],
      avoidNow: [] as TrafficEnhancedActivity[],
      planLater: [] as TrafficEnhancedActivity[]
    };

    activities.forEach(activity => {
      switch (activity.trafficRecommendation) {
        case 'VISIT_NOW':
          recommendations.visitNow.push(activity);
          break;
        case 'VISIT_SOON':
          recommendations.visitSoon.push(activity);
          break;
        case 'AVOID_NOW':
          recommendations.avoidNow.push(activity);
          break;
        case 'PLAN_LATER':
          recommendations.planLater.push(activity);
          break;
      }
    });

    return recommendations;
  }

  /**
   * Get traffic summary for itinerary planning
   */
  getTrafficSummary(activities: TrafficEnhancedActivity[]): {
    averageTrafficScore: number;
    totalLowTraffic: number;
    totalHighTraffic: number;
    recommendedCount: number;
    summary: string;
  } {
    const totalScore = activities.reduce((sum, activity) => sum + activity.combinedTrafficScore, 0);
    const averageTrafficScore = activities.length > 0 ? totalScore / activities.length : 50;
    
    const totalLowTraffic = activities.filter(a => a.combinedTrafficScore >= 70).length;
    const totalHighTraffic = activities.filter(a => a.combinedTrafficScore < 40).length;
    const recommendedCount = activities.filter(a => 
      a.trafficRecommendation === 'VISIT_NOW' || a.trafficRecommendation === 'VISIT_SOON'
    ).length;

    let summary = '';
    if (averageTrafficScore >= 80) {
      summary = '🟢 Excellent traffic conditions for most activities';
    } else if (averageTrafficScore >= 60) {
      summary = '🟡 Good traffic conditions with some optimal timing';
    } else if (averageTrafficScore >= 40) {
      summary = '🟠 Mixed traffic conditions - timing optimization recommended';
    } else {
      summary = '🔴 Heavy traffic conditions - consider alternative timing';
    }

    return {
      averageTrafficScore: Math.round(averageTrafficScore),
      totalLowTraffic,
      totalHighTraffic,
      recommendedCount,
      summary
    };
  }

  /**
   * Update activity descriptions with traffic insights
   */
  updateDescriptionsWithTrafficInsights(activities: TrafficEnhancedActivity[]): TrafficEnhancedActivity[] {
    return activities.map(activity => {
      if (activity.trafficAnalysis) {
        const trafficInsight = this.generateTrafficInsight(activity.trafficAnalysis);
        activity.desc = `${activity.desc} ${trafficInsight}`;
      }
      return activity;
    });
  }

  /**
   * Generate traffic insight text for activity description
   */
  private generateTrafficInsight(analysis: TrafficAnalysisResult): string {
    const { recommendation, trafficSummary, bestTimeToVisit } = analysis;
    
    switch (recommendation) {
      case 'VISIT_NOW':
        return `🟢 ${trafficSummary} - Perfect time to visit!`;
      case 'VISIT_SOON':
        return `🟡 ${trafficSummary} - ${bestTimeToVisit}`;
      case 'AVOID_NOW':
        return `🔴 Heavy traffic/crowds detected - ${bestTimeToVisit}`;
      case 'PLAN_LATER':
        return `🟠 Consider visiting ${bestTimeToVisit}`;
      default:
        return `ℹ️ ${trafficSummary}`;
    }
  }
}

// Export singleton instance
export const trafficAwareActivitySearch = new TrafficAwareActivitySearchService();

/**
 * Utility function to create default traffic search options
 */
export function createDefaultTrafficOptions(prioritizeTraffic: boolean = true): TrafficAwareSearchOptions {
  return {
    prioritizeTraffic,
    avoidCrowds: true,
    flexibleTiming: true,
    maxTrafficLevel: 'HIGH'
  };
}
