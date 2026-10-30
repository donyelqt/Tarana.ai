
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
  updateInterval: number; 
  alertThresholds: {
    congestionIncrease: number; 
    delayIncrease: number; 
    newIncidentRadius: number; 
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
      updateInterval: 2 * 60 * 1000, 
      alertThresholds: {
        congestionIncrease: 20, 
        delayIncrease: 300, 
        newIncidentRadius: 1000 
      }
    };
  }

  async startMonitoring(
    routeId: string, 
    route: RouteData,
    callback: (update: RouteUpdate) => void
  ): Promise<void> {
    console.log(`🔍 Traffic Monitor: Starting monitoring for route ${routeId}`);

    const initialAnalysis = await routeTrafficAnalyzer.analyzeRouteTraffic(route);

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

  stopMonitoring(routeId: string): void {
    const monitoring = this.activeMonitoring.get(routeId);
    if (monitoring) {
      clearInterval(monitoring.intervalId);
      this.activeMonitoring.delete(routeId);
      console.log(`🛑 Traffic Monitor: Stopped monitoring route ${routeId}`);
    }
  }

  subscribe(routeId: string, callback: (update: RouteUpdate) => void): boolean {
    const monitoring = this.activeMonitoring.get(routeId);
    if (monitoring) {
      monitoring.subscribers.add(callback);
      return true;
    }
    return false;
  }

  unsubscribe(routeId: string, callback: (update: RouteUpdate) => void): void {
    const monitoring = this.activeMonitoring.get(routeId);
    if (monitoring) {
      monitoring.subscribers.delete(callback);
      
      if (monitoring.subscribers.size === 0) {
        this.stopMonitoring(routeId);
      }
    }
  }

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

  async forceUpdate(routeId: string): Promise<RouteUpdate | null> {
    const monitoring = this.activeMonitoring.get(routeId);
    if (!monitoring) return null;

    return await this.checkTrafficUpdates(routeId);
  }

  getActiveMonitoring(): string[] {
    return Array.from(this.activeMonitoring.keys());
  }


  private async checkTrafficUpdates(routeId: string): Promise<RouteUpdate | null> {
    const monitoring = this.activeMonitoring.get(routeId);
    if (!monitoring) return null;

    try {
      console.log(`🔄 Traffic Monitor: Checking updates for route ${routeId}`);

      const newAnalysis = await routeTrafficAnalyzer.analyzeRouteTraffic(monitoring.route);
      
      const changes = this.detectTrafficChanges(monitoring.lastAnalysis, newAnalysis);
      
      if (changes.hasSignificantChange) {
        console.log(`🚨 Traffic Monitor: Significant changes detected for route ${routeId}:`, changes);

        const alerts = this.generateTrafficAlerts(changes, monitoring);
        
        const update: RouteUpdate = {
          routeId,
          updateType: this.determineUpdateType(changes),
          newTrafficData: newAnalysis,
          alerts,
          timestamp: new Date()
        };

        monitoring.alertHistory.push(...alerts);
        
        if (monitoring.alertHistory.length > 10) {
          monitoring.alertHistory = monitoring.alertHistory.slice(-10);
        }

        monitoring.lastAnalysis = newAnalysis;

        monitoring.subscribers.forEach(callback => {
          try {
            callback(update);
          } catch (error) {
            console.error('❌ Traffic Monitor: Subscriber callback failed:', error);
          }
        });

        return update;
      } else {
        monitoring.lastAnalysis = newAnalysis;
        console.log(`✅ Traffic Monitor: No significant changes for route ${routeId}`);
      }

    } catch (error) {
      console.error(`❌ Traffic Monitor: Update check failed for route ${routeId}:`, error);
      
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

    changes.hasSignificantChange = 
      Math.abs(changes.congestionChange) >= this.config.alertThresholds.congestionIncrease ||
      changes.delayChange >= this.config.alertThresholds.delayIncrease ||
      changes.trafficLevelChange ||
      changes.newIncidents.length > 0 ||
      changes.resolvedIncidents.length > 0;

    return changes;
  }

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

  private generateTrafficAlerts(changes: any, monitoring: ActiveMonitoring): TrafficAlert[] {
    const alerts: TrafficAlert[] = [];

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

    changes.resolvedIncidents.forEach((incident: any) => {
      alerts.push({
        id: `resolved_${incident.id}`,
        type: 'incident',
        severity: 'low',
        message: `Traffic incident resolved: ${incident.events[0]?.description || 'Incident cleared'}`,
        affectedSegments: [incident.from, incident.to],
        alternativeAvailable: false,
        estimatedDelay: -incident.delay, 
        timestamp: new Date()
      });
    });

    return alerts;
  }

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

  cleanup(): void {
    const now = Date.now();
    const maxAge = 2 * 60 * 60 * 1000; 
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

export const realTimeTrafficMonitor = new RealTimeTrafficMonitor();

setInterval(() => {
  realTimeTrafficMonitor.cleanup();
}, 60 * 60 * 1000);