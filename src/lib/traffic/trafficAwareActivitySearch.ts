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
  maxTrafficLevel: 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
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
      avoidCrowds: false, // Allow more variety
      flexibleTiming: true,
      maxTrafficLevel: 'MODERATE' // Allow VERY_LOW, LOW and MODERATE traffic
    }
  ): Promise<TrafficEnhancedActivity[]> {
    const context = createTrafficContext({
      avoidCrowds: options.avoidCrowds,
      flexibleTiming: options.flexibleTiming,
      prioritizeTraffic: options.prioritizeTraffic
    });

    const enhancedActivities: TrafficEnhancedActivity[] = [];

    // Process activities in batches — 5 concurrent to respect TomTom rate limits (was 40 → 429s)
    const batchSize = 3; // p-limit(3) per-instance PH peak cap (was 5, spec 9.3/5b)
    for (let i = 0; i < activities.length; i += batchSize) {
      const batch = activities.slice(i, i + batchSize);
      
      console.log(`🔄 Traffic Enhancement: Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(activities.length/batchSize)} (${batch.length} activities)`);

      const batchPromises = batch.map(async (activity) => {
        try {
          // Get coordinates for the activity — prefer lat/lon from search (world/PH) over Baguio lookup
          const coordsFromActivity = (activity.lat != null && activity.lon != null)
            ? { lat: activity.lat, lon: activity.lon, name: activity.title, category: (activity as any).category || 'search' } as any
            : null
          const coordinates = coordsFromActivity || getActivityCoordinates(activity.title);
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
      // 5b: 200ms sleep removed (floor breaker)
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

    // Soft ranking: keep all activities, penalize HIGH/SEVERE via combinedTrafficScore (no hard drop)
    // Previously hard-filtered HIGH/SEVERE/AVOID_NOW → 0 results on congested days
    const filtered = activities.filter(activity => {
      const lvl = activity.trafficAnalysis?.realTimeTraffic.trafficLevel
      if (lvl === 'HIGH' || lvl === 'SEVERE') {
        console.log(`⚠️ SOFT PENALTY: "${activity.title}" traffic ${lvl} will rank lower (not dropped)`)
      }
      if (activity.crowdLevel === 'VERY_HIGH') {
        console.log(`⚠️ SOFT PENALTY: "${activity.title}" crowd VERY_HIGH will rank lower`)
      }
      if (activity.trafficRecommendation === 'AVOID_NOW') {
        console.log(`⚠️ SOFT PENALTY: "${activity.title}" AVOID_NOW will rank lower`)
      }
      return true // keep all — sorting will penalize via combinedTrafficScore
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

}

// Export singleton instance
export const trafficAwareActivitySearch = new TrafficAwareActivitySearchService();

/**
 * Create default traffic-aware search options
 */
export function createDefaultTrafficOptions(): TrafficAwareSearchOptions {
  return {
    prioritizeTraffic: true,
    avoidCrowds: false, // Allow more variety
    flexibleTiming: true,
    maxTrafficLevel: 'MODERATE', // Allow VERY_LOW, LOW and MODERATE traffic
    weatherCondition: undefined
  };
}
