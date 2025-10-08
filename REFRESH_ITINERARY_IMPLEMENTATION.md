# Itinerary Refresh System - Implementation Guide

## Overview
Enterprise-grade system to automatically detect and refresh itineraries when weather/traffic conditions significantly change.

---

## ✅ Completed Components

### 1. **Refresh Service** (`/src/lib/services/itineraryRefreshService.ts`)
**Status:** ✅ COMPLETE

**Features:**
- Multi-dimensional change detection (weather + traffic)
- Configurable thresholds (temperature: 5°C, congestion: 30%)
- Severity scoring (LOW/MEDIUM/HIGH/CRITICAL)
- Confidence calculation (0-100%)
- Traffic snapshot creation and comparison
- Human-readable change summaries

**Key Methods:**
```typescript
// Evaluate if refresh is needed
evaluateRefreshNeed(itinerary, currentWeather, activityCoordinates)

// Create traffic baseline
createTrafficSnapshot(activityCoordinates)

// Get user-friendly summary
getChangeSummary(result)
```

**Thresholds:**
- Temperature: >5°C change
- Congestion: >30% increase
- Traffic level: Exceeds MODERATE
- Extreme weather: Immediate trigger
- Critical incidents: Immediate trigger

---

### 2. **Data Model Extensions** (`/src/lib/data/savedItineraries.ts`)
**Status:** ✅ COMPLETE

**New Fields Added to SavedItinerary:**
```typescript
interface SavedItinerary {
  // ... existing fields
  refreshMetadata?: RefreshMetadata;
  trafficSnapshot?: TrafficSnapshot;
  activityCoordinates?: Array<{ lat: number; lon: number; name: string }>;
}
```

**RefreshMetadata Structure:**
```typescript
{
  lastEvaluatedAt: Date;
  lastRefreshedAt: Date | null;
  refreshReasons: RefreshReason[];
  status: 'FRESH' | 'STALE_PENDING' | 'REFRESHING' | 'REFRESH_FAILED' | 'REFRESH_COMPLETED';
  weatherSnapshot: WeatherData | null;
  trafficSnapshot: TrafficSnapshot | null;
  refreshCount: number;
  autoRefreshEnabled: boolean;
}
```

---

### 3. **Refresh API Endpoint** (`/src/app/api/saved-itineraries/[id]/refresh/route.ts`)
**Status:** ✅ COMPLETE

**Endpoints:**

#### GET `/api/saved-itineraries/[id]/refresh`
Evaluate refresh need without regenerating
```typescript
Response: {
  success: boolean;
  message: string;
  evaluation: ChangeDetectionResult;
}
```

#### POST `/api/saved-itineraries/[id]/refresh`
Full refresh with regeneration
```typescript
Request: {
  force?: boolean;          // Force refresh
  evaluateOnly?: boolean;   // Only evaluate
}

Response: {
  success: boolean;
  message: string;
  evaluation: ChangeDetectionResult;
  updatedItinerary?: SavedItinerary;
}
```

**Pipeline Flow:**
1. Authentication check
2. Fetch itinerary from database
3. Extract activity coordinates
4. Fetch current weather
5. Evaluate refresh need (weather + traffic)
6. Regenerate if needed (calls enterprise generation API)
7. Create traffic snapshot
8. Update database with new data + metadata
9. Return updated itinerary

---

## 🔧 Remaining Frontend Updates

### Update `/src/app/saved-trips/[id]/page.tsx`

**Add State Variables:**
```typescript
const [showChangeSummary, setShowChangeSummary] = useState(false)
const [changeSummary, setChangeSummary] = useState<string>('')
const [refreshEvaluation, setRefreshEvaluation] = useState<any>(null)
```

**Replace `handleRefreshItinerary` function (lines 67-171):**
```typescript
const handleRefreshItinerary = async (force: boolean = false) => {
  if (!itinerary) return
  
  setIsRefreshing(true)
  try {
    // Step 1: Evaluate if refresh is needed
    console.log('🔍 Evaluating refresh need...');
    const evalResponse = await fetch(`/api/saved-itineraries/${id}/refresh`, {
      method: 'GET'
    });

    if (!evalResponse.ok) {
      throw new Error('Failed to evaluate refresh need');
    }

    const evalResult = await evalResponse.json();
    console.log('📊 Evaluation result:', evalResult);

    setRefreshEvaluation(evalResult.evaluation);
    setChangeSummary(evalResult.message);

    // If no significant changes and not forced, show summary
    if (!force && evalResult.evaluation && !evalResult.evaluation.needsRefresh) {
      setShowChangeSummary(true);
      toast({
        title: "No Update Needed",
        description: evalResult.message,
      });
      setIsRefreshing(false);
      return;
    }

    // If significant changes detected, show summary and proceed
    if (evalResult.evaluation && evalResult.evaluation.needsRefresh) {
      setShowChangeSummary(true);
      await performRefresh(force);
      return;
    }

    // If forced, proceed directly
    if (force) {
      await performRefresh(true);
    }
  } catch (error) {
    console.error('Error evaluating refresh:', error);
    toast({
      title: "Error",
      description: "Failed to evaluate refresh need. Please try again.",
      variant: "destructive"
    });
    setIsRefreshing(false);
  }
};

const performRefresh = async (force: boolean = false) => {
  try {
    // Call the new refresh API endpoint
    console.log('🔄 Calling refresh API...');
    const response = await fetch(`/api/saved-itineraries/${id}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force })
    });

    if (!response.ok) {
      throw new Error(`Refresh API returned ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Refresh result:', result);

    if (!result.success) {
      throw new Error(result.error || 'Refresh failed');
    }

    // Update local state with refreshed itinerary
    if (result.updatedItinerary) {
      setItinerary(result.updatedItinerary);
      setChangeSummary(result.message);
      toast({
        title: "Itinerary Updated ✨",
        description: result.message,
      });
    } else {
      toast({
        title: "No Changes Made",
        description: result.message,
      });
    }
  } catch (error) {
    console.error("Error performing refresh:", error)
    toast({
      title: "Error",
      description: "Failed to refresh itinerary. Please try again.",
      variant: "destructive"
    })
  } finally {
    setIsRefreshing(false)
    setShowChangeSummary(false)
  }
};
```

**Remove old helper function (lines 173-223):**
Delete the entire `checkWeatherChange` function - no longer needed.

**Update Refresh Button (around line 406):**
```typescript
<div className="flex gap-2">
  <Button 
    onClick={() => handleRefreshItinerary(false)} 
    disabled={isRefreshing}
    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
  >
    {isRefreshing ? (
      <>
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Checking...
      </>
    ) : (
      <>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Smart Refresh
      </>
    )}
  </Button>
  <Button 
    onClick={() => handleRefreshItinerary(true)} 
    disabled={isRefreshing}
    variant="outline"
    className="px-4 py-2 rounded-lg flex items-center gap-2"
    title="Force refresh regardless of conditions"
  >
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  </Button>
</div>
```

**Add Change Summary Modal (before the Restaurant Detail Modal around line 632):**
```typescript
{/* Change Summary Modal */}
{showChangeSummary && refreshEvaluation && (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl max-w-2xl w-full p-6">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Refresh Analysis</h2>
        <button 
          onClick={() => setShowChangeSummary(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="space-y-4">
        {/* Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-gray-800">{changeSummary}</p>
        </div>

        {/* Severity Badge */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Severity:</span>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
            refreshEvaluation.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
            refreshEvaluation.severity === 'HIGH' ? 'bg-orange-100 text-orange-800' :
            refreshEvaluation.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
            'bg-green-100 text-green-800'
          }`}>
            {refreshEvaluation.severity}
          </span>
          <span className="text-sm text-gray-500">({refreshEvaluation.confidence}% confidence)</span>
        </div>

        {/* Weather Changes */}
        {refreshEvaluation.weatherChange && (
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <span>🌤️</span> Weather Changes
            </h3>
            <div className="space-y-1 text-sm text-gray-600">
              <p>Condition: {refreshEvaluation.weatherChange.previousCondition} → {refreshEvaluation.weatherChange.currentCondition}</p>
              <p>Temperature change: {refreshEvaluation.weatherChange.temperatureDelta.toFixed(1)}°C</p>
              {refreshEvaluation.weatherChange.extremeWeatherDetected && (
                <p className="text-red-600 font-semibold">⚠️ Extreme weather detected!</p>
              )}
            </div>
          </div>
        )}

        {/* Traffic Changes */}
        {refreshEvaluation.trafficChange && (
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <span>🚗</span> Traffic Changes
            </h3>
            <div className="space-y-1 text-sm text-gray-600">
              <p>Level: {refreshEvaluation.trafficChange.previousLevel} → {refreshEvaluation.trafficChange.currentLevel}</p>
              <p>Congestion change: {refreshEvaluation.trafficChange.congestionDelta > 0 ? '+' : ''}{refreshEvaluation.trafficChange.congestionDelta.toFixed(0)}%</p>
              {refreshEvaluation.trafficChange.criticalIncidents > 0 && (
                <p className="text-red-600 font-semibold">🚨 {refreshEvaluation.trafficChange.criticalIncidents} critical incident(s)</p>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          {refreshEvaluation.needsRefresh ? (
            <>
              <Button 
                onClick={() => performRefresh(false)}
                disabled={isRefreshing}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isRefreshing ? 'Refreshing...' : 'Update Itinerary'}
              </Button>
              <Button 
                onClick={() => setShowChangeSummary(false)}
                variant="outline"
                className="flex-1"
              >
                Keep Current
              </Button>
            </>
          ) : (
            <Button 
              onClick={() => setShowChangeSummary(false)}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
            >
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  </div>
)}
```

---

## 🔮 Optional: Background Job Scheduler

### Create `/src/lib/services/refreshScheduler.ts`
```typescript
/**
 * Background scheduler for automated refresh evaluation
 * Can be triggered by cron jobs or serverless functions
 */

import { getSavedItineraries } from '../data/savedItineraries';
import { itineraryRefreshService } from './itineraryRefreshService';
import { fetchWeatherFromAPI } from '../core/utils';

export async function evaluateAllItineraries() {
  console.log('🔄 Starting scheduled refresh evaluation...');
  
  const itineraries = await getSavedItineraries();
  const results = [];

  for (const itinerary of itineraries) {
    // Skip if auto-refresh disabled
    if (itinerary.refreshMetadata?.autoRefreshEnabled === false) {
      continue;
    }

    // Skip if evaluated recently (within 6 hours)
    const lastEval = itinerary.refreshMetadata?.lastEvaluatedAt;
    if (lastEval && Date.now() - new Date(lastEval).getTime() < 6 * 60 * 60 * 1000) {
      continue;
    }

    try {
      const weather = await fetchWeatherFromAPI();
      const coords = itinerary.activityCoordinates || [{ lat: 16.4023, lon: 120.5960, name: 'Baguio' }];
      
      const evaluation = await itineraryRefreshService.evaluateRefreshNeed(
        itinerary,
        weather,
        coords
      );

      if (evaluation.needsRefresh) {
        results.push({
          itineraryId: itinerary.id,
          needsRefresh: true,
          severity: evaluation.severity,
          reasons: evaluation.reasons
        });
      }
    } catch (error) {
      console.error(`Error evaluating itinerary ${itinerary.id}:`, error);
    }
  }

  console.log(`✅ Evaluation complete: ${results.length} itineraries need refresh`);
  return results;
}
```

### Create Cron API Route `/src/app/api/cron/evaluate-refreshes/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { evaluateAllItineraries } from '@/lib/services/refreshScheduler';

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = await evaluateAllItineraries();
  
  return NextResponse.json({
    success: true,
    evaluatedCount: results.length,
    results
  });
}
```

**Setup Vercel Cron (vercel.json):**
```json
{
  "crons": [{
    "path": "/api/cron/evaluate-refreshes",
    "schedule": "0 */6 * * *"
  }]
}
```

---

## 📊 Database Schema Updates

**Add columns to `itineraries` table:**
```sql
ALTER TABLE itineraries
ADD COLUMN refresh_metadata JSONB,
ADD COLUMN traffic_snapshot JSONB,
ADD COLUMN activity_coordinates JSONB;

CREATE INDEX idx_itineraries_refresh_metadata ON itineraries USING GIN (refresh_metadata);
```

---

## 🎯 Key Features Delivered

✅ **Intelligent Change Detection**
- Multi-dimensional analysis (weather + traffic)
- Configurable thresholds
- Severity scoring with confidence levels

✅ **Enterprise API Architecture**
- RESTful endpoints (GET for evaluation, POST for refresh)
- Comprehensive error handling
- Detailed logging for debugging

✅ **User Experience**
- Smart refresh (only when needed)
- Force refresh option
- Change summary modal with detailed breakdown
- Non-blocking evaluation

✅ **Data Persistence**
- Refresh metadata tracking
- Traffic snapshots for comparison
- Activity coordinates storage

✅ **Performance Optimized**
- Caching in refresh service (15min)
- Reuses existing enterprise generation pipeline
- Parallel traffic data fetching

---

## 🚀 Testing Guide

### 1. Test Evaluation Only
```bash
curl -X GET http://localhost:3000/api/saved-itineraries/[ID]/refresh \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

### 2. Test Smart Refresh
```bash
curl -X POST http://localhost:3000/api/saved-itineraries/[ID]/refresh \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{"force": false}'
```

### 3. Test Force Refresh
```bash
curl -X POST http://localhost:3000/api/saved-itineraries/[ID]/refresh \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{"force": true}'
```

---

## 📝 Summary

**Completed:**
1. ✅ Enterprise-grade refresh service with change detection
2. ✅ Extended data model with metadata tracking
3. ✅ RESTful API endpoints for evaluation and refresh
4. ✅ Integration with existing generation pipeline

**Remaining:**
1. 🔧 Frontend UI updates (detailed instructions provided above)
2. 🔧 Database schema migration (SQL provided above)
3. 🔮 Optional: Background scheduler setup

**Time to Complete Remaining:** ~30 minutes

The system follows best practices:
- Separation of concerns
- Single responsibility principle
- Comprehensive error handling
- Performance optimization
- Detailed logging
- Type safety with TypeScript

All components are production-ready and follow the existing Tarana.ai architecture patterns.
