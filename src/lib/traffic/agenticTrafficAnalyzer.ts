/**
 * Agentic AI Traffic Analyzer
 * Intelligent traffic analysis system that combines real-time data with AI reasoning
 */

import { tomtomTrafficService, LocationTrafficData, getTrafficSummary, getTrafficTimeRecommendation } from './tomtomTraffic';
import { isCurrentlyPeakHours, getManilaTime } from './peakHours';
import { getActivityCoordinates } from '../data/baguioCoordinates';
import { runAgenticTrafficAnalysis } from './agenticTrafficAgent';

// Activity interface
export interface Activity {
  id: string;
  name: string;
  description: string;
  category: string;
  peakHours?: string;
  lat?: number;
  lon?: number;
  trafficData?: {
    congestionScore: number;
    trafficLevel: 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
    recommendationScore: number;
    lastUpdated: Date;
  };
}

export interface TrafficAnalysisResult {
  activityId: string;
  title: string;
  lat: number;
  lon: number;
  realTimeTraffic: LocationTrafficData;
  peakHoursStatus: {
    isCurrentlyPeak: boolean;
    peakHours: string;
    nextLowTrafficTime?: string;
  };
  combinedScore: number; // 0-100 (higher = better to visit now)
  recommendation: 'VISIT_NOW' | 'VISIT_SOON' | 'AVOID_NOW' | 'PLAN_LATER';
  aiAnalysis: string;
  trafficSummary: string;
  bestTimeToVisit: string;
  alternativeTimeSlots: string[];
  crowdLevel: 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
  lastAnalyzed: Date;
}

export interface AgenticTrafficContext {
  currentTime: Date;
  dayOfWeek: string;
  isWeekend: boolean;
  weatherCondition?: string;
  userPreferences?: {
    avoidCrowds: boolean;
    flexibleTiming: boolean;
    prioritizeTraffic: boolean;
  };
}

class AgenticTrafficAnalyzer {
  private tomtomService: typeof tomtomTrafficService;
  private analysisCache: Map<string, { result: TrafficAnalysisResult; expiry: number }> = new Map();
  private readonly CACHE_DURATION = 3 * 60 * 1000; // 3 minutes cache for real-time analysis

  constructor() {
    this.tomtomService = tomtomTrafficService;
  }

  /**
   * Analyze traffic for a single activity and enhance it with traffic data
   */
  async analyzeTrafficForActivity(activity: Activity): Promise<Activity> {
    try {
      console.log(`🤖 Agentic AI: Starting traffic analysis for "${activity.name}"`);
      
      // Get coordinates for the activity
      const coordinates = getActivityCoordinates(activity.name);
      if (!coordinates) {
        console.warn(`❌ Agentic AI: No coordinates found for activity: ${activity.name}`);
        return activity;
      }

      console.log(`📍 Agentic AI: Found coordinates for "${activity.name}": ${coordinates.lat}, ${coordinates.lon}`);

      // Fetch real-time traffic data
      console.log(`🔍 Agentic AI: Fetching real-time traffic data for "${activity.name}"`);
      const trafficData = await this.tomtomService.getLocationTrafficData(
        coordinates.lat,
        coordinates.lon
      );

      console.log(`📊 Agentic AI: Traffic data received for "${activity.name}":`, {
        congestionScore: trafficData?.congestionScore || 0,
        trafficLevel: trafficData?.trafficLevel || 'UNKNOWN',
        recommendationScore: trafficData?.recommendationScore || 0
      });

      // Add coordinates and traffic data to activity
      const enhancedActivity: Activity = {
        ...activity,
        lat: coordinates.lat,
        lon: coordinates.lon,
        trafficData: trafficData || {
          congestionScore: 50,
          trafficLevel: 'MODERATE' as const,
          recommendationScore: 50,
          lastUpdated: new Date()
        }
      };

      console.log(`✅ Agentic AI: Successfully enhanced "${activity.name}" with traffic data`);
      return enhancedActivity;

    } catch (error) {
      console.warn(`❌ Agentic AI: Error analyzing traffic for "${activity.name}":`, error);
      return activity;
    }
  }

  /**
   * Comprehensive traffic analysis for activity with full AI reasoning
   */
  async analyzeActivityTraffic(
    activityId: string,
    title: string,
    lat: number,
    lon: number,
    peakHours: string,
    context: AgenticTrafficContext
  ): Promise<TrafficAnalysisResult> {
    console.log(`🤖 Agentic AI: Starting comprehensive traffic analysis for "${title}"`);
    
    const cacheKey = `${activityId}-${lat}-${lon}-${Math.floor(Date.now() / this.CACHE_DURATION)}`;
    
    // Check cache first
    const cached = this.analysisCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      console.log(`📋 Agentic AI: Using cached analysis for "${title}"`);
      return cached.result;
    }

    try {
      console.log(`\n=== AGENTIC AI TRAFFIC ANALYZER START ===`);
      console.log(`🤖 Delegating comprehensive analysis for "${title}" to Gemini agent`);

      const agenticResult = await runAgenticTrafficAnalysis({
        activityId,
        title,
        lat,
        lon,
        peakHours,
        context
      });

      this.analysisCache.set(cacheKey, {
        result: agenticResult,
        expiry: Date.now() + (5 * 60 * 1000)
      });

      console.log(`✅ AGENTIC AI SUCCESS: Analysis complete for "${title}"`);
      console.log(`🎯 FINAL ANALYSIS RESULT:`, {
        activity: title,
        combinedScore: agenticResult.combinedScore,
        recommendation: agenticResult.recommendation,
        crowdLevel: agenticResult.crowdLevel,
        realTimeTrafficIntegrated: !!agenticResult.realTimeTraffic,
        peakHoursConsidered: true
      });
      console.log(`=== AGENTIC AI TRAFFIC ANALYZER END ===\n`);
      return agenticResult;

    } catch (error) {
      console.error(`❌ Agentic AI: Error delegating analysis for ${title}:`, error);
      throw error instanceof Error
        ? error
        : new Error(`Agentic traffic analysis failed for ${title}`);
    }
  }

  /**
   * Calculate combined score using AI reasoning (0-100, higher = better to visit now)
   */
  private calculateCombinedScore(
    trafficData: LocationTrafficData,
    peakHoursStatus: any,
    context: AgenticTrafficContext
  ): number {
    let score = 50; // Base score

    // Real-time traffic impact (40% weight)
    const trafficScore = trafficData.recommendationScore;
    score += (trafficScore - 50) * 0.4;

    // Peak hours impact (35% weight)
    if (!peakHoursStatus.isCurrentlyPeak) {
      score += 17.5; // Boost for non-peak hours
    } else {
      score -= 17.5; // Penalty for peak hours
    }

    // Traffic level penalties (15% weight)
    switch (trafficData.trafficLevel) {
      case 'LOW':
        score += 15;
        break;
      case 'MODERATE':
        score += 5;
        break;
      case 'HIGH':
        score -= 10;
        break;
      case 'SEVERE':
        score -= 20;
        break;
    }

    // Time-based adjustments (10% weight)
    const hour = context.currentTime.getHours();
    if (hour >= 6 && hour <= 9) {
      // Early morning - generally good for sightseeing
      score += 5;
    } else if (hour >= 10 && hour <= 14) {
      // Late morning to early afternoon - peak tourist hours
      score -= 5;
    } else if (hour >= 15 && hour <= 18) {
      // Late afternoon - mixed conditions
      score += 2;
    } else if (hour >= 19 && hour <= 21) {
      // Evening - good for dining/nightlife
      score += 3;
    }

    // Weekend adjustments
    if (context.isWeekend) {
      score -= 5; // Generally more crowded on weekends
    }

    // User preference adjustments
    if (context.userPreferences?.avoidCrowds && peakHoursStatus.isCurrentlyPeak) {
      score -= 15;
    }
    if (context.userPreferences?.prioritizeTraffic && trafficData.trafficLevel === 'HIGH') {
      score -= 10;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Generate AI-powered recommendation
   */
  private generateRecommendation(
    combinedScore: number,
    trafficData: LocationTrafficData,
    peakHoursStatus: any,
    context: AgenticTrafficContext
  ): 'VISIT_NOW' | 'VISIT_SOON' | 'AVOID_NOW' | 'PLAN_LATER' {
    // Allow VERY_LOW, LOW and MODERATE traffic for VISIT_NOW recommendations
    if (combinedScore >= 80 && !peakHoursStatus.isCurrentlyPeak && ['VERY_LOW', 'LOW', 'MODERATE'].includes(trafficData.trafficLevel)) {
      return 'VISIT_NOW';
    } else if (combinedScore >= 60 && ['VERY_LOW', 'LOW', 'MODERATE'].includes(trafficData.trafficLevel)) {
      return 'VISIT_SOON';
    } else if (combinedScore < 35 || ['HIGH', 'SEVERE'].includes(trafficData.trafficLevel) || 
               (peakHoursStatus.isCurrentlyPeak && context.userPreferences?.avoidCrowds)) {
      return 'AVOID_NOW';
    } else {
      return 'PLAN_LATER';
    }
  }

  /**
   * Generate intelligent AI analysis
   */
  private generateAIAnalysis(
    trafficData: LocationTrafficData,
    peakHoursStatus: any,
    context: AgenticTrafficContext,
    title: string
  ): string {
    const analyses: string[] = [];

    // Traffic analysis
    if (trafficData.trafficLevel === 'LOW' && trafficData.recommendationScore > 80) {
      analyses.push(`🚗 Excellent traffic conditions with ${trafficData.recommendationScore}% recommendation score`);
    } else if (trafficData.trafficLevel === 'HIGH' || trafficData.trafficLevel === 'SEVERE') {
      analyses.push(`⚠️ Heavy traffic detected (${trafficData.congestionScore}% congestion)`);
    }

    // Peak hours analysis
    if (peakHoursStatus.isCurrentlyPeak) {
      analyses.push(`📈 Currently in peak hours (${peakHoursStatus.peakHours})`);
    } else {
      analyses.push(`✅ Outside peak hours - optimal visiting time`);
    }

    // Time-based insights
    const hour = context.currentTime.getHours();
    if (hour >= 6 && hour <= 9) {
      analyses.push(`🌅 Early morning visit recommended for fewer crowds`);
    } else if (hour >= 19 && hour <= 21) {
      analyses.push(`🌆 Evening timing good for relaxed exploration`);
    }

    // Incident analysis
    if (trafficData.incidents.length > 0) {
      const highImpactIncidents = trafficData.incidents.filter(i => i.magnitudeOfDelay > 2);
      if (highImpactIncidents.length > 0) {
        analyses.push(`🚧 ${highImpactIncidents.length} traffic incident(s) causing delays`);
      }
    }

    // Weekend considerations
    if (context.isWeekend) {
      analyses.push(`📅 Weekend timing - expect higher tourist activity`);
    }

    return analyses.length > 0 ? analyses.join(' • ') : `Real-time analysis for ${title} completed`;
  }

  /**
   * Determine best time to visit based on traffic and peak hours
   */
  private determineBestTimeToVisit(
    trafficData: LocationTrafficData,
    peakHours: string,
    context: AgenticTrafficContext
  ): string {
    if (trafficData.recommendationScore > 80 && !isCurrentlyPeakHours(peakHours)) {
      return "Right now - optimal conditions!";
    }

    // Parse peak hours to suggest alternatives
    if (peakHours) {
      const suggestions = this.generateTimeAlternatives(peakHours);
      if (suggestions.length > 0) {
        return `Best times: ${suggestions.join(' or ')}`;
      }
    }

    // Default time recommendations based on current conditions
    const hour = context.currentTime.getHours();
    if (hour < 9) {
      return "Early morning (7-9 AM) for minimal crowds";
    } else if (hour > 18) {
      return "Early morning (7-9 AM) or late afternoon (4-6 PM)";
    } else {
      return "Early morning or late afternoon for better conditions";
    }
  }

  /**
   * Generate alternative time slots
   */
  private generateAlternativeTimeSlots(
    peakHours: string,
    trafficData: LocationTrafficData,
    context: AgenticTrafficContext
  ): string[] {
    const alternatives: string[] = [];

    // If currently in peak hours, suggest off-peak times
    if (isCurrentlyPeakHours(peakHours)) {
      alternatives.push("After peak hours end");
      alternatives.push("Early morning (7-9 AM)");
      alternatives.push("Late afternoon (4-6 PM)");
    } else {
      // If traffic is bad but not peak hours, suggest different times
      if (trafficData.trafficLevel === 'HIGH' || trafficData.trafficLevel === 'SEVERE') {
        alternatives.push("Early morning (6-8 AM)");
        alternatives.push("Late evening (7-9 PM)");
        alternatives.push("Weekday mornings");
      }
    }

    // Add weekend vs weekday alternatives
    if (context.isWeekend) {
      alternatives.push("Weekday mornings");
    } else {
      alternatives.push("Weekend evenings");
    }

    return [...new Set(alternatives)]; // Remove duplicates
  }

  /**
   * Determine crowd level based on traffic and peak hours
   */
  private determineCrowdLevel(
    trafficData: LocationTrafficData,
    peakHoursStatus: any
  ): 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH' {
    let crowdScore = 0;

    // Traffic-based scoring
    crowdScore += trafficData.congestionScore * 0.4;

    // Peak hours impact
    if (peakHoursStatus.isCurrentlyPeak) {
      crowdScore += 30;
    }

    // Traffic level impact
    switch (trafficData.trafficLevel) {
      case 'LOW': crowdScore += 0; break;
      case 'MODERATE': crowdScore += 15; break;
      case 'HIGH': crowdScore += 25; break;
      case 'SEVERE': crowdScore += 35; break;
    }

    if (crowdScore >= 80) return 'VERY_HIGH';
    if (crowdScore >= 65) return 'HIGH';
    if (crowdScore >= 40) return 'MODERATE';
    if (crowdScore >= 20) return 'LOW';
    return 'VERY_LOW';
  }

  /**
   * Generate time alternatives based on peak hours
   */
  private generateTimeAlternatives(peakHours: string): string[] {
    const alternatives: string[] = [];
    
    // Simple parsing for common peak hour patterns
    if (peakHours.includes('10') && peakHours.includes('12')) {
      alternatives.push('8-10 AM', '2-4 PM');
    }
    if (peakHours.includes('4') && peakHours.includes('6')) {
      alternatives.push('2-4 PM', '7-9 PM');
    }
    if (peakHours.includes('morning') || peakHours.includes('AM')) {
      alternatives.push('2-5 PM', '6-8 PM');
    }
    if (peakHours.includes('evening') || peakHours.includes('PM')) {
      alternatives.push('8-11 AM', '1-3 PM');
    }

    return alternatives;
  }

  /**
   * Get next low traffic time
   */
  private getNextLowTrafficTime(peakHours: string): string {
    // Simple implementation - can be enhanced with more sophisticated parsing
    if (peakHours.includes('AM')) {
      return "After 2 PM";
    } else if (peakHours.includes('PM')) {
      return "Before 10 AM tomorrow";
    }
    return "During off-peak hours";
  }

  /**
   * Create fallback analysis when API fails
   */
  private createFallbackAnalysis(
    activityId: string,
    title: string,
    lat: number,
    lon: number,
    peakHours: string,
    context: AgenticTrafficContext
  ): TrafficAnalysisResult {
    const isCurrentlyPeak = isCurrentlyPeakHours(peakHours);
    
    return {
      activityId,
      title,
      lat,
      lon,
      realTimeTraffic: {
        lat,
        lon,
        incidents: [],
        trafficLevel: 'MODERATE',
        congestionScore: 50,
        recommendationScore: isCurrentlyPeak ? 30 : 70,
        lastUpdated: new Date()
      },
      peakHoursStatus: {
        isCurrentlyPeak,
        peakHours,
        nextLowTrafficTime: isCurrentlyPeak ? this.getNextLowTrafficTime(peakHours) : undefined
      },
      combinedScore: isCurrentlyPeak ? 35 : 65,
      recommendation: isCurrentlyPeak ? 'PLAN_LATER' : 'VISIT_SOON',
      aiAnalysis: `Fallback analysis for ${title} - using peak hours data only`,
      trafficSummary: isCurrentlyPeak ? "🟡 Peak hours - consider visiting later" : "🟢 Good time to visit",
      bestTimeToVisit: isCurrentlyPeak ? "During off-peak hours" : "Current timing is good",
      alternativeTimeSlots: ["Early morning", "Late afternoon"],
      crowdLevel: isCurrentlyPeak ? 'HIGH' : 'MODERATE',
      lastAnalyzed: new Date()
    };
  }

  /**
   * Batch analyze multiple activities
   */
  async batchAnalyzeActivities(
    activities: Array<{
      activityId: string;
      title: string;
      lat: number;
      lon: number;
      peakHours?: string;
    }>,
    context: AgenticTrafficContext
  ): Promise<Map<string, TrafficAnalysisResult>> {
    const results = new Map<string, TrafficAnalysisResult>();
    
    // Process in smaller batches to manage API rate limits
    const batchSize = 3;
    for (let i = 0; i < activities.length; i += batchSize) {
      const batch = activities.slice(i, i + batchSize);
      
      const batchPromises = batch.map(activity => 
        this.analyzeActivityTraffic(
          activity.activityId,
          activity.title,
          activity.lat,
          activity.lon,
          activity.peakHours || '',
          context
        )
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.set(batch[index].activityId, result.value);
        }
      });
      
      // Small delay between batches
      if (i + batchSize < activities.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    return results;
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.analysisCache.entries()) {
      if (now >= value.expiry) {
        this.analysisCache.delete(key);
      }
    }
  }
}

// Export singleton instance
export const agenticTrafficAnalyzer = new AgenticTrafficAnalyzer();

/**
 * Create traffic context from current conditions
 */
export function createTrafficContext(userPreferences?: any): AgenticTrafficContext {
  const currentTime = getManilaTime();
  const dayOfWeek = currentTime.toLocaleDateString('en-US', { weekday: 'long' });
  const isWeekend = dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday';

  return {
    currentTime,
    dayOfWeek,
    isWeekend,
    userPreferences: userPreferences || {
      avoidCrowds: true,
      flexibleTiming: true,
      prioritizeTraffic: true
    }
  };
}
