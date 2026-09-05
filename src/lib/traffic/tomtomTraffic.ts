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
    const timeoutOverride = Number(process.env.TOMTOM_TIMEOUT_MS);
    const primaryApiKey = process.env.TOMTOM_API_KEY;
    const fallbackPublicApiKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
    const resolvedApiKey = primaryApiKey || fallbackPublicApiKey || '';

    this.config = {
      apiKey: resolvedApiKey,
      baseUrl: 'https://api.tomtom.com',
      timeout: Number.isFinite(timeoutOverride) && timeoutOverride > 0 ? timeoutOverride : 8000
    };

    if (!this.config.apiKey) {
      console.warn(' TomTom API key not found. Traffic features will use fallback data.');
    } else if (!primaryApiKey && fallbackPublicApiKey) {
      console.warn(' TomTom API key missing but NEXT_PUBLIC_TOMTOM_API_KEY is set. Using public key for traffic requests.');
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

      if (!flowData) {
        if (cached) {
          console.warn(`♻️ TomTom: Flow unavailable, reusing cached traffic data for ${lat}, ${lon}`);
          cached.expiry = Date.now() + this.CACHE_DURATION / 2;
          return cached.data;
        }

        console.warn(`⚠️ TomTom: Flow data unavailable and no cache for ${lat}, ${lon}. Using fallback values.`);
        return this.createFallbackTrafficData(lat, lon);
      }
      
      // Try to get incidents but don't fail if unavailable
      let incidents: TrafficIncident[] = [];
      try {
        incidents = await this.getTrafficIncidents(lat, lon, 1000);
      } catch (incidentError) {
        console.log(`⚠️ TomTom: Incidents unavailable, using flow data only`);
      }

      const congestionScore = this.calculateCongestionScore(flowData, incidents);
      const trafficLevel = this.getTrafficLevel(congestionScore);
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
      if (cached) {
        console.warn(`♻️ TomTom: Error fetching traffic (${lat}, ${lon}). Reusing cached data:`, error instanceof Error ? error.message : 'Unknown error');
        cached.expiry = Date.now() + this.CACHE_DURATION / 2;
        return cached.data;
      }

      console.log(`⚠️ TomTom: Traffic API failed, using fallback data for ${lat}, ${lon}:`, error instanceof Error ? error.message : 'Unknown error');
      return this.createFallbackTrafficData(lat, lon);
    }
  }

  /**
   * Get traffic flow data from TomTom Flow API
   */
  /**
   * Headers for TomTom API requests.
   * Keys with referer restrictions reject requests without a matching Referer —
   * server-side calls send none by default, so fall back to the registered app origin.
   */
  private tomTomHeaders(): Record<string, string> {
    const referer = process.env.TOMTOM_REFERER || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || 'https://tarana-ai.vercel.app';
    let origin = referer;
    try { origin = new URL(referer).origin; } catch { /* keep raw */ }
    return {
      'Accept': 'application/json',
      'User-Agent': 'Tarana.ai/1.0',
      'Referer': referer,
      'Origin': origin
    };
  }

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

    console.log(`🌐 TomTom: Requesting flow data: ${url}?${params.toString().replace(/key=[^&]*/, "key=***")}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(`${url}?${params.toString()}`, {
        signal: controller.signal,
        headers: this.tomTomHeaders()
      });

      clearTimeout(timeoutId);

      console.log(`📡 TomTom: Flow API response status: ${response.status}`);

      if (!response.ok) {
        throw new Error(`TomTom Flow API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.flowSegmentData || null;

    } catch (error: any) {
      const message = error?.message || error?.toString?.() || 'Unknown error';
      if (message.includes('abort') || message.includes('timeout') || message.includes('UND_ERR_CONNECT_TIMEOUT')) {
        console.warn(`⌛ TomTom: Flow API timed out for ${lat}, ${lon} (${message}). Using fallback.`);
      } else {
        console.error(`❌ TomTom: Flow API request failed:`, error);
      }
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

      console.log(`🌐 TomTom: Requesting incidents data: ${url}?${params.toString().replace(/key=[^&]*/, "key=***")}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(`${url}?${params.toString()}`, {
        signal: controller.signal,
        headers: this.tomTomHeaders()
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

      console.log(`🌐 TomTom: Trying simplified incidents request: ${url}?${params.toString().replace(/key=[^&]*/, "key=***")}`);

      const response = await fetch(`${url}?${params.toString()}`, {
        headers: this.tomTomHeaders()
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
  /**
   * Calculate congestion score (0-100) from TomTom flow data and any
   * nearby incidents.
   *
   * H1-fix (2026-09-04): previous version let 3 incidents at magnitude 4
   * each add 30 points per incident (capped per-incident) → 90 total,
   * pushing a free-flow 30/30 km/h road into SEVERE. That was wrong:
   * speed is the dominant signal; incidents on a free-flowing road are
   * advisories, not blockers.
   *
   * New rule: per-incident impact is dampened by current speed ratio.
   * On a free-flow road (ratio >= 0.9), each incident contributes at
   * most 8 points (a "soft" advisory). As the road slows, incidents
   * weigh more — at stop-and-go (ratio <= 0.3) the old cap of 30 each
   * applies. The TOTAL incident contribution is also capped at 25
   * regardless of incident count, so 50 small incidents don't push
   * a free-flow reading into SEVERE.
   */
  private calculateCongestionScore(flowData: any, incidents: TrafficIncident[]): number {
    let score = 0;
    let speedRatio = 1.0;

    if (flowData && flowData.currentSpeed && flowData.freeFlowSpeed) {
      speedRatio = Math.max(0, Math.min(1, flowData.currentSpeed / flowData.freeFlowSpeed));
      score = Math.max(0, (1 - speedRatio) * 100) * 0.85;
      console.log('🚗 TomTom: Speed-based congestion score: ' + score.toFixed(1) + ' (' + flowData.currentSpeed + '/' + flowData.freeFlowSpeed + ' km/h)');
    } else {
      score = 25;
      console.log('🚗 TomTom: Using default congestion score: ' + score + ' (no flow data)');
    }

    // Per-incident impact: cap = lerp(8, 30, 1 - speedRatio).
    //   speedRatio=1.0 (free-flow) → cap=8 per incident
    //   speedRatio=0.3 (slow)     → cap=23.4 per incident
    //   speedRatio=0.0 (stopped)  → cap=30 per incident
    const perIncidentCap = 8 + (1 - speedRatio) * 22;
    let incidentTotal = 0;
    incidents.forEach(incident => {
      const incidentImpact = Math.min(incident.magnitudeOfDelay * 10, perIncidentCap);
      incidentTotal += incidentImpact;
      console.log('🚧 TomTom: Incident impact +' + incidentImpact.toFixed(1) + ' (magnitude: ' + incident.magnitudeOfDelay + ', speedRatio: ' + speedRatio.toFixed(2) + ')');
    });
    // Hard cap on total incident contribution — 25 max regardless of count.
    // This prevents "5 small incidents on a clear road" → SEVERE.
    const TOTAL_INCIDENT_CAP = 25;
    const cappedIncidentTotal = Math.min(incidentTotal, TOTAL_INCIDENT_CAP);
    if (incidentTotal > TOTAL_INCIDENT_CAP) {
      console.log(`🚧 TomTom: Incident total ${incidentTotal.toFixed(1)} capped to ${TOTAL_INCIDENT_CAP} (count: ${incidents.length})`);
    }
    score += cappedIncidentTotal;

    const finalScore = Math.min(100, Math.max(0, Math.round(score)));
    console.log('📊 TomTom: Final congestion score: ' + finalScore + '/100 (speedRatio: ' + speedRatio.toFixed(2) + ', incidentTotal: ' + cappedIncidentTotal.toFixed(1) + ')');

    return finalScore;
  }

  /**
   * Determine traffic level from congestion score.
   *
   * Incident impact is already baked into the congestion score by
   * calculateCongestionScore, so we do NOT override based on raw
   * incident data.  Thresholds match getTrafficLevelFromScore()
   * in src/lib/utils/trafficColors.ts.
   */
  private getTrafficLevel(congestionScore: number): 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' {
    if (congestionScore >= 75) {
      console.log(`🔴 TomTom: SEVERE traffic level (score: ${congestionScore})`);
      return 'SEVERE';
    } else if (congestionScore >= 50) {
      console.log(`🟠 TomTom: HIGH traffic level (score: ${congestionScore})`);
      return 'HIGH';
    } else if (congestionScore >= 25) {
      console.log(`🟡 TomTom: MODERATE traffic level (score: ${congestionScore})`);
      return 'MODERATE';
    } else if (congestionScore >= 15) {
      console.log(`🟢 TomTom: LOW traffic level (score: ${congestionScore})`);
      return 'LOW';
    } else {
      console.log('🔵 TomTom: VERY LOW traffic level (score: ' + congestionScore + ')');
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
      congestionScore: 18,
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



