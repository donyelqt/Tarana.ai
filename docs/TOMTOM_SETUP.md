# TomTom API Setup for Route Optimization

This document outlines the setup and configuration for TomTom API integration in the Tarana.ai route optimization system.

## Overview

The TomTom API integration provides comprehensive routing and traffic data to power the route optimization system:
- Calculate optimal routes with multiple alternatives
- Real-time traffic flow conditions and congestion analysis
- Monitor traffic incidents and road closures
- Location search and geocoding services
- Traffic-aware route recommendations

## API Endpoints Used

### 1. Routing API
- **Endpoint**: `https://api.tomtom.com/routing/1/calculateRoute/{locations}/json`
- **Purpose**: Calculate optimal routes between locations
- **Parameters**:
  - `locations`: Origin:waypoints:destination coordinates
  - `traffic`: Enable real-time traffic data
  - `routeType`: fastest, shortest, eco, thrilling
  - `travelMode`: car, truck, motorcycle, bicycle
  - `maxAlternatives`: Number of alternative routes
  - `key`: API key

### 2. Search API
- **Endpoint**: `https://api.tomtom.com/search/2/search/{query}.json`
- **Purpose**: Search for locations and points of interest
- **Parameters**:
  - `query`: Search term
  - `limit`: Maximum results
  - `countrySet`: Country filter (PH for Philippines)
  - `lat/lon`: Center point for proximity search
  - `key`: API key

### 3. Traffic Flow API
- **Endpoint**: `https://api.tomtom.com/traffic/services/4/flowSegmentData/{style}/{zoom}/{format}`
- **Purpose**: Get real-time traffic flow data including speed and congestion
- **Parameters**:
  - `point`: Latitude,longitude coordinates
  - `unit`: Speed unit (KMPH)
  - `key`: API key

### 4. Traffic Incidents API
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

### Core Route Optimization
- `src/lib/services/tomtomRouting.ts` - TomTom routing service integration
- `src/lib/services/routeTrafficAnalysis.ts` - Route traffic analysis service
- `src/app/dashboard/components/RouteOptimizationWidget.tsx` - Main route optimization UI
- `src/components/ui/error-boundary.tsx` - Error boundary for robust error handling

### API Routes
- `src/app/api/locations/search/route.ts` - Location search endpoint
- `src/app/api/routes/calculate/route.ts` - Route calculation endpoint
- `src/app/api/routes/monitor/route.ts` - Route monitoring endpoint
- `src/app/api/routes/traffic-analysis/[id]/route.ts` - Traffic analysis endpoint

### UI Components
- `src/app/dashboard/components/route/RouteInputPanel.tsx` - Route input interface
- `src/app/dashboard/components/route/InteractiveRouteMap.tsx` - Route visualization
- `src/app/dashboard/components/route/RouteDetailsPanel.tsx` - Route details display

### Type Definitions
- `src/types/route-optimization.ts` - TypeScript interfaces for route optimization

## Testing

To test the route optimization system:

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Navigate to the dashboard** and access the Route Optimization Widget

3. **Test location search**:
   - Enter origin and destination locations
   - Verify autocomplete suggestions appear
   - Check that coordinates are properly resolved

4. **Test route calculation**:
   - Submit a route request
   - Verify primary and alternative routes are calculated
   - Check traffic analysis data is included

5. **Test error handling**:
   - Try requests without API key configured
   - Test with invalid locations
   - Verify error messages are user-friendly

## Features

### Route Calculation
- Primary route with optimal path
- Multiple alternative routes
- Real-time traffic integration
- Route comparison and recommendations

### Location Services
- Autocomplete location search
- Geocoding and reverse geocoding
- Bounding box calculations
- Distance and duration estimates

### Traffic Analysis
- Real-time traffic flow data
- Congestion scoring and classification
- Traffic incident monitoring
- Peak hour analysis and recommendations

### User Interface
- Interactive route input panel
- Visual route map (TomTom Maps SDK ready)
- Detailed route statistics and comparisons
- Real-time monitoring controls
- Comprehensive error handling with fallback UI

## Monitoring and Logging

The system includes comprehensive logging for:
- API request/response cycles
- Route calculation performance
- Traffic data processing
- Error handling and fallbacks
- User interactions and state changes

## Error Handling

- **API Key Validation**: Clear messages when TomTom API key is missing
- **Rate Limiting**: Graceful handling of API rate limits with user feedback
- **Network Errors**: Retry logic and fallback mechanisms
- **Invalid Locations**: User-friendly error messages for location issues
- **UI Error Boundaries**: Prevents crashes and provides recovery options
- **State Recovery**: Maintains user input during error scenarios
