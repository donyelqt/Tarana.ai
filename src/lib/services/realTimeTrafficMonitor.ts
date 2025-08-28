/**
 * Real-time Traffic Monitoring Service
 * Provides live traffic updates and alternative route suggestions
 */

import { 
  RouteData,
  RouteTrafficAnalysis,
  TrafficAlert,
  RouteUpdate,
  Coordinates,
  TrafficIncident
} from '@/types/route-optimization';
import { routeTrafficAnalyzer } from './routeTrafficAnalysis';

interface TrafficMonitoringConfig {
  updateInterval: number; // milliseconds
  alertThresholds: {
    congestionIncrease: number; // percentage
    delayIncrease: number; // seconds
    newIncidentRadius: number; // meters
  };
}

interface ActiveMonitoring {
  routeId: string;
  route: RouteData;
  lastAnalysis: RouteTrafficAnalysis;
  subscribers: Set<(update: RouteUpdate) => void>;
  intervalId: NodeJS.Timeout;
  startTime: Date;
  alertHistory: TrafficAlert[];
}

class RealTimeTrafficMonitor {
  private activeMonitoring = new Map<string, ActiveMonitoring>();
  private config: TrafficMonitoringConfig;

  constructor() {
    this.config = {
      updateInterval: 2 * 60 * 1000, // 2 minutes
      alertThresholds: {
        congestionIncrease: 20, // 20% increase triggers alert
        delayIncrease: 300, // 5 minutes additional delay
        newIncidentRadius: 1000 // 1km radius for incident alerts
      }
    };
  }

  /**
   * Start monitoring a route for real-time traffic changes
   */
  async startMonitoring(
    routeId: string, 
    route: RouteData,
    callback: (update: RouteUpdate) => void
  ): Promise<void> {
    console.log(`🔍 Traffic Monitor: Starting monitoring for route ${routeId}`);

    // Get initial traffic analysis
    const initialAnalysis = await routeTrafficAnalyzer.analyzeRouteTraffic(route);

    // Create monitoring session
    const monitoring: ActiveMonitoring = {
      routeId,
      route,
      lastAnalysis: initialAnalysis,
      subscribers: new Set([callback]),
      intervalId: setInterval(() => this.checkTrafficUpdates(routeId), this.config.updateInterval),
      startTime: new Date(),
      alertHistory: []
    };

    this.activeMonitoring.set(routeId, monitoring);

    console.log(`✅ Traffic Monitor: Monitoring started for route ${routeId} with ${this.config.updateInterval/1000}s intervals`);
  }

  /**
   * Stop monitoring a route
   */
  stopMonitoring(routeId: string): void {
    const monitoring = this.activeMonitoring.get(routeId);
    if (monitoring) {
      clearInterval(monitoring.intervalId);
      this.activeMonitoring.delete(routeId);
      console.log(`🛑 Traffic Monitor: Stopped monitoring route ${routeId}`);
    }
  }

  /**
   * Add subscriber to existing monitoring session
   */
  subscribe(routeId: string, callback: (update: RouteUpdate) => void): boolean {
    const monitoring = this.activeMonitoring.get(routeId);
    if (monitoring) {
      monitoring.subscribers.add(callback);
      return true;
    }
    return false;
  }

  /**
   * Remove subscriber from monitoring session
   */
  unsubscribe(routeId: string, callback: (update: RouteUpdate) => void): void {
    const monitoring = this.activeMonitoring.get(routeId);
    if (monitoring) {
      monitoring.subscribers.delete(callback);
      
      // Stop monitoring if no subscribers
      if (monitoring.subscribers.size === 0) {
        this.stopMonitoring(routeId);
      }
    }
  }

  /**
   * Get current monitoring status
   */
  getMonitoringStatus(routeId: string): {
    isMonitoring: boolean;
    duration: number;
    lastUpdate: Date;
    alertCount: number;
  } | null {
    const monitoring = this.activeMonitoring.get(routeId);
    if (!monitoring) return null;

    return {
      isMonitoring: true,
      duration: Date.now() - monitoring.startTime.getTime(),
      lastUpdate: monitoring.lastAnalysis.lastUpdated,
      alertCount: monitoring.alertHistory.length
    };
  }

  /**
   * Force immediate traffic check for a route
   */
  async forceUpdate(routeId: string): Promise<RouteUpdate | null> {
    const monitoring = this.activeMonitoring.get(routeId);
    if (!monitoring) return null;

    return await this.checkTrafficUpdates(routeId);
  }

  /**
   * Get all active monitoring sessions
   */
  getActiveMonitoring(): string[] {
    return Array.from(this.activeMonitoring.keys());
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Check for traffic updates on a monitored route
   */
  private async checkTrafficUpdates(routeId: string): Promise<RouteUpdate | null> {
    const monitoring = this.activeMonitoring.get(routeId);
    if (!monitoring) return null;

    try {
      console.log(`🔄 Traffic Monitor: Checking updates for route ${routeId}`);

      // Get fresh traffic analysis
      const newAnalysis = await routeTrafficAnalyzer.analyzeRouteTraffic(monitoring.route);
      
      // Compare with last analysis to detect changes
      const changes = this.detectTrafficChanges(monitoring.lastAnalysis, newAnalysis);
      
      if (changes.hasSignificantChange) {
        console.log(`🚨 Traffic Monitor: Significant changes detected for route ${routeId}:`, changes);

        // Generate alerts
        const alerts = this.generateTrafficAlerts(changes, monitoring);
        
        // Create route update
        const update: RouteUpdate = {
          routeId,
          updateType: this.determineUpdateType(changes),
          newTrafficData: newAnalysis,
          alerts,
          timestamp: new Date()
        };

        // Store alerts in history
        monitoring.alertHistory.push(...alerts);
        
        // Keep only last 10 alerts
        if (monitoring.alertHistory.length > 10) {
          monitoring.alertHistory = monitoring.alertHistory.slice(-10);
        }

        // Update last analysis
        monitoring.lastAnalysis = newAnalysis;

        // Notify all subscribers
        monitoring.subscribers.forEach(callback => {
          try {
            callback(update);
          } catch (error) {
            console.error('❌ Traffic Monitor: Subscriber callback failed:', error);
          }
        });

        return update;
      } else {
        // Update last analysis even if no significant changes
        monitoring.lastAnalysis = newAnalysis;
        console.log(`✅ Traffic Monitor: No significant changes for route ${routeId}`);
      }

    } catch (error) {
      console.error(`❌ Traffic Monitor: Update check failed for route ${routeId}:`, error);
      
      // Generate error alert
      const errorAlert: TrafficAlert = {
        id: `error_${Date.now()}`,
        type: 'incident',
        severity: 'medium',
        message: 'Failed to update traffic data',
        affectedSegments: [],
        alternativeAvailable: false,
        estimatedDelay: 0,
        timestamp: new Date()
      };

      monitoring.subscribers.forEach(callback => {
        try {
          callback({
            routeId,
            updateType: 'traffic',
            alerts: [errorAlert],
            timestamp: new Date()
          });
        } catch (error) {
          console.error('❌ Traffic Monitor: Error callback failed:', error);
        }
      });
    }

    return null;
  }

  /**
   * Detect significant changes between traffic analyses
   */
  private detectTrafficChanges(
    oldAnalysis: RouteTrafficAnalysis, 
    newAnalysis: RouteTrafficAnalysis
  ) {
    const changes = {
      hasSignificantChange: false,
      congestionChange: newAnalysis.congestionScore - oldAnalysis.congestionScore,
      delayChange: newAnalysis.estimatedDelay - oldAnalysis.estimatedDelay,
      trafficLevelChange: oldAnalysis.overallTrafficLevel !== newAnalysis.overallTrafficLevel,
      newIncidents: this.findNewIncidents(oldAnalysis, newAnalysis),
      resolvedIncidents: this.findResolvedIncidents(oldAnalysis, newAnalysis)
    };

    // Check if changes exceed thresholds
    changes.hasSignificantChange = 
      Math.abs(changes.congestionChange) >= this.config.alertThresholds.congestionIncrease ||
      changes.delayChange >= this.config.alertThresholds.delayIncrease ||
      changes.trafficLevelChange ||
      changes.newIncidents.length > 0 ||
      changes.resolvedIncidents.length > 0;

    return changes;
  }

  /**
   * Find new incidents that weren't in the previous analysis
   */
  private findNewIncidents(oldAnalysis: RouteTrafficAnalysis, newAnalysis: RouteTrafficAnalysis): TrafficIncident[] {
    const oldIncidentIds = new Set<string>();
    oldAnalysis.segmentAnalysis.forEach(segment => {
      segment.incidents.forEach(incident => oldIncidentIds.add(incident.id));
    });

    const newIncidents: TrafficIncident[] = [];
    newAnalysis.segmentAnalysis.forEach(segment => {
      segment.incidents.forEach(incident => {
        if (!oldIncidentIds.has(incident.id)) {
          newIncidents.push(incident);
        }
      });
    });

    return newIncidents;
  }

  /**
   * Find incidents that were resolved
   */
  private findResolvedIncidents(oldAnalysis: RouteTrafficAnalysis, newAnalysis: RouteTrafficAnalysis): TrafficIncident[] {
    const newIncidentIds = new Set<string>();
    newAnalysis.segmentAnalysis.forEach(segment => {
      segment.incidents.forEach(incident => newIncidentIds.add(incident.id));
    });

    const resolvedIncidents: TrafficIncident[] = [];
    oldAnalysis.segmentAnalysis.forEach(segment => {
      segment.incidents.forEach(incident => {
        if (!newIncidentIds.has(incident.id)) {
          resolvedIncidents.push(incident);
        }
      });
    });

    return resolvedIncidents;
  }

  /**
   * Generate traffic alerts based on detected changes
   */
  private generateTrafficAlerts(changes: any, monitoring: ActiveMonitoring): TrafficAlert[] {
    const alerts: TrafficAlert[] = [];

    // Congestion increase alert
    if (changes.congestionChange >= this.config.alertThresholds.congestionIncrease) {
      alerts.push({
        id: `congestion_${Date.now()}`,
        type: 'congestion',
        severity: changes.congestionChange >= 40 ? 'high' : 'medium',
        message: `Traffic congestion increased by ${Math.round(changes.congestionChange)}%`,
        affectedSegments: monitoring.route.legs.map(leg => leg.startLocation.id),
        alternativeAvailable: true,
        estimatedDelay: changes.delayChange,
        timestamp: new Date()
      });
    }

    // Traffic level change alert
    if (changes.trafficLevelChange) {
      alerts.push({
        id: `level_${Date.now()}`,
        type: 'congestion',
        severity: monitoring.lastAnalysis.overallTrafficLevel === 'SEVERE' ? 'critical' : 'medium',
        message: `Traffic level changed to ${monitoring.lastAnalysis.overallTrafficLevel}`,
        affectedSegments: [],
        alternativeAvailable: true,
        estimatedDelay: changes.delayChange,
        timestamp: new Date()
      });
    }

    // New incident alerts
    changes.newIncidents.forEach((incident: any) => {
      alerts.push({
        id: `incident_${incident.id}`,
        type: 'incident',
        severity: incident.magnitudeOfDelay >= 4 ? 'critical' : 'high',
        message: `New traffic incident: ${incident.events[0]?.description || 'Unknown incident'}`,
        affectedSegments: [incident.from, incident.to],
        alternativeAvailable: true,
        estimatedDelay: incident.delay,
        timestamp: new Date()
      });
    });

    // Resolved incident alerts (good news!)
    changes.resolvedIncidents.forEach((incident: any) => {
      alerts.push({
        id: `resolved_${incident.id}`,
        type: 'incident',
        severity: 'low',
        message: `Traffic incident resolved: ${incident.events[0]?.description || 'Incident cleared'}`,
        affectedSegments: [incident.from, incident.to],
        alternativeAvailable: false,
        estimatedDelay: -incident.delay, // Negative delay indicates improvement
        timestamp: new Date()
      });
    });

    return alerts;
  }

  /**
   * Determine the type of update based on changes
   */
  private determineUpdateType(changes: any): 'traffic' | 'incident' | 'reroute' | 'eta' {
    if (changes.newIncidents.length > 0 || changes.resolvedIncidents.length > 0) {
      return 'incident';
    }
    
    if (changes.trafficLevelChange || Math.abs(changes.congestionChange) >= 30) {
      return 'reroute';
    }
    
    if (Math.abs(changes.delayChange) >= this.config.alertThresholds.delayIncrease) {
      return 'eta';
    }
    
    return 'traffic';
  }

  /**
   * Clean up expired monitoring sessions
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 2 * 60 * 60 * 1000; // 2 hours
    let cleaned = 0;

    for (const [routeId, monitoring] of this.activeMonitoring.entries()) {
      if (now - monitoring.startTime.getTime() > maxAge) {
        this.stopMonitoring(routeId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Traffic Monitor: Cleaned up ${cleaned} expired monitoring sessions`);
    }
  }
}

// Export singleton instance
export const realTimeTrafficMonitor = new RealTimeTrafficMonitor();

// Run cleanup every hour
setInterval(() => {
  realTimeTrafficMonitor.cleanup();
}, 60 * 60 * 1000);