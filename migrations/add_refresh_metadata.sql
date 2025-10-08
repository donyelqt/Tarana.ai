-- ============================================================================
-- Migration: Add Refresh Metadata to Itineraries Table
-- Description: Adds columns for tracking itinerary refresh state and metadata
-- Author: Tarana.ai Engineering Team
-- Date: 2025-01-09
-- ============================================================================

-- Add new columns for refresh functionality
ALTER TABLE itineraries
ADD COLUMN IF NOT EXISTS refresh_metadata JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS traffic_snapshot JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS activity_coordinates JSONB DEFAULT NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_itineraries_refresh_metadata 
ON itineraries USING GIN (refresh_metadata);

CREATE INDEX IF NOT EXISTS idx_itineraries_traffic_snapshot 
ON itineraries USING GIN (traffic_snapshot);

CREATE INDEX IF NOT EXISTS idx_itineraries_activity_coordinates 
ON itineraries USING GIN (activity_coordinates);

-- Add index for filtering by auto-refresh status
CREATE INDEX IF NOT EXISTS idx_itineraries_auto_refresh 
ON itineraries ((refresh_metadata->>'autoRefreshEnabled'));

-- Add index for filtering by refresh status
CREATE INDEX IF NOT EXISTS idx_itineraries_refresh_status 
ON itineraries ((refresh_metadata->>'status'));

-- Add index for filtering by last evaluated date
CREATE INDEX IF NOT EXISTS idx_itineraries_last_evaluated 
ON itineraries ((refresh_metadata->>'lastEvaluatedAt'));

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON COLUMN itineraries.refresh_metadata IS 
'JSONB containing refresh tracking data: lastEvaluatedAt, lastRefreshedAt, refreshReasons, status, weatherSnapshot, trafficSnapshot, refreshCount, autoRefreshEnabled';

COMMENT ON COLUMN itineraries.traffic_snapshot IS 
'JSONB containing traffic baseline data: averageCongestionScore, averageTrafficLevel, incidentCount, timestamp, locationSamples';

COMMENT ON COLUMN itineraries.activity_coordinates IS 
'JSONB array of activity locations: [{lat, lon, name}]';

-- ============================================================================
-- Example data structure (for reference)
-- ============================================================================

/*
refresh_metadata structure:
{
  "lastEvaluatedAt": "2025-01-09T01:30:00.000Z",
  "lastRefreshedAt": "2025-01-09T01:30:00.000Z",
  "refreshReasons": ["WEATHER_SIGNIFICANT_CHANGE", "TRAFFIC_DEGRADATION"],
  "status": "REFRESH_COMPLETED",
  "weatherSnapshot": { ... WeatherData object ... },
  "trafficSnapshot": { ... TrafficSnapshot object ... },
  "refreshCount": 2,
  "autoRefreshEnabled": true
}

traffic_snapshot structure:
{
  "averageCongestionScore": 35.5,
  "averageTrafficLevel": "MODERATE",
  "incidentCount": 2,
  "timestamp": "2025-01-09T01:30:00.000Z",
  "locationSamples": [
    {
      "lat": 16.4023,
      "lon": 120.5960,
      "trafficLevel": "LOW",
      "congestionScore": 25
    }
  ]
}

activity_coordinates structure:
[
  {
    "lat": 16.4023,
    "lon": 120.5960,
    "name": "Burnham Park"
  },
  {
    "lat": 16.4120,
    "lon": 120.5930,
    "name": "Session Road"
  }
]
*/

-- ============================================================================
-- Rollback script (if needed)
-- ============================================================================

/*
-- To rollback this migration, run:

DROP INDEX IF EXISTS idx_itineraries_last_evaluated;
DROP INDEX IF EXISTS idx_itineraries_refresh_status;
DROP INDEX IF EXISTS idx_itineraries_auto_refresh;
DROP INDEX IF EXISTS idx_itineraries_activity_coordinates;
DROP INDEX IF EXISTS idx_itineraries_traffic_snapshot;
DROP INDEX IF EXISTS idx_itineraries_refresh_metadata;

ALTER TABLE itineraries
DROP COLUMN IF EXISTS activity_coordinates,
DROP COLUMN IF EXISTS traffic_snapshot,
DROP COLUMN IF EXISTS refresh_metadata;
*/
