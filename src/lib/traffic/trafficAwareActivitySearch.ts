

import { agenticTrafficAnalyzer, createTrafficContext, TrafficAnalysisResult } from './agenticTrafficAnalyzer';
import { getActivityCoordinates } from '../data/baguioCoordinates';
import { isCurrentlyPeakHours } from './peakHours';
import type { Activity } from '@/app/itinerary-generator/data/itineraryData';

export interface TrafficEnhancedActivity extends Activity {
  trafficAnalysis?: TrafficAnalysisResult;
  combinedTrafficScore: number; 
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
  
  async enhanceActivitiesWithTraffic(
    activities: Activity[],
    options: TrafficAwareSearchOptions = {
      prioritizeTraffic: true,
      avoidCrowds: false, 
      flexibleTiming: true,
      maxTrafficLevel: 'MODERATE' 
    }
  ): Promise<TrafficEnhancedActivity[]> {
    const context = createTrafficContext({
      avoidCrowds: options.avoidCrowds,
      flexibleTiming: options.flexibleTiming,
      prioritizeTraffic: options.prioritizeTraffic
    });

    const enhancedActivities: TrafficEnhancedActivity[] = [];

    
    const batchSize = 3; 
    for (let i = 0; i < activities.length; i += batchSize) {
      const batch = activities.slice(i, i + batchSize);
      
      console.log(`🔄 Traffic Enhancement: Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(activities.length/batchSize)} (${batch.length} activities)`);

      const batchPromises = batch.map(async (activity) => {
        try {
          
          const coordsFromActivity = (activity.lat != null && activity.lon != null)
            ? { lat: activity.lat, lon: activity.lon, name: activity.title, category: (activity as any).category || 'search' } as any
            : null
          const coordinates = coordsFromActivity || getActivityCoordinates(activity.title);
          if (!coordinates) {
            console.warn(`⚠️ Traffic Enhancement: No coordinates found for "${activity.title}"`);
            return this.createFallbackEnhancedActivity(activity);
          }

          
          const trafficAnalysis = await agenticTrafficAnalyzer.analyzeActivityTraffic(
            activity.title, 
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
    }

    console.log(`✅ Traffic Enhancement: Completed processing ${enhancedActivities.length} activities`);
    return enhancedActivities;
  }

  
  filterAndSortByTraffic(
    activities: TrafficEnhancedActivity[],
    options: TrafficAwareSearchOptions
  ): TrafficEnhancedActivity[] {
    console.log(`🔍 Traffic Filtering: Starting with ${activities.length} activities`);

    
    
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
      return true 
    });

    console.log(`📊 Traffic Filtering: ${filtered.length} activities passed filters`);

    
    filtered.sort((a, b) => {
      if (options.prioritizeTraffic) {
        
        const scoreDiff = b.combinedTrafficScore - a.combinedTrafficScore;
        if (Math.abs(scoreDiff) > 10) return scoreDiff;
        
        
        return (b.relevanceScore || 0) - (a.relevanceScore || 0);
      } else {
        
        const relevanceDiff = (b.relevanceScore || 0) - (a.relevanceScore || 0);
        if (Math.abs(relevanceDiff) > 0.1) return relevanceDiff;
        
        
        return b.combinedTrafficScore - a.combinedTrafficScore;
      }
    });

    console.log(`🎯 Traffic Filtering: Sorted activities by ${options.prioritizeTraffic ? 'traffic score' : 'relevance score'}`);

    return filtered;
  }

  
  updateDescriptionsWithTrafficInsights(activities: TrafficEnhancedActivity[]): TrafficEnhancedActivity[] {
    console.log(`📝 Traffic Insights: Adding traffic information to ${activities.length} activity descriptions`);

    return activities.map(activity => {
      if (!activity.trafficAnalysis) {
        return activity;
      }

      const { trafficAnalysis } = activity;
      let enhancedDescription = activity.desc || ''; 

      
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

  
  private generateTrafficInsight(trafficAnalysis: TrafficAnalysisResult): string {
    const { recommendation, trafficSummary, bestTimeToVisit, crowdLevel } = trafficAnalysis;

    const insights: string[] = [];

    
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

    
    if (crowdLevel === 'VERY_LOW' || crowdLevel === 'LOW') {
      insights.push('✨ Expect minimal crowds.');
    } else if (crowdLevel === 'VERY_HIGH') {
      insights.push('⚠️ High crowd levels expected.');
    }

    
    if (trafficSummary && !trafficSummary.includes('moderate')) {
      insights.push(trafficSummary);
    }

    return insights.length > 0 ? insights.join(' ') : '';
  }

  
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


export const trafficAwareActivitySearch = new TrafficAwareActivitySearchService();


export function createDefaultTrafficOptions(): TrafficAwareSearchOptions {
  return {
    prioritizeTraffic: true,
    avoidCrowds: false, 
    flexibleTiming: true,
    maxTrafficLevel: 'MODERATE', 
    weatherCondition: undefined
  };
}
