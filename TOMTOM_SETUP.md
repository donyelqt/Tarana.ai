# TomTom Traffic API Integration Setup

This document outlines the setup and configuration for TomTom Traffic API integration in the Tarana.ai itinerary generator.

## Overview

The TomTom Traffic API integration provides real-time traffic data to enhance itinerary recommendations by:
- Fetching current traffic flow conditions
- Monitoring traffic incidents and road closures
- Calculating congestion scores for activity locations
- Providing traffic-aware timing recommendations

## API Endpoints Used

### 1. Traffic Flow API
- **Endpoint**: `https://api.tomtom.com/traffic/services/4/flowSegmentData/{style}/{zoom}/{format}`
- **Purpose**: Get real-time traffic flow data including speed and congestion
- **Parameters**:
  - `point`: Latitude,longitude coordinates
  - `unit`: Speed unit (KMPH)
  - `thickness`: Road thickness for visualization
  - `key`: API key

### 2. Traffic Incidents API
- **Endpoint**: `https://api.tomtom.com/traffic/services/5/incidentDetails/{style}/{bbox}/{zoom}/{format}`
- **Purpose**: Get traffic incidents, road closures, and delays
- **Parameters**:
  - `bbox`: Bounding box around location
  - `fields`: Incident details to include
  - `language`: Response language
  - `key`: API key

## Environment Variables

Add the following to your `.env.local` file:

```bash
TOMTOM_API_KEY=your_tomtom_api_key_here
```

## Getting a TomTom API Key

1. Visit [TomTom Developer Portal](https://developer.tomtom.com/)
2. Sign up for a free account
3. Create a new application
4. Copy the API key from your dashboard
5. Add it to your environment variables

## Rate Limits

- **Free Tier**: 2,500 requests per day
- **Paid Tiers**: Higher limits available
- **Caching**: 5-minute cache implemented to reduce API calls

## Implementation Files

- `src/lib/tomtomTraffic.ts` - Core TomTom API service
- `src/lib/agenticTrafficAnalyzer.ts` - AI-powered traffic analysis
- `src/lib/baguioCoordinates.ts` - Baguio activity coordinates
- `src/lib/trafficAwareActivitySearch.ts` - Traffic-enhanced activity search
- `src/app/api/traffic-test/route.ts` - Test endpoint for traffic integration

## Testing

Use the test endpoint to verify integration:
```
GET /api/traffic-test
```

This will test traffic data fetching for sample Baguio locations and display results.

## Features

### Real-time Traffic Analysis
- Current traffic flow conditions
- Congestion scoring (0-100 scale)
- Traffic level classification (LOW/MODERATE/HIGH/SEVERE)

### Agentic AI Integration
- Combines real-time traffic with hardcoded peak hours
- AI-powered traffic analysis and recommendations
- Multi-dimensional scoring algorithm
- Personalized timing suggestions

### Activity Enhancement
- Traffic-aware activity filtering
- Real-time traffic insights in descriptions
- Optimal timing recommendations
- Traffic-based activity sorting

## Monitoring

The system includes comprehensive logging for:
- API request/response cycles
- Traffic data processing
- Agentic AI analysis steps
- Activity enhancement pipeline
- Error handling and fallbacks

## Error Handling

- Graceful fallback when API is unavailable
- Cached data usage during outages
- Default traffic assumptions for missing data
- Comprehensive error logging
