/**
 * TomTom Traffic API Integration
 * Provides real-time traffic data for Baguio City activities
 */

export interface TrafficIncident {
  id: string;
  iconCategory: number;
  magnitudeOfDelay: number;
  events: Array<{
    description: string;
    code: number;
    iconCategory: number;
  }>;
  startTime: string;
  endTime: string;
  from: string;
  to: string;
  length: number;
  delay: number;
  roadNumbers: string[];
  timeValidity: string;
}

export interface LocationTrafficData {
  lat: number;
  lon: number;
  incidents: TrafficIncident[];
  trafficLevel: 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
  congestionScore: number; // 0-100 (0 = no congestion, 100 = severe congestion)
  recommendationScore: number; // 0-100 (0 = avoid, 100 = perfect time to visit)
  lastUpdated: Date;
}

interface TomTomConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
}

class TomTomTrafficService {
  private config: TomTomConfig;
  private cache: Map<string, { data: LocationTrafficData; expiry: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

  constructor() {
    this.config = {
      apiKey: process.env.TOMTOM_API_KEY || '',
      baseUrl: 'https://api.tomtom.com',
      timeout: 10000
    };

    if (!this.config.apiKey) {
      console.warn('⚠️ TomTom API key not found. Traffic features will use fallback data.');
    }
  }

  /**
   * Get comprehensive traffic data for a location
   */
  async getLocationTrafficData(lat: number, lon: number): Promise<LocationTrafficData> {
    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() < cached.expiry) {
      console.log(`📋 TomTom: Using cached traffic data for ${lat}, ${lon}`);
      return cached.data;
    }

    console.log(`🔍 TomTom: Fetching fresh traffic data for coordinates ${lat}, ${lon}`);
    
    try {
      // Always try to get flow data (primary), incidents are secondary
      const flowData = await this.getTrafficFlow(lat, lon);
      
      // Try to get incidents but don't fail if unavailable
      let incidents: TrafficIncident[] = [];
      try {
        incidents = await this.getTrafficIncidents(lat, lon, 1000);
      } catch (incidentError) {
        console.log(`⚠️ TomTom: Incidents unavailable, using flow data only`);
      }

      const congestionScore = this.calculateCongestionScore(flowData, incidents);
      const trafficLevel = this.getTrafficLevel(congestionScore, incidents);
      const recommendationScore = this.calculateRecommendationScore(congestionScore, trafficLevel, incidents);

      const result: LocationTrafficData = {
        lat,
        lon,
        incidents,
        trafficLevel,
        congestionScore,
        recommendationScore,
        lastUpdated: new Date()
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        expiry: Date.now() + this.CACHE_DURATION
      });

      console.log(`🎯 TomTom: Traffic analysis complete: {
        congestionScore: ${congestionScore},
        trafficLevel: '${trafficLevel}',
        recommendationScore: ${recommendationScore},
        incidentCount: ${incidents.length}
      }`);

      return result;
    } catch (error) {
      console.log(`⚠️ TomTom: Traffic API failed, using fallback data for ${lat}, ${lon}:`, error instanceof Error ? error.message : 'Unknown error');
      return this.createFallbackTrafficData(lat, lon);
    }
  }

  /**
   * Get traffic flow data from TomTom Flow API
   */
  private async getTrafficFlow(lat: number, lon: number): Promise<any> {
    if (!this.config.apiKey) {
      console.log(`⚠️ TomTom: No API key, skipping flow data for ${lat}, ${lon}`);
      return null;
    }

    const url = `${this.config.baseUrl}/traffic/services/4/flowSegmentData/absolute/10/json`;
    const params = new URLSearchParams({
      point: `${lat},${lon}`,
      unit: 'KMPH',
      thickness: '10',
      key: this.config.apiKey
    });

    console.log(`🌐 TomTom: Requesting flow data: ${url}?${params.toString()}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(`${url}?${params.toString()}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Tarana.ai/1.0'
        }
      });

      clearTimeout(timeoutId);

      console.log(`📡 TomTom: Flow API response status: ${response.status}`);

      if (!response.ok) {
        throw new Error(`TomTom Flow API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ TomTom: Flow data received successfully`);
      
      return data.flowSegmentData || null;

    } catch (error) {
      console.error(`❌ TomTom: Flow API request failed:`, error);
      return null;
    }
  }

  /**
   * Get traffic incidents from TomTom Incidents API with corrected parameters
   */
  private async getTrafficIncidents(lat: number, lon: number, radiusMeters: number): Promise<TrafficIncident[]> {
    if (!this.config.apiKey) {
      console.log(`⚠️ TomTom: No API key, skipping incidents for ${lat}, ${lon}`);
      return [];
    }

    try {
      // Use correct TomTom Incidents API v5 endpoint with proper parameters
      const url = `${this.config.baseUrl}/traffic/services/5/incidentDetails`;
      
      // Create bounding box (smaller area for better API response)
      const offset = 0.005; // ~500m radius
      const bbox = `${lon - offset},${lat - offset},${lon + offset},${lat + offset}`;
      
      const params = new URLSearchParams({
        bbox: bbox,
        fields: '{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code,iconCategory},startTime,endTime,from,to,length,delay,roadNumbers,timeValidity}}}',
        language: 'en-US',
        key: this.config.apiKey
      });

      console.log(`🌐 TomTom: Requesting incidents data: ${url}?${params.toString()}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(`${url}?${params.toString()}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Tarana.ai/1.0'
        }
      });

      clearTimeout(timeoutId);

      console.log(`📡 TomTom: Incidents API response status: ${response.status}`);

      if (!response.ok) {
        // Try alternative simpler request format
        return await this.getTrafficIncidentsSimple(lat, lon);
      }

      const data = await response.json();
      const incidents = data.incidents || [];
      
      console.log(`✅ TomTom: Incidents data received - ${incidents.length} incidents found`);

      return incidents.map((incident: any) => ({
        id: incident.properties?.id || `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        iconCategory: incident.properties?.iconCategory || 0,
        magnitudeOfDelay: incident.properties?.magnitudeOfDelay || 0,
        events: incident.properties?.events || [],
        startTime: incident.properties?.startTime || '',
        endTime: incident.properties?.endTime || '',
        from: incident.properties?.from || '',
        to: incident.properties?.to || '',
        length: incident.properties?.length || 0,
        delay: incident.properties?.delay || 0,
        roadNumbers: incident.properties?.roadNumbers || [],
        timeValidity: incident.properties?.timeValidity || ''
      }));

    } catch (error) {
      // Graceful degradation - log warning but don't fail the entire traffic analysis
      console.log(`⚠️ TomTom: Incidents API failed, continuing with flow data only:`, error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Fallback method with simplified incidents API request
   */
  private async getTrafficIncidentsSimple(lat: number, lon: number): Promise<TrafficIncident[]> {
    try {
      // Use minimal parameters for incidents API
      const url = `${this.config.baseUrl}/traffic/services/5/incidentDetails`;
      const offset = 0.01;
      const bbox = `${lon - offset},${lat - offset},${lon + offset},${lat + offset}`;
      
      const params = new URLSearchParams({
        bbox: bbox,
        key: this.config.apiKey
      });

      console.log(`🌐 TomTom: Trying simplified incidents request: ${url}?${params.toString()}`);

      const response = await fetch(`${url}?${params.toString()}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Tarana.ai/1.0'
        }
      });

      console.log(`📡 TomTom: Simple incidents API response status: ${response.status}`);

      if (!response.ok) {
        console.log(`⚠️ TomTom: Simple incidents API also failed (${response.status}), using flow data only`);
        return [];
      }

      const data = await response.json();
      const incidents = data.incidents || [];
      
      console.log(`✅ TomTom: Simple incidents data received - ${incidents.length} incidents found`);

      return incidents.map((incident: any, index: number) => ({
        id: incident.properties?.id || `simple_incident_${index}`,
        iconCategory: incident.properties?.iconCategory || 0,
        magnitudeOfDelay: incident.properties?.magnitudeOfDelay || 1,
        events: incident.properties?.events || [{ description: 'Traffic incident', code: 0, iconCategory: 0 }],
        startTime: incident.properties?.startTime || '',
        endTime: incident.properties?.endTime || '',
        from: incident.properties?.from || '',
        to: incident.properties?.to || '',
        length: incident.properties?.length || 0,
        delay: incident.properties?.delay || 0,
        roadNumbers: incident.properties?.roadNumbers || [],
        timeValidity: incident.properties?.timeValidity || ''
      }));

    } catch (error) {
      console.log(`⚠️ TomTom: Simple incidents API also failed:`, error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Calculate congestion score based on flow data and incidents
   */
  private calculateCongestionScore(flowData: any, incidents: TrafficIncident[]): number {
    let score = 0;

    // Base score from traffic flow (if available)
    if (flowData && flowData.currentSpeed && flowData.freeFlowSpeed) {
      const speedRatio = flowData.currentSpeed / flowData.freeFlowSpeed;
      score = Math.max(0, (1 - speedRatio) * 100);
      console.log(`🚗 TomTom: Speed-based congestion score: ${score.toFixed(1)} (${flowData.currentSpeed}/${flowData.freeFlowSpeed} km/h)`);
    } else {
      score = 30; // Default moderate congestion when no flow data
      console.log(`🚗 TomTom: Using default congestion score: ${score} (no flow data)`);
    }

    // Adjust score based on incidents
    incidents.forEach(incident => {
      const incidentImpact = Math.min(incident.magnitudeOfDelay * 10, 30);
      score += incidentImpact;
      console.log(`🚧 TomTom: Incident impact +${incidentImpact} (magnitude: ${incident.magnitudeOfDelay})`);
    });

    const finalScore = Math.min(100, Math.max(0, Math.round(score)));
    console.log(`📊 TomTom: Final congestion score: ${finalScore}/100`);
    
    return finalScore;
  }

  /**
   * Determine traffic level based on congestion score and incidents
   */
  private getTrafficLevel(congestionScore: number, incidents: TrafficIncident[]): 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' {
    // Check for severe incidents first
    const severeIncidents = incidents.filter(i => i.magnitudeOfDelay >= 4);
    if (severeIncidents.length > 0) {
      console.log(`🚨 TomTom: SEVERE traffic level due to ${severeIncidents.length} major incidents`);
      return 'SEVERE';
    }

    // Determine level based on congestion score
    if (congestionScore >= 80) {
      console.log(`🔴 TomTom: HIGH traffic level (score: ${congestionScore})`);
      return 'HIGH';
    } else if (congestionScore >= 50) {
      console.log(`🟡 TomTom: MODERATE traffic level (score: ${congestionScore})`);
      return 'MODERATE';
    } else if (congestionScore >= 20) {
      console.log(`🟢 TomTom: LOW traffic level (score: ${congestionScore})`);
      return 'LOW';
    } else {
      console.log(`🔵 TomTom: VERY LOW traffic level (score: ${congestionScore})`);
      return 'VERY_LOW';
    }
  }

  /**
   * Calculate recommendation score (higher = better time to visit)
   */
  private calculateRecommendationScore(
    congestionScore: number, 
    trafficLevel: 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE',
    incidents: TrafficIncident[]
  ): number {
    let score = 100 - congestionScore; // Inverse of congestion

    // Penalty for incidents
    incidents.forEach(incident => {
      score -= Math.min(incident.magnitudeOfDelay * 5, 20);
    });

    // Traffic level adjustments
    switch (trafficLevel) {
      case 'SEVERE':
        score -= 30;
        break;
      case 'HIGH':
        score -= 20;
        break;
      case 'MODERATE':
        score -= 10;
        break;
      case 'VERY_LOW':
        score += 20;
        break;
      case 'LOW':
        score += 10;
        break;
    }

    const finalScore = Math.min(100, Math.max(0, Math.round(score)));
    console.log(`🎯 TomTom: Recommendation score: ${finalScore}/100`);
    
    return finalScore;
  }

  /**
   * Create fallback traffic data when API is unavailable
   */
  private createFallbackTrafficData(lat: number, lon: number): LocationTrafficData {
    console.log(`🔄 TomTom: Creating fallback traffic data for ${lat}, ${lon}`);
    
    return {
      lat,
      lon,
      incidents: [],
      trafficLevel: 'LOW',
      congestionScore: 25,
      recommendationScore: 75,
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
      console.log(`🧹 TomTom: Cleared ${cleared} expired cache entries`);
    }
  }
}

// Export singleton instance
export const tomtomTrafficService = new TomTomTrafficService();

/**
 * Get traffic summary text for display
 */
export function getTrafficSummary(trafficData: LocationTrafficData): string {
  const { trafficLevel, congestionScore, incidents } = trafficData;
  
  const levelEmojis = {
    VERY_LOW: '🔵',
    LOW: '🟢',
    MODERATE: '🟡', 
    HIGH: '🔴',
    SEVERE: '🚨'
  };
  
  let summary = `${levelEmojis[trafficLevel]} ${trafficLevel.toLowerCase()} traffic (${congestionScore}% congestion)`;
  
  if (incidents.length > 0) {
    summary += ` • ${incidents.length} incident${incidents.length > 1 ? 's' : ''}`;
  }
  
  return summary;
}

/**
 * Get traffic-based time recommendation
 */
export function getTrafficTimeRecommendation(trafficData: LocationTrafficData): string {
  const { recommendationScore, trafficLevel } = trafficData;
  
  if (recommendationScore >= 80) {
    return "Perfect time to visit! 🎯";
  } else if (recommendationScore >= 60) {
    return "Good time to visit 👍";
  } else if (recommendationScore >= 40) {
    return "Consider visiting later ⏰";
  } else {
    return "Avoid visiting now - heavy traffic 🚫";
  }
}
