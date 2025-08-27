/**
 * TomTom Traffic API Integration
 * Real-time traffic data service for intelligent itinerary generation
 */

export interface TrafficFlowData {
  currentSpeed: number;
  freeFlowSpeed: number;
  currentTravelTime: number;
  freeFlowTravelTime: number;
  confidence: number;
  roadClosure: boolean;
}

export interface TrafficIncidentData {
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
  flowData?: TrafficFlowData;
  incidents: TrafficIncidentData[];
  trafficLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
  congestionScore: number; // 0-100 scale
  recommendationScore: number; // 0-100 scale (higher = better to visit now)
  lastUpdated: Date;
}

export interface TomTomConfig {
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
  }

  /**
   * Get real-time traffic data for a specific location
   */
  async getLocationTrafficData(lat: number, lon: number, radius: number = 1000): Promise<LocationTrafficData> {
    const cacheKey = `${lat.toFixed(4)}_${lon.toFixed(4)}_${radius}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }

    try {
      // Use Promise.allSettled for better error handling
      const [flowResult, incidentsResult] = await Promise.allSettled([
        this.getTrafficFlow(lat, lon),
        this.getTrafficIncidents(lat, lon, radius)
      ]);

      const flowData = flowResult.status === 'fulfilled' ? flowResult.value : undefined;
      const incidentsData = incidentsResult.status === 'fulfilled' ? incidentsResult.value : [];

      // Log any failures for debugging
      if (flowResult.status === 'rejected') {
        console.warn('Traffic flow data failed:', flowResult.reason);
      }
      if (incidentsResult.status === 'rejected') {
        console.warn('Traffic incidents data failed:', incidentsResult.reason);
      }

      const trafficData: LocationTrafficData = {
        lat,
        lon,
        flowData,
        incidents: incidentsData,
        trafficLevel: this.calculateTrafficLevel(flowData, incidentsData),
        congestionScore: this.calculateCongestionScore(flowData, incidentsData),
        recommendationScore: this.calculateRecommendationScore(flowData, incidentsData),
        lastUpdated: new Date()
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: trafficData,
        expiry: Date.now() + this.CACHE_DURATION
      });

      return trafficData;
    } catch (error) {
      console.warn(`Error fetching traffic data for ${lat}, ${lon}, using fallback:`, error);
      
      // Return fallback data with reasonable defaults
      return {
        lat,
        lon,
        incidents: [],
        trafficLevel: 'MODERATE',
        congestionScore: 50,
        recommendationScore: 50,
        lastUpdated: new Date()
      };
    }
  }

  /**
   * Get traffic flow data from TomTom Flow API
   */
  private async getTrafficFlow(lat: number, lon: number): Promise<TrafficFlowData | undefined> {
    if (!this.config.apiKey) {
      console.warn('TomTom API key not configured');
      return undefined;
    }

    const url = `${this.config.baseUrl}/traffic/services/4/flowSegmentData/absolute/10/json`;
    const params = new URLSearchParams({
      key: this.config.apiKey,
      point: `${lat},${lon}`,
      unit: 'KMPH'
    });

    try {
      console.log(`🚗 TomTom Flow API: Fetching data for lat=${lat}, lon=${lon}`);
      console.log(`🔗 TomTom Flow API URL: ${url}?${params}`);
      
      const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(this.config.timeout)
      });

      console.log(`📡 TomTom Flow API Response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`❌ TomTom Flow API error ${response.status}: ${errorText}`);
        return undefined; // Return undefined instead of throwing
      }

      const data = await response.json();
      console.log(`✅ TomTom Flow API Success: Speed data received`);
      
      if (data.flowSegmentData) {
        return {
          currentSpeed: data.flowSegmentData.currentSpeed || 0,
          freeFlowSpeed: data.flowSegmentData.freeFlowSpeed || 0,
          currentTravelTime: data.flowSegmentData.currentTravelTime || 0,
          freeFlowTravelTime: data.flowSegmentData.freeFlowTravelTime || 0,
          confidence: data.flowSegmentData.confidence || 0,
          roadClosure: data.flowSegmentData.roadClosure || false
        };
      }

      return undefined;
    } catch (error) {
      console.warn('Error fetching traffic flow data (using fallback):', error);
      return undefined;
    }
  }

  /**
   * Get traffic incidents from TomTom Incidents API
   */
  private async getTrafficIncidents(lat: number, lon: number, radius: number): Promise<TrafficIncidentData[]> {
    if (!this.config.apiKey) {
      return [];
    }

    // Calculate bounding box from center point and radius
    const radiusInDegrees = radius / 111000; // Convert meters to degrees (approximate)
    const minLat = lat - radiusInDegrees;
    const maxLat = lat + radiusInDegrees;
    const minLon = lon - radiusInDegrees;
    const maxLon = lon + radiusInDegrees;

    // Use correct TomTom Incidents API v5 with bounding box format
    const url = `${this.config.baseUrl}/traffic/services/5/incidentDetails`;
    const params = new URLSearchParams({
      key: this.config.apiKey,
      bbox: `${minLon},${minLat},${maxLon},${maxLat}`,
      fields: '{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events,startTime,endTime,from,to,length,delay,roadNumbers,timeValidity}}}',
      language: 'en-US',
      categoryFilter: 'Accident,Congestion,DisabledVehicle,MassTransit,Miscellaneous,OtherNews,PlannedEvent,RoadClosure,RoadHazard,Weather,Flow',
      timeValidityFilter: 'present'
    });

    try {
      console.log(`🚦 TomTom Incidents API: Fetching data for lat=${lat}, lon=${lon}, radius=${radius}m`);
      console.log(`🔗 TomTom Incidents API URL: ${url}?${params}`);
      
      const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(this.config.timeout)
      });

      console.log(`📡 TomTom Incidents API Response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`❌ TomTom Incidents API error ${response.status}: ${errorText}`);
        return []; // Return empty array instead of throwing
      }

      const data = await response.json();
      console.log(`✅ TomTom Incidents API Success: Found ${data.incidents?.length || 0} incidents`);
      
      // Handle the GeoJSON response      
      if (data.incidents && Array.isArray(data.incidents)) {
        const processedIncidents = data.incidents.map((incident: any) => ({
          id: incident.properties?.id || incident.id || Math.random().toString(),
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
        
        console.log(`🎯 TomTom Incidents Processed: ${processedIncidents.length} incidents with delays ranging from ${Math.min(...processedIncidents.map((i: any) => i.delay))} to ${Math.max(...processedIncidents.map((i: any) => i.delay))} seconds`);
        return processedIncidents;
      }

      console.log(`📊 TomTom Incidents: No incidents found in response`);
      return [];
    } catch (error) {
      console.warn('❌ Error fetching traffic incidents (using fallback):', error);
      return []; // Return empty array for graceful degradation
    }
  }

  /**
   * Calculate overall traffic level based on flow and incidents
   */
  private calculateTrafficLevel(flowData?: TrafficFlowData, incidents: TrafficIncidentData[] = []): 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' {
    let score = 0;

    // Flow-based scoring
    if (flowData) {
      const speedRatio = flowData.currentSpeed / Math.max(flowData.freeFlowSpeed, 1);
      const timeRatio = flowData.currentTravelTime / Math.max(flowData.freeFlowTravelTime, 1);
      
      if (speedRatio < 0.3 || timeRatio > 3) score += 40;
      else if (speedRatio < 0.5 || timeRatio > 2) score += 30;
      else if (speedRatio < 0.7 || timeRatio > 1.5) score += 20;
      else score += 10;

      if (flowData.roadClosure) score += 30;
    }

    // Incident-based scoring
    const highImpactIncidents = incidents.filter(i => i.magnitudeOfDelay > 2);
    score += highImpactIncidents.length * 15;
    score += Math.min(incidents.length * 5, 25);

    if (score >= 70) return 'SEVERE';
    if (score >= 50) return 'HIGH';
    if (score >= 25) return 'MODERATE';
    return 'LOW';
  }

  /**
   * Calculate congestion score (0-100, higher = more congested)
   */
  private calculateCongestionScore(flowData?: TrafficFlowData, incidents: TrafficIncidentData[] = []): number {
    let score = 0;

    if (flowData) {
      const speedRatio = flowData.currentSpeed / Math.max(flowData.freeFlowSpeed, 1);
      const timeRatio = flowData.currentTravelTime / Math.max(flowData.freeFlowTravelTime, 1);
      
      // Speed-based score (0-50 points)
      score += Math.max(0, (1 - speedRatio) * 50);
      
      // Time-based score (0-30 points)
      score += Math.min((timeRatio - 1) * 30, 30);
      
      // Road closure penalty
      if (flowData.roadClosure) score += 20;
    } else {
      score += 25; // Default moderate score when no flow data
    }

    // Incident-based score (0-20 points)
    const incidentScore = Math.min(incidents.length * 3 + 
      incidents.filter(i => i.magnitudeOfDelay > 2).length * 5, 20);
    score += incidentScore;

    return Math.min(Math.round(score), 100);
  }

  /**
   * Calculate recommendation score (0-100, higher = better to visit now)
   */
  private calculateRecommendationScore(flowData?: TrafficFlowData, incidents: TrafficIncidentData[] = []): number {
    const congestionScore = this.calculateCongestionScore(flowData, incidents);
    
    // Invert congestion score and apply weighting
    let recommendationScore = 100 - congestionScore;
    
    // Boost score for very low traffic
    if (congestionScore < 20) {
      recommendationScore += 10;
    }
    
    // Penalty for road closures or severe incidents
    if (flowData?.roadClosure || incidents.some(i => i.magnitudeOfDelay > 3)) {
      recommendationScore -= 20;
    }
    
    return Math.max(0, Math.min(100, Math.round(recommendationScore)));
  }

  /**
   * Get traffic data for multiple locations in batch
   */
  async getBatchTrafficData(locations: Array<{ lat: number; lon: number; id?: string }>): Promise<Map<string, LocationTrafficData>> {
    const results = new Map<string, LocationTrafficData>();
    
    // Process in batches to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < locations.length; i += batchSize) {
      const batch = locations.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (location) => {
        const key = location.id || `${location.lat}_${location.lon}`;
        const data = await this.getLocationTrafficData(location.lat, location.lon);
        return { key, data };
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.set(result.value.key, result.value.data);
        }
      });
      
      // Small delay between batches to respect rate limits
      if (i + batchSize < locations.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now >= value.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

// Export singleton instance
export const tomtomTrafficService = new TomTomTrafficService();

/**
 * Utility function to get traffic summary for an activity
 */
export function getTrafficSummary(trafficData: LocationTrafficData): string {
  const { trafficLevel, congestionScore, recommendationScore } = trafficData;
  
  if (trafficLevel === 'LOW' && recommendationScore > 80) {
    return "🟢 Excellent time to visit - minimal traffic";
  } else if (trafficLevel === 'MODERATE' && recommendationScore > 60) {
    return "🟡 Good time to visit - light traffic";
  } else if (trafficLevel === 'HIGH' || congestionScore > 70) {
    return "🟠 Heavy traffic - consider visiting later";
  } else if (trafficLevel === 'SEVERE' || congestionScore > 85) {
    return "🔴 Severe traffic - avoid if possible";
  }
  
  return "⚪ Traffic conditions unknown";
}

/**
 * Get traffic-aware time recommendation
 */
export function getTrafficTimeRecommendation(trafficData: LocationTrafficData, peakHours?: string): string {
  const { recommendationScore, trafficLevel } = trafficData;
  
  if (recommendationScore > 80) {
    return "Perfect time to visit now!";
  } else if (recommendationScore > 60) {
    return "Good time to visit with light traffic";
  } else if (trafficLevel === 'HIGH' || trafficLevel === 'SEVERE') {
    return peakHours ? 
      `Heavy traffic detected. Consider visiting during off-peak hours: ${peakHours}` :
      "Heavy traffic detected. Consider visiting during off-peak hours";
  }
  
  return "Moderate traffic conditions";
}
