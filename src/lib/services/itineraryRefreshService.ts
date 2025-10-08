/**
 * Enterprise-Grade Itinerary Refresh Service
 * Detects significant weather and traffic changes to trigger itinerary updates
 * 
 * @module itineraryRefreshService
 * @author Tarana.ai Engineering Team
 */

import { WeatherData } from '../core/utils';
import { tomtomTrafficService, LocationTrafficData } from '../traffic/tomtomTraffic';
import { SavedItinerary } from '../data/savedItineraries';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type RefreshReason = 
  | 'WEATHER_SIGNIFICANT_CHANGE'
  | 'TRAFFIC_DEGRADATION'
  | 'WEATHER_AND_TRAFFIC'
  | 'INCIDENT_DETECTED'
  | 'MANUAL_REFRESH'
  | 'SCHEDULED_REFRESH';

export type RefreshStatus = 
  | 'FRESH'
  | 'STALE_PENDING'
  | 'REFRESHING'
  | 'REFRESH_FAILED'
  | 'REFRESH_COMPLETED';

export interface RefreshMetadata {
  lastEvaluatedAt: Date;
  lastRefreshedAt: Date | null;
  refreshReasons: RefreshReason[];
  status: RefreshStatus;
  weatherSnapshot: WeatherData | null;
  trafficSnapshot: TrafficSnapshot | null;
  refreshCount: number;
  autoRefreshEnabled: boolean;
}

export interface TrafficSnapshot {
  averageCongestionScore: number;
  averageTrafficLevel: 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
  incidentCount: number;
  timestamp: Date;
  locationSamples: Array<{
    lat: number;
    lon: number;
    trafficLevel: string;
    congestionScore: number;
  }>;
}

export interface ChangeDetectionResult {
  needsRefresh: boolean;
  reasons: RefreshReason[];
  weatherChange: WeatherChangeDetails | null;
  trafficChange: TrafficChangeDetails | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number; // 0-100
}

export interface WeatherChangeDetails {
  temperatureDelta: number;
  previousCondition: string;
  currentCondition: string;
  conditionChanged: boolean;
  precipitationChange: boolean;
  extremeWeatherDetected: boolean;
}

export interface TrafficChangeDetails {
  congestionDelta: number;
  previousLevel: string;
  currentLevel: string;
  levelChanged: boolean;
  newIncidents: number;
  criticalIncidents: number;
}

export interface RefreshConfiguration {
  temperatureThreshold: number; // Celsius
  congestionThreshold: number; // Percentage points
  enableAutoRefresh: boolean;
  evaluationIntervalHours: number;
  maxRefreshesPerDay: number;
  weatherConditionPriority: string[];
  trafficLevelThreshold: 'LOW' | 'MODERATE' | 'HIGH';
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: RefreshConfiguration = {
  temperatureThreshold: 5, // 5°C change triggers refresh
  congestionThreshold: 30, // 30% increase in congestion
  enableAutoRefresh: true,
  evaluationIntervalHours: 6, // Check every 6 hours
  maxRefreshesPerDay: 4, // Max 4 refreshes per day
  weatherConditionPriority: [
    'thunderstorm',
    'tornado',
    'squall',
    'rain',
    'drizzle',
    'snow',
    'clear'
  ],
  trafficLevelThreshold: 'MODERATE' // Refresh if traffic exceeds MODERATE
};

// ============================================================================
// ITINERARY REFRESH SERVICE
// ============================================================================

class ItineraryRefreshService {
  private config: RefreshConfiguration;
  private evaluationCache: Map<string, ChangeDetectionResult> = new Map();
  private readonly CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

  constructor(config: Partial<RefreshConfiguration> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    console.log('🔄 ItineraryRefreshService initialized with config:', this.config);
  }

  // ==========================================================================
  // CORE CHANGE DETECTION
  // ==========================================================================

  /**
   * Evaluate if an itinerary needs refresh based on current conditions
   */
  async evaluateRefreshNeed(
    itinerary: SavedItinerary,
    currentWeather: WeatherData,
    activityCoordinates: Array<{ lat: number; lon: number }>
  ): Promise<ChangeDetectionResult> {
    console.log(`🔍 Evaluating refresh need for itinerary: ${itinerary.id}`);

    const cacheKey = `${itinerary.id}_${Date.now()}`;
    
    try {
      // 1. Weather Change Detection
      const weatherChange = this.detectWeatherChange(
        itinerary.weatherData || null,
        currentWeather
      );

      // 2. Traffic Change Detection
      const trafficChange = await this.detectTrafficChange(
        itinerary,
        activityCoordinates
      );

      // 3. Determine if refresh is needed
      const needsRefresh = this.shouldRefresh(weatherChange, trafficChange);
      
      // 4. Collect reasons
      const reasons = this.collectRefreshReasons(weatherChange, trafficChange);
      
      // 5. Calculate severity and confidence
      const severity = this.calculateSeverity(weatherChange, trafficChange);
      const confidence = this.calculateConfidence(weatherChange, trafficChange);

      const result: ChangeDetectionResult = {
        needsRefresh,
        reasons,
        weatherChange,
        trafficChange,
        severity,
        confidence
      };

      console.log(`✅ Evaluation complete:`, {
        needsRefresh,
        reasons,
        severity,
        confidence: `${confidence}%`
      });

      // Cache result
      this.evaluationCache.set(cacheKey, result);
      
      return result;

    } catch (error) {
      console.error('❌ Error evaluating refresh need:', error);
      
      // Return conservative result on error
      return {
        needsRefresh: false,
        reasons: [],
        weatherChange: null,
        trafficChange: null,
        severity: 'LOW',
        confidence: 0
      };
    }
  }

  // ==========================================================================
  // WEATHER CHANGE DETECTION
  // ==========================================================================

  /**
   * Detect significant weather changes
   */
  private detectWeatherChange(
    previousWeather: WeatherData | null,
    currentWeather: WeatherData
  ): WeatherChangeDetails | null {
    if (!previousWeather || !previousWeather.main) {
      console.log('⚠️ No previous weather data - assuming change');
      return {
        temperatureDelta: 0,
        previousCondition: 'unknown',
        currentCondition: currentWeather.weather[0]?.main.toLowerCase() || 'unknown',
        conditionChanged: true,
        precipitationChange: false,
        extremeWeatherDetected: this.isExtremeWeather(currentWeather)
      };
    }

    const tempDelta = Math.abs(currentWeather.main.temp - previousWeather.main.temp);
    const prevCondition = previousWeather.weather[0]?.main.toLowerCase() || 'unknown';
    const currCondition = currentWeather.weather[0]?.main.toLowerCase() || 'unknown';
    
    const conditionChanged = prevCondition !== currCondition;
    const precipitationChange = this.detectPrecipitationChange(prevCondition, currCondition);
    const extremeWeather = this.isExtremeWeather(currentWeather);

    console.log(`🌤️ Weather change analysis:`, {
      tempDelta: `${tempDelta.toFixed(1)}°C`,
      conditionChanged,
      previousCondition: prevCondition,
      currentCondition: currCondition,
      precipitationChange,
      extremeWeather
    });

    return {
      temperatureDelta: tempDelta,
      previousCondition: prevCondition,
      currentCondition: currCondition,
      conditionChanged,
      precipitationChange,
      extremeWeatherDetected: extremeWeather
    };
  }

  /**
   * Check if weather condition is extreme
   */
  private isExtremeWeather(weather: WeatherData): boolean {
    const condition = weather.weather[0]?.main.toLowerCase() || '';
    return ['thunderstorm', 'tornado', 'squall', 'hurricane'].includes(condition);
  }

  /**
   * Detect precipitation state changes
   */
  private detectPrecipitationChange(prev: string, curr: string): boolean {
    const wetConditions = ['rain', 'drizzle', 'thunderstorm', 'snow'];
    const wasDry = !wetConditions.includes(prev);
    const isWet = wetConditions.includes(curr);
    return wasDry !== isWet;
  }

  // ==========================================================================
  // TRAFFIC CHANGE DETECTION
  // ==========================================================================

  /**
   * Detect significant traffic changes across activity locations
   */
  private async detectTrafficChange(
    itinerary: SavedItinerary,
    activityCoordinates: Array<{ lat: number; lon: number }>
  ): Promise<TrafficChangeDetails | null> {
    console.log(`🚗 Analyzing traffic for ${activityCoordinates.length} locations`);

    try {
      // Fetch current traffic data for all locations
      const trafficDataPromises = activityCoordinates.map(coord =>
        tomtomTrafficService.getLocationTrafficData(coord.lat, coord.lon)
      );

      const trafficDataResults = await Promise.allSettled(trafficDataPromises);
      
      const validTrafficData: LocationTrafficData[] = trafficDataResults
        .filter((result): result is PromiseFulfilledResult<LocationTrafficData> => 
          result.status === 'fulfilled'
        )
        .map(result => result.value);

      if (validTrafficData.length === 0) {
        console.log('⚠️ No valid traffic data available');
        return null;
      }

      // Calculate current traffic metrics
      const avgCongestion = validTrafficData.reduce((sum, data) => 
        sum + data.congestionScore, 0
      ) / validTrafficData.length;

      const totalIncidents = validTrafficData.reduce((sum, data) => 
        sum + data.incidents.length, 0
      );

      const criticalIncidents = validTrafficData.reduce((sum, data) => 
        sum + data.incidents.filter(i => i.magnitudeOfDelay >= 4).length, 0
      );

      // Determine average traffic level
      const trafficLevels = validTrafficData.map(d => d.trafficLevel);
      const avgTrafficLevel = this.calculateAverageTrafficLevel(trafficLevels);

      // Compare with previous snapshot if available
      const previousSnapshot = this.extractTrafficSnapshot(itinerary);
      
      if (!previousSnapshot) {
        console.log('⚠️ No previous traffic snapshot - creating baseline');
        return {
          congestionDelta: 0,
          previousLevel: 'UNKNOWN',
          currentLevel: avgTrafficLevel,
          levelChanged: false,
          newIncidents: totalIncidents,
          criticalIncidents
        };
      }

      const congestionDelta = avgCongestion - previousSnapshot.averageCongestionScore;
      const levelChanged = avgTrafficLevel !== previousSnapshot.averageTrafficLevel;
      const newIncidents = Math.max(0, totalIncidents - previousSnapshot.incidentCount);

      console.log(`🚦 Traffic change analysis:`, {
        congestionDelta: `${congestionDelta.toFixed(1)}%`,
        previousLevel: previousSnapshot.averageTrafficLevel,
        currentLevel: avgTrafficLevel,
        levelChanged,
        newIncidents,
        criticalIncidents
      });

      return {
        congestionDelta,
        previousLevel: previousSnapshot.averageTrafficLevel,
        currentLevel: avgTrafficLevel,
        levelChanged,
        newIncidents,
        criticalIncidents
      };

    } catch (error) {
      console.error('❌ Error detecting traffic change:', error);
      return null;
    }
  }

  /**
   * Calculate average traffic level from multiple samples
   */
  private calculateAverageTrafficLevel(
    levels: Array<'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE'>
  ): 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' {
    const levelScores = {
      'VERY_LOW': 1,
      'LOW': 2,
      'MODERATE': 3,
      'HIGH': 4,
      'SEVERE': 5
    };

    const avgScore = levels.reduce((sum, level) => 
      sum + levelScores[level], 0
    ) / levels.length;

    if (avgScore >= 4.5) return 'SEVERE';
    if (avgScore >= 3.5) return 'HIGH';
    if (avgScore >= 2.5) return 'MODERATE';
    if (avgScore >= 1.5) return 'LOW';
    return 'VERY_LOW';
  }

  /**
   * Extract traffic snapshot from saved itinerary metadata
   */
  private extractTrafficSnapshot(itinerary: SavedItinerary): TrafficSnapshot | null {
    // Check if itinerary has traffic snapshot in metadata
    // This will be stored when itinerary is first created/refreshed
    const metadata = (itinerary as any).refreshMetadata as RefreshMetadata | undefined;
    return metadata?.trafficSnapshot || null;
  }

  // ==========================================================================
  // DECISION LOGIC
  // ==========================================================================

  /**
   * Determine if refresh should be triggered
   */
  private shouldRefresh(
    weatherChange: WeatherChangeDetails | null,
    trafficChange: TrafficChangeDetails | null
  ): boolean {
    // Extreme weather always triggers refresh
    if (weatherChange?.extremeWeatherDetected) {
      console.log('🚨 CRITICAL: Extreme weather detected - refresh required');
      return true;
    }

    // Significant temperature change
    if (weatherChange && weatherChange.temperatureDelta > this.config.temperatureThreshold) {
      console.log(`🌡️ Temperature changed by ${weatherChange.temperatureDelta}°C - refresh required`);
      return true;
    }

    // Precipitation state change
    if (weatherChange?.precipitationChange) {
      console.log('🌧️ Precipitation state changed - refresh required');
      return true;
    }

    // Critical traffic incidents
    if (trafficChange && trafficChange.criticalIncidents > 0) {
      console.log(`🚨 ${trafficChange.criticalIncidents} critical traffic incidents - refresh required`);
      return true;
    }

    // Significant congestion increase
    if (trafficChange && trafficChange.congestionDelta > this.config.congestionThreshold) {
      console.log(`🚗 Congestion increased by ${trafficChange.congestionDelta}% - refresh required`);
      return true;
    }

    // Traffic level degradation beyond threshold
    if (trafficChange?.levelChanged) {
      const currentLevel = trafficChange.currentLevel;
      const thresholdMet = this.isTrafficLevelAboveThreshold(currentLevel);
      
      if (thresholdMet) {
        console.log(`🚦 Traffic level changed to ${currentLevel} - refresh required`);
        return true;
      }
    }

    console.log('✅ No significant changes detected - refresh not needed');
    return false;
  }

  /**
   * Check if traffic level exceeds configured threshold
   */
  private isTrafficLevelAboveThreshold(level: string): boolean {
    const levelOrder = ['VERY_LOW', 'LOW', 'MODERATE', 'HIGH', 'SEVERE'];
    const currentIndex = levelOrder.indexOf(level);
    const thresholdIndex = levelOrder.indexOf(this.config.trafficLevelThreshold);
    return currentIndex > thresholdIndex;
  }

  /**
   * Collect all applicable refresh reasons
   */
  private collectRefreshReasons(
    weatherChange: WeatherChangeDetails | null,
    trafficChange: TrafficChangeDetails | null
  ): RefreshReason[] {
    const reasons: RefreshReason[] = [];

    if (weatherChange) {
      if (weatherChange.extremeWeatherDetected || 
          weatherChange.temperatureDelta > this.config.temperatureThreshold ||
          weatherChange.precipitationChange) {
        reasons.push('WEATHER_SIGNIFICANT_CHANGE');
      }
    }

    if (trafficChange) {
      if (trafficChange.criticalIncidents > 0) {
        reasons.push('INCIDENT_DETECTED');
      }
      if (trafficChange.congestionDelta > this.config.congestionThreshold ||
          trafficChange.levelChanged) {
        reasons.push('TRAFFIC_DEGRADATION');
      }
    }

    if (reasons.includes('WEATHER_SIGNIFICANT_CHANGE') && 
        (reasons.includes('TRAFFIC_DEGRADATION') || reasons.includes('INCIDENT_DETECTED'))) {
      reasons.push('WEATHER_AND_TRAFFIC');
    }

    return reasons;
  }

  /**
   * Calculate severity of changes
   */
  private calculateSeverity(
    weatherChange: WeatherChangeDetails | null,
    trafficChange: TrafficChangeDetails | null
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    let score = 0;

    // Weather severity scoring
    if (weatherChange) {
      if (weatherChange.extremeWeatherDetected) score += 40;
      if (weatherChange.precipitationChange) score += 20;
      if (weatherChange.temperatureDelta > this.config.temperatureThreshold * 2) score += 20;
      else if (weatherChange.temperatureDelta > this.config.temperatureThreshold) score += 10;
    }

    // Traffic severity scoring
    if (trafficChange) {
      if (trafficChange.criticalIncidents > 0) score += 30;
      if (trafficChange.congestionDelta > this.config.congestionThreshold * 2) score += 20;
      else if (trafficChange.congestionDelta > this.config.congestionThreshold) score += 10;
      if (trafficChange.currentLevel === 'SEVERE') score += 20;
      else if (trafficChange.currentLevel === 'HIGH') score += 10;
    }

    if (score >= 60) return 'CRITICAL';
    if (score >= 40) return 'HIGH';
    if (score >= 20) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Calculate confidence in the evaluation
   */
  private calculateConfidence(
    weatherChange: WeatherChangeDetails | null,
    trafficChange: TrafficChangeDetails | null
  ): number {
    let confidence = 50; // Base confidence

    // Increase confidence with more data
    if (weatherChange) confidence += 25;
    if (trafficChange) confidence += 25;

    // Reduce confidence for edge cases
    if (weatherChange && weatherChange.temperatureDelta < 2) confidence -= 10;
    if (trafficChange && Math.abs(trafficChange.congestionDelta) < 10) confidence -= 10;

    return Math.min(100, Math.max(0, confidence));
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Create traffic snapshot from current data
   */
  async createTrafficSnapshot(
    activityCoordinates: Array<{ lat: number; lon: number }>
  ): Promise<TrafficSnapshot> {
    const trafficDataPromises = activityCoordinates.map(coord =>
      tomtomTrafficService.getLocationTrafficData(coord.lat, coord.lon)
    );

    const trafficDataResults = await Promise.allSettled(trafficDataPromises);
    
    const validTrafficData: LocationTrafficData[] = trafficDataResults
      .filter((result): result is PromiseFulfilledResult<LocationTrafficData> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);

    const avgCongestion = validTrafficData.reduce((sum, data) => 
      sum + data.congestionScore, 0
    ) / (validTrafficData.length || 1);

    const totalIncidents = validTrafficData.reduce((sum, data) => 
      sum + data.incidents.length, 0
    );

    const trafficLevels = validTrafficData.map(d => d.trafficLevel);
    const avgTrafficLevel = this.calculateAverageTrafficLevel(trafficLevels);

    return {
      averageCongestionScore: avgCongestion,
      averageTrafficLevel: avgTrafficLevel,
      incidentCount: totalIncidents,
      timestamp: new Date(),
      locationSamples: validTrafficData.map(data => ({
        lat: data.lat,
        lon: data.lon,
        trafficLevel: data.trafficLevel,
        congestionScore: data.congestionScore
      }))
    };
  }

  /**
   * Get human-readable summary of changes
   */
  getChangeSummary(result: ChangeDetectionResult): string {
    if (!result.needsRefresh) {
      return 'No significant changes detected. Your itinerary is still optimal.';
    }

    const parts: string[] = [];

    if (result.weatherChange) {
      const { temperatureDelta, conditionChanged, currentCondition, extremeWeatherDetected } = result.weatherChange;
      
      if (extremeWeatherDetected) {
        parts.push(`⚠️ Extreme weather alert: ${currentCondition}`);
      } else if (conditionChanged) {
        parts.push(`Weather changed to ${currentCondition}`);
      }
      
      if (temperatureDelta > 5) {
        parts.push(`Temperature changed by ${temperatureDelta.toFixed(1)}°C`);
      }
    }

    if (result.trafficChange) {
      const { criticalIncidents, congestionDelta, currentLevel } = result.trafficChange;
      
      if (criticalIncidents > 0) {
        parts.push(`🚨 ${criticalIncidents} critical traffic incident${criticalIncidents > 1 ? 's' : ''} detected`);
      }
      
      if (congestionDelta > 30) {
        parts.push(`Traffic congestion increased by ${congestionDelta.toFixed(0)}%`);
      }
      
      if (currentLevel === 'HIGH' || currentLevel === 'SEVERE') {
        parts.push(`Current traffic level: ${currentLevel}`);
      }
    }

    return parts.join(' • ');
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    let cleared = 0;
    
    for (const [key, _] of this.evaluationCache.entries()) {
      // Simple time-based expiry (could be enhanced with metadata)
      cleared++;
      this.evaluationCache.delete(key);
    }
    
    if (cleared > 0) {
      console.log(`🧹 Cleared ${cleared} expired evaluation cache entries`);
    }
  }
}

// Export singleton instance
export const itineraryRefreshService = new ItineraryRefreshService();

// Export for testing with custom config
export { ItineraryRefreshService };
