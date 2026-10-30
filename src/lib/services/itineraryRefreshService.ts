
import { WeatherData } from '../core/utils';
import { tomtomTrafficService, LocationTrafficData } from '../traffic/tomtomTraffic';
import { SavedItinerary } from '../data/savedItineraries';
import { logger } from '@/lib/observability/logger';
import { getSafeErrorMetadata } from '@/lib/observability/safeErrorMetadata';


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
  confidence: number; 
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
  temperatureThreshold: number; 
  congestionThreshold: number; 
  enableAutoRefresh: boolean;
  evaluationIntervalHours: number;
  maxRefreshesPerDay: number;
  weatherConditionPriority: string[];
  trafficLevelThreshold: 'LOW' | 'MODERATE' | 'HIGH';
}


const DEFAULT_CONFIG: RefreshConfiguration = {
  temperatureThreshold: 5, 
  congestionThreshold: 30, 
  enableAutoRefresh: false, 
  evaluationIntervalHours: 6, 
  maxRefreshesPerDay: 4, 
  weatherConditionPriority: [
    'thunderstorm',
    'tornado',
    'squall',
    'rain',
    'drizzle',
    'snow',
    'clear'
  ],
  trafficLevelThreshold: 'MODERATE' 
};
const LOG_ENTRY_POINT = 'itineraryRefreshService';



class ItineraryRefreshService {
  private config: RefreshConfiguration;
  private evaluationCache: Map<string, ChangeDetectionResult> = new Map();
  private readonly CACHE_DURATION = 15 * 60 * 1000; 

  constructor(config: Partial<RefreshConfiguration> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('Itinerary refresh service initialized', {
      entryPoint: LOG_ENTRY_POINT,
      temperatureThreshold: this.config.temperatureThreshold,
      congestionThreshold: this.config.congestionThreshold,
      enableAutoRefresh: this.config.enableAutoRefresh,
      evaluationIntervalHours: this.config.evaluationIntervalHours,
      maxRefreshesPerDay: this.config.maxRefreshesPerDay,
      trafficLevelThreshold: this.config.trafficLevelThreshold,
    });
  }


  async evaluateRefreshNeed(
    itinerary: SavedItinerary,
    currentWeather: WeatherData,
    activityCoordinates: Array<{ lat: number; lon: number }>
  ): Promise<ChangeDetectionResult> {
    logger.info('Evaluating itinerary refresh need', {
      entryPoint: LOG_ENTRY_POINT,
      activityCount: activityCoordinates.length,
    });

    const cacheKey = `${itinerary.id}_${Date.now()}`;
    
    try {
      const weatherChange = this.detectWeatherChange(
        itinerary.weatherData || null,
        currentWeather
      );

      const trafficChange = await this.detectTrafficChange(
        itinerary,
        activityCoordinates
      );

      const needsRefresh = this.shouldRefresh(weatherChange, trafficChange);
      
      const reasons = this.collectRefreshReasons(weatherChange, trafficChange);
      
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

      logger.info('Itinerary refresh evaluation complete', {
        entryPoint: LOG_ENTRY_POINT,
        needsRefresh,
        reasons,
        severity,
        confidence,
      });

      this.evaluationCache.set(cacheKey, result);
      
      return result;

    } catch (error) {
      logger.error('Itinerary refresh evaluation failed', {
        entryPoint: LOG_ENTRY_POINT,
        ...getSafeErrorMetadata(error),
      });
      
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


  private detectWeatherChange(
    previousWeather: WeatherData | null,
    currentWeather: WeatherData
  ): WeatherChangeDetails | null {
    if (!previousWeather || !previousWeather.main) {
      logger.info('No previous weather data; reporting current condition without change', { entryPoint: LOG_ENTRY_POINT });
      return {
        temperatureDelta: 0,
        previousCondition: currentWeather.weather[0]?.main.toLowerCase() || 'unknown',
        currentCondition: currentWeather.weather[0]?.main.toLowerCase() || 'unknown',
        conditionChanged: false,
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

    logger.info('Weather change analysis completed', {
      entryPoint: LOG_ENTRY_POINT,
      temperatureDeltaCelsius: Number(tempDelta.toFixed(1)),
      conditionChanged,
      precipitationChange,
      extremeWeatherDetected: extremeWeather,
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

  private isExtremeWeather(weather: WeatherData): boolean {
    const condition = weather.weather[0]?.main.toLowerCase() || '';
    return ['thunderstorm', 'tornado', 'squall', 'hurricane'].includes(condition);
  }

  private detectPrecipitationChange(prev: string, curr: string): boolean {
    if (!prev || prev === 'unknown' || !curr || curr === 'unknown') return false;
    const wetConditions = ['rain', 'drizzle', 'thunderstorm', 'snow'];
    const wasWet = wetConditions.includes(prev);
    const isWet = wetConditions.includes(curr);
    return wasWet !== isWet;
  }


  private async detectTrafficChange(
    itinerary: SavedItinerary,
    activityCoordinates: Array<{ lat: number; lon: number }>
  ): Promise<TrafficChangeDetails | null> {
    logger.info('Analyzing itinerary traffic', {
      entryPoint: LOG_ENTRY_POINT,
      locationCount: activityCoordinates.length,
    });

    try {
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
        logger.info('No valid traffic data available', { entryPoint: LOG_ENTRY_POINT });
        return null;
      }

      const avgCongestion = validTrafficData.reduce((sum, data) => 
        sum + data.congestionScore, 0
      ) / validTrafficData.length;

      const totalIncidents = validTrafficData.reduce((sum, data) => 
        sum + data.incidents.length, 0
      );

      const criticalIncidents = validTrafficData.reduce((sum, data) => 
        sum + data.incidents.filter(i => i.magnitudeOfDelay >= 4).length, 0
      );

      const trafficLevels = validTrafficData.map(d => d.trafficLevel);
      const avgTrafficLevel = this.calculateAverageTrafficLevel(trafficLevels);

      const previousSnapshot = this.extractTrafficSnapshot(itinerary);
      
      if (!previousSnapshot) {
        logger.info('No previous traffic snapshot; creating baseline', { entryPoint: LOG_ENTRY_POINT });
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

      logger.info('Traffic change analysis completed', {
        entryPoint: LOG_ENTRY_POINT,
        congestionDelta: Number(congestionDelta.toFixed(1)),
        previousLevel: previousSnapshot.averageTrafficLevel,
        currentLevel: avgTrafficLevel,
        levelChanged,
        newIncidentCount: newIncidents,
        criticalIncidentCount: criticalIncidents,
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
      logger.error('Error detecting traffic change', {
        entryPoint: LOG_ENTRY_POINT,
        locationCount: activityCoordinates.length,
        ...getSafeErrorMetadata(error),
      });
      return null;
    }
  }

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

  private extractTrafficSnapshot(itinerary: SavedItinerary): TrafficSnapshot | null {
    const metadata = (itinerary as any).refreshMetadata as RefreshMetadata | undefined;
    return metadata?.trafficSnapshot || null;
  }


  private shouldRefresh(
    weatherChange: WeatherChangeDetails | null,
    trafficChange: TrafficChangeDetails | null
  ): boolean {
    if (weatherChange?.extremeWeatherDetected) {
      logger.info('Extreme weather detected; refresh required', { entryPoint: LOG_ENTRY_POINT });
      return true;
    }

    if (weatherChange && weatherChange.temperatureDelta > this.config.temperatureThreshold) {
      logger.info('Weather temperature change requires refresh', {
        entryPoint: LOG_ENTRY_POINT,
        temperatureDeltaCelsius: weatherChange.temperatureDelta,
        temperatureThresholdCelsius: this.config.temperatureThreshold,
      });
      return true;
    }

    if (weatherChange?.precipitationChange) {
      logger.info('Precipitation state changed; refresh required', { entryPoint: LOG_ENTRY_POINT });
      return true;
    }

    if (trafficChange && trafficChange.criticalIncidents > 0) {
      logger.info('Critical traffic incidents require refresh', {
        entryPoint: LOG_ENTRY_POINT,
        criticalIncidentCount: trafficChange.criticalIncidents,
      });
      return true;
    }

    if (trafficChange && trafficChange.congestionDelta > this.config.congestionThreshold) {
      logger.info('Traffic congestion increase requires refresh', {
        entryPoint: LOG_ENTRY_POINT,
        congestionDelta: trafficChange.congestionDelta,
        congestionThreshold: this.config.congestionThreshold,
      });
      return true;
    }

    if (trafficChange?.levelChanged) {
      const currentLevel = trafficChange.currentLevel;
      const thresholdMet = this.isTrafficLevelAboveThreshold(currentLevel);
      
      if (thresholdMet) {
        logger.info('Traffic level change requires refresh', {
          entryPoint: LOG_ENTRY_POINT,
          currentLevel,
        });
        return true;
      }
    }

    logger.info('No significant changes detected; refresh not needed', { entryPoint: LOG_ENTRY_POINT });
    return false;
  }

  private isTrafficLevelAboveThreshold(level: string): boolean {
    const levelOrder = ['VERY_LOW', 'LOW', 'MODERATE', 'HIGH', 'SEVERE'];
    const currentIndex = levelOrder.indexOf(level);
    const thresholdIndex = levelOrder.indexOf(this.config.trafficLevelThreshold);
    return currentIndex > thresholdIndex;
  }

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

  private calculateSeverity(
    weatherChange: WeatherChangeDetails | null,
    trafficChange: TrafficChangeDetails | null
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    let score = 0;

    if (weatherChange) {
      if (weatherChange.extremeWeatherDetected) score += 40;
      if (weatherChange.precipitationChange) score += 20;
      if (weatherChange.temperatureDelta > this.config.temperatureThreshold * 2) score += 20;
      else if (weatherChange.temperatureDelta > this.config.temperatureThreshold) score += 10;
    }

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

  private calculateConfidence(
    weatherChange: WeatherChangeDetails | null,
    trafficChange: TrafficChangeDetails | null
  ): number {
    let confidence = 50; 

    if (weatherChange) confidence += 25;
    if (trafficChange) confidence += 25;

    if (weatherChange && weatherChange.temperatureDelta < 2) confidence -= 10;
    if (trafficChange && Math.abs(trafficChange.congestionDelta) < 10) confidence -= 10;

    return Math.min(100, Math.max(0, confidence));
  }


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

  clearExpiredCache(): void {
    const now = Date.now();
    let cleared = 0;
    
    for (const [key, _] of this.evaluationCache.entries()) {
      cleared++;
      this.evaluationCache.delete(key);
    }
    
    if (cleared > 0) {
      logger.info('Expired itinerary evaluation cache entries cleared', {
        entryPoint: LOG_ENTRY_POINT,
        clearedCount: cleared,
      });
    }
  }
}

export const itineraryRefreshService = new ItineraryRefreshService();

export { ItineraryRefreshService };
