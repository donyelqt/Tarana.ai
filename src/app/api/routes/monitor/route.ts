import { NextRequest, NextResponse } from 'next/server';
import { RouteMonitoringResponse } from '@/types/route-optimization';

interface RouteMonitorRequest {
  routeId: string;
  monitoringDuration: number; // minutes
  alertThresholds: {
    delayMinutes: number;
    trafficLevelChange: boolean;
  };
}

interface MonitoringSession {
  id: string;
  routeId: string;
  startTime: Date;
  endTime: Date;
  alertThresholds: {
    delayMinutes: number;
    trafficLevelChange: boolean;
  };
  isActive: boolean;
}

// In-memory storage for monitoring sessions (in production, use Redis or database)
const monitoringSessions = new Map<string, MonitoringSession>();

/**
 * POST /api/routes/monitor
 * Start real-time route monitoring
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 API: Starting route monitoring');
    
    const body = await request.json();
    const monitorRequest: RouteMonitorRequest = body;

    // Validate request
    if (!monitorRequest.routeId) {
      return NextResponse.json(
        { error: 'Route ID is required' },
        { status: 400 }
      );
    }

    if (!monitorRequest.monitoringDuration || monitorRequest.monitoringDuration <= 0) {
      return NextResponse.json(
        { error: 'Valid monitoring duration is required' },
        { status: 400 }
      );
    }

    // Generate monitoring session ID
    const monitoringId = `monitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate monitoring end time
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + (monitorRequest.monitoringDuration * 60 * 1000));
    
    // Create monitoring session
    const session: MonitoringSession = {
      id: monitoringId,
      routeId: monitorRequest.routeId,
      startTime,
      endTime,
      alertThresholds: monitorRequest.alertThresholds,
      isActive: true
    };

    // Store session
    monitoringSessions.set(monitoringId, session);

    console.log(`✅ API: Route monitoring started - Session: ${monitoringId}, Route: ${monitorRequest.routeId}, Duration: ${monitorRequest.monitoringDuration}min`);

    // Schedule cleanup
    setTimeout(() => {
      const session = monitoringSessions.get(monitoringId);
      if (session) {
        session.isActive = false;
        monitoringSessions.delete(monitoringId);
        console.log(`🧹 API: Monitoring session ${monitoringId} cleaned up`);
      }
    }, monitorRequest.monitoringDuration * 60 * 1000);

    // Generate estimated update schedule
    const updateInterval = Math.min(5, Math.max(1, Math.floor(monitorRequest.monitoringDuration / 12))); // Update every 1-5 minutes
    const estimatedUpdates: Date[] = [];
    
    for (let i = updateInterval; i < monitorRequest.monitoringDuration; i += updateInterval) {
      estimatedUpdates.push(new Date(startTime.getTime() + (i * 60 * 1000)));
    }

    const response: RouteMonitoringResponse = {
      monitoringId,
      routeId: monitorRequest.routeId,
      currentStatus: {
        isActive: true,
        progress: 0,
        estimatedTimeRemaining: 0, // Will be updated in real-time
        trafficAlerts: []
      },
      estimatedUpdates,
      alertsEnabled: true
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ API: Route monitoring start failed:', error);
    
    return NextResponse.json(
      { error: 'Failed to start route monitoring' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/routes/monitor/[id]
 * Get monitoring session status
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const monitoringId = pathSegments[pathSegments.length - 1];

    if (!monitoringId) {
      return NextResponse.json(
        { error: 'Monitoring ID is required' },
        { status: 400 }
      );
    }

    const session = monitoringSessions.get(monitoringId);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Monitoring session not found' },
        { status: 404 }
      );
    }

    // Check if session has expired
    const now = new Date();
    if (now > session.endTime) {
      session.isActive = false;
      monitoringSessions.delete(monitoringId);
      
      return NextResponse.json({
        monitoringId,
        routeId: session.routeId,
        currentStatus: {
          isActive: false,
          progress: 100,
          estimatedTimeRemaining: 0,
          trafficAlerts: []
        },
        message: 'Monitoring session has expired'
      });
    }

    // Calculate progress
    const totalDuration = session.endTime.getTime() - session.startTime.getTime();
    const elapsed = now.getTime() - session.startTime.getTime();
    const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

    return NextResponse.json({
      monitoringId,
      routeId: session.routeId,
      currentStatus: {
        isActive: session.isActive,
        progress: Math.round(progress),
        estimatedTimeRemaining: Math.max(0, Math.round((session.endTime.getTime() - now.getTime()) / 1000)),
        trafficAlerts: [] // In real implementation, this would contain actual alerts
      },
      estimatedUpdates: [],
      alertsEnabled: true
    });

  } catch (error) {
    console.error('❌ API: Failed to get monitoring status:', error);
    
    return NextResponse.json(
      { error: 'Failed to get monitoring status' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/routes/monitor/[id]
 * Stop route monitoring
 */
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const monitoringId = pathSegments[pathSegments.length - 1];

    if (!monitoringId) {
      return NextResponse.json(
        { error: 'Monitoring ID is required' },
        { status: 400 }
      );
    }

    const session = monitoringSessions.get(monitoringId);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Monitoring session not found' },
        { status: 404 }
      );
    }

    // Stop monitoring
    session.isActive = false;
    monitoringSessions.delete(monitoringId);

    console.log(`🛑 API: Route monitoring stopped - Session: ${monitoringId}`);

    return NextResponse.json({
      monitoringId,
      routeId: session.routeId,
      message: 'Monitoring stopped successfully'
    });

  } catch (error) {
    console.error('❌ API: Failed to stop monitoring:', error);
    
    return NextResponse.json(
      { error: 'Failed to stop monitoring' },
      { status: 500 }
    );
  }
}

/**
 * Utility function to clean up expired sessions
 */
export function cleanupExpiredSessions() {
  const now = new Date();
  let cleaned = 0;
  
  for (const [id, session] of monitoringSessions.entries()) {
    if (now > session.endTime) {
      session.isActive = false;
      monitoringSessions.delete(id);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 API: Cleaned up ${cleaned} expired monitoring sessions`);
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupExpiredSessions, 10 * 60 * 1000);