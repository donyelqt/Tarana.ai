/**
 * Traffic-Aware Activity Search Enhancement
 * Integrates real-time traffic data with activity search and scoring
 */

import { agenticTrafficAnalyzer, createTrafficContext, TrafficAnalysisResult } from './agenticTrafficAnalyzer';
import { getActivityCoordinates } from '../data/baguioCoordinates';
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
      maxTrafficLevel: 'LOW'
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
      
      console.log(`🔄 Traffic Enhancement: Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(activities.length/batchSize)} (${batch.length} activities)`);

      const batchPromises = batch.map(async (activity) => {
        try {
          // Get coordinates for the activity
          const coordinates = getActivityCoordinates(activity.title);
          if (!coordinates) {
            console.warn(`⚠️ Traffic Enhancement: No coordinates found for "${activity.title}"`);
            return this.createFallbackEnhancedActivity(activity);
          }

          // Analyze traffic for this activity
          const trafficAnalysis = await agenticTrafficAnalyzer.analyzeActivityTraffic(
            activity.title, // Use title as ID since Activity type doesn't have id property
            activity.title,
            coordinates.lat,
            coordinates.lon,
            activity.peakHours || '',
            context
          );

          console.log(`📊 Traffic Enhancement: Analysis complete for "${activity.title}":`, {
            combinedScore: trafficAnalysis.combinedScore,
            recommendation: trafficAnalysis.recommendation,
            crowdLevel: trafficAnalysis.crowdLevel
          });

          return {
            ...activity,
            trafficAnalysis,
            combinedTrafficScore: trafficAnalysis.combinedScore,
            trafficRecommendation: trafficAnalysis.recommendation,
            crowdLevel: trafficAnalysis.crowdLevel,
            lat: coordinates.lat,
            lon: coordinates.lon
          } as TrafficEnhancedActivity;

        } catch (error) {
          console.error(`❌ Traffic Enhancement: Error processing "${activity.title}":`, error);
          return this.createFallbackEnhancedActivity(activity);
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          enhancedActivities.push(result.value);
        } else {
          console.error(`❌ Traffic Enhancement: Failed to process "${batch[index].title}":`, result.reason);
          enhancedActivities.push(this.createFallbackEnhancedActivity(batch[index]));
        }
      });

      // Small delay between batches to respect API rate limits
      if (i + batchSize < activities.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`✅ Traffic Enhancement: Completed processing ${enhancedActivities.length} activities`);
    return enhancedActivities;
  }

  /**
   * Filter and sort activities based on traffic conditions
   */
  filterAndSortByTraffic(
    activities: TrafficEnhancedActivity[],
    options: TrafficAwareSearchOptions
  ): TrafficEnhancedActivity[] {
    console.log(`🔍 Traffic Filtering: Starting with ${activities.length} activities`);

    // STRICT filtering: Only allow LOW traffic activities
    let filtered = activities.filter(activity => {
      // CRITICAL: Strict traffic level filtering - only LOW allowed
      if (activity.trafficAnalysis?.realTimeTraffic.trafficLevel) {
        const trafficLevel = activity.trafficAnalysis.realTimeTraffic.trafficLevel;
        
        // ABSOLUTE REQUIREMENT: Only LOW traffic activities allowed
        if (trafficLevel !== 'LOW') {
          console.log(`🚫 STRICT TRAFFIC FILTERING: Excluding "${activity.title}" - traffic level ${trafficLevel} (ONLY LOW ALLOWED)`);
          return false;
        }
      }

      // Additional filtering: Exclude MODERATE/HIGH crowd levels
      if (activity.crowdLevel && ['MODERATE', 'HIGH', 'VERY_HIGH'].includes(activity.crowdLevel)) {
        console.log(`🚫 STRICT CROWD FILTERING: Excluding "${activity.title}" - crowd level ${activity.crowdLevel} (ONLY LOW CROWDS ALLOWED)`);
        return false;
      }

      // Filter by traffic recommendation - exclude anything not optimal
      if (activity.trafficRecommendation && ['AVOID_NOW', 'PLAN_LATER'].includes(activity.trafficRecommendation)) {
        console.log(`🚫 STRICT RECOMMENDATION FILTERING: Excluding "${activity.title}" - recommendation ${activity.trafficRecommendation} (ONLY VISIT_NOW/VISIT_SOON ALLOWED)`);
        return false;
      }

      // Final validation: Ensure only activities with LOW traffic make it through
      console.log(`✅ STRICT FILTERING PASSED: "${activity.title}" - traffic level: ${activity.trafficAnalysis?.realTimeTraffic.trafficLevel || 'UNKNOWN'}, crowd: ${activity.crowdLevel || 'UNKNOWN'}, recommendation: ${activity.trafficRecommendation || 'UNKNOWN'}`);
      return true;
    });

    console.log(`📊 Traffic Filtering: ${filtered.length} activities passed filters`);

    // Sort by traffic-aware scoring
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

    console.log(`🎯 Traffic Filtering: Sorted activities by ${options.prioritizeTraffic ? 'traffic score' : 'relevance score'}`);

    return filtered;
  }

  /**
   * Update activity descriptions with traffic insights
   */
  updateDescriptionsWithTrafficInsights(activities: TrafficEnhancedActivity[]): TrafficEnhancedActivity[] {
    console.log(`📝 Traffic Insights: Adding traffic information to ${activities.length} activity descriptions`);

    return activities.map(activity => {
      if (!activity.trafficAnalysis) {
        return activity;
      }

      const { trafficAnalysis } = activity;
      let enhancedDescription = activity.desc || ''; // Activity type uses 'desc' property, not 'description'

      // Add traffic timing insights
      const trafficInsight = this.generateTrafficInsight(trafficAnalysis);
      if (trafficInsight) {
        enhancedDescription += ` ${trafficInsight}`;
      }

      console.log(`✨ Traffic Insights: Enhanced description for "${activity.title}" with traffic data`);

      return {
        ...activity,
        desc: enhancedDescription,
        description: enhancedDescription
      };
    });
  }

  /**
   * Generate traffic insight text for activity descriptions
   */
  private generateTrafficInsight(trafficAnalysis: TrafficAnalysisResult): string {
    const { recommendation, trafficSummary, bestTimeToVisit, crowdLevel } = trafficAnalysis;

    const insights: string[] = [];

    // Add recommendation-based insight
    switch (recommendation) {
      case 'VISIT_NOW':
        insights.push('🎯 Perfect time to visit right now!');
        break;
      case 'VISIT_SOON':
        insights.push('👍 Good time to visit with favorable conditions.');
        break;
      case 'PLAN_LATER':
        insights.push(`⏰ ${bestTimeToVisit}`);
        break;
      case 'AVOID_NOW':
        insights.push(`🚫 Currently busy - ${bestTimeToVisit}`);
        break;
    }

    // Add crowd level insight
    if (crowdLevel === 'VERY_LOW' || crowdLevel === 'LOW') {
      insights.push('✨ Expect minimal crowds.');
    } else if (crowdLevel === 'VERY_HIGH') {
      insights.push('⚠️ High crowd levels expected.');
    }

    // Add traffic summary if relevant
    if (trafficSummary && !trafficSummary.includes('moderate')) {
      insights.push(trafficSummary);
    }

    return insights.length > 0 ? insights.join(' ') : '';
  }

  /**
   * Create fallback enhanced activity when traffic analysis fails
   */
  private createFallbackEnhancedActivity(activity: Activity): TrafficEnhancedActivity {
    const isCurrentlyPeak = activity.peakHours ? isCurrentlyPeakHours(activity.peakHours) : false;
    
    return {
      ...activity,
      combinedTrafficScore: isCurrentlyPeak ? 30 : 70,
      trafficRecommendation: isCurrentlyPeak ? 'PLAN_LATER' : 'VISIT_SOON',
      crowdLevel: isCurrentlyPeak ? 'HIGH' : 'MODERATE'
    };
  }

  /**
   * Get traffic recommendations for multiple activities
   */
  async getTrafficRecommendations(
    activities: Activity[],
    options: TrafficAwareSearchOptions = {
      prioritizeTraffic: true,
      avoidCrowds: true,
      flexibleTiming: true,
      maxTrafficLevel: 'LOW'
    }
  ): Promise<{
    recommended: TrafficEnhancedActivity[];
    avoid: TrafficEnhancedActivity[];
    summary: {
      totalAnalyzed: number;
      recommendedCount: number;
      avoidCount: number;
      averageTrafficScore: number;
    };
  }> {
    console.log(`🎯 Traffic Recommendations: Analyzing ${activities.length} activities`);

    const enhanced = await this.enhanceActivitiesWithTraffic(activities, options);
    const filtered = this.filterAndSortByTraffic(enhanced, options);

    const recommended = filtered.filter(a => 
      a.trafficRecommendation === 'VISIT_NOW' || a.trafficRecommendation === 'VISIT_SOON'
    );

    const avoid = enhanced.filter(a => 
      a.trafficRecommendation === 'AVOID_NOW'
    );

    const averageTrafficScore = enhanced.reduce((sum, a) => sum + a.combinedTrafficScore, 0) / enhanced.length;

    const summary = {
      totalAnalyzed: enhanced.length,
      recommendedCount: recommended.length,
      avoidCount: avoid.length,
      averageTrafficScore: Math.round(averageTrafficScore)
    };

    console.log(`📊 Traffic Recommendations: Summary:`, summary);

    return {
      recommended,
      avoid,
      summary
    };
  }
}

// Export singleton instance
export const trafficAwareActivitySearch = new TrafficAwareActivitySearchService();

/**
 * Create default traffic options
 */
export function createDefaultTrafficOptions(prioritizeTraffic: boolean = true): TrafficAwareSearchOptions {
  return {
    prioritizeTraffic,
    avoidCrowds: true,
    flexibleTiming: true,
    maxTrafficLevel: 'LOW',
    weatherCondition: undefined
  };
}

/**
 * Utility function to check if an activity should be avoided based on traffic
 */
export function shouldAvoidActivity(activity: TrafficEnhancedActivity): boolean {
  return activity.trafficRecommendation === 'AVOID_NOW' || 
         activity.crowdLevel === 'VERY_HIGH' ||
         (activity.trafficAnalysis?.realTimeTraffic.trafficLevel === 'SEVERE');
}
