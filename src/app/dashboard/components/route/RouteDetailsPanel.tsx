"use client"

import React, { useState } from 'react';
import { 
  RouteData,
  RouteTrafficAnalysis,
  RouteComparison,
  TrafficLevel
} from '@/types/route-optimization';
import { 
  Clock, 
  MapPin, 
  Route, 
  AlertTriangle, 
  TrendingUp, 
  Share2, 
  Bookmark, 
  Play, 
  Square,
  ChevronDown,
  ChevronUp,
  Navigation,
  Zap,
  Info,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RouteDetailsPanelProps {
  currentRoute: RouteData | null;
  alternativeRoutes: RouteData[];
  trafficAnalysis: RouteTrafficAnalysis | null;
  routeComparison: RouteComparison | null;
  onRouteSelect: (route: RouteData) => void;
  onStartMonitoring: () => void;
  onStopMonitoring: () => void;
  isMonitoring: boolean;
  showAlternatives: boolean;
  onToggleAlternatives: () => void;
  lastUpdated: Date | null;
}

const RouteDetailsPanel: React.FC<RouteDetailsPanelProps> = ({
  currentRoute,
  alternativeRoutes,
  trafficAnalysis,
  routeComparison,
  onRouteSelect,
  onStartMonitoring,
  onStopMonitoring,
  isMonitoring,
  showAlternatives,
  onToggleAlternatives,
  lastUpdated
}) => {
  const [savedRoutes, setSavedRoutes] = useState<string[]>([]);

  // Format time duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Format distance
  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  // Get traffic level color
  const getTrafficLevelColor = (level: TrafficLevel): string => {
    switch (level) {
      case 'LOW': return 'text-green-600 bg-green-100';
      case 'MODERATE': return 'text-yellow-600 bg-yellow-100';
      case 'HIGH': return 'text-orange-600 bg-orange-100';
      case 'SEVERE': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get recommendation color
  const getRecommendationColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Handle route saving
  const handleSaveRoute = (routeId: string) => {
    if (savedRoutes.includes(routeId)) {
      setSavedRoutes(prev => prev.filter(id => id !== routeId));
    } else {
      setSavedRoutes(prev => [...prev, routeId]);
    }
  };

  // Handle route sharing
  const handleShareRoute = async (route: RouteData) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Route from Tarana.ai',
          text: `Route: ${formatDuration(route.summary.travelTimeInSeconds)} (${formatDistance(route.summary.lengthInMeters)})`,
          url: window.location.href
        });
      } catch (error) {
        console.log('Error sharing route:', error);
      }
    } else {
      // Fallback: copy to clipboard
      const routeText = `Route: ${formatDuration(route.summary.travelTimeInSeconds)} (${formatDistance(route.summary.lengthInMeters)}) - ${window.location.href}`;
      navigator.clipboard.writeText(routeText);
    }
  };

  if (!currentRoute) {
    return (
      <div className="text-center py-6 sm:py-8 px-4">
        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
          <Route className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
        </div>
        <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No Route Selected</h3>
        <p className="text-sm sm:text-base text-gray-600 max-w-sm mx-auto">Calculate a route to see detailed information and traffic analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Main Route Card */}
      <div className="bg-white border-2 border-blue-200 rounded-xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 space-y-3 sm:space-y-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <Route className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-base sm:text-lg text-gray-900">Primary Route</h3>
              <p className="text-xs sm:text-sm text-gray-600">Optimized for {currentRoute.summary.routeType} travel</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={() => handleSaveRoute(currentRoute.id)}
              className={`text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-2 ${savedRoutes.includes(currentRoute.id) ? 'bg-blue-50 border-blue-300' : ''}`}
            >
              <Bookmark className={`w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 ${savedRoutes.includes(currentRoute.id) ? 'fill-current' : ''}`} />
              {savedRoutes.includes(currentRoute.id) ? 'Saved' : 'Save'}
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handleShareRoute(currentRoute)}
              className="text-xs sm:text-sm px-2 py-1 sm:px-3 sm:py-2"
            >
              <Share2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Share
            </Button>
          </div>
        </div>

        {/* Route Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-blue-50 rounded-lg p-3 sm:p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
              <span className="text-xs sm:text-sm font-medium text-blue-900">Travel Time</span>
            </div>
            <div className="text-lg sm:text-2xl font-bold text-blue-900">
              {formatDuration(currentRoute.summary.travelTimeInSeconds)}
            </div>
            {currentRoute.summary.trafficDelayInSeconds > 0 && (
              <div className="text-xs sm:text-sm text-red-600 mt-1">
                +{formatDuration(currentRoute.summary.trafficDelayInSeconds)} delay
              </div>
            )}
          </div>

          <div className="bg-green-50 rounded-lg p-3 sm:p-4">
            <div className="flex items-center space-x-2 mb-2">
              <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
              <span className="text-xs sm:text-sm font-medium text-green-900">Distance</span>
            </div>
            <div className="text-lg sm:text-2xl font-bold text-green-900">
              {formatDistance(currentRoute.summary.lengthInMeters)}
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-3 sm:p-4">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-purple-600" />
              <span className="text-xs sm:text-sm font-medium text-purple-900">Route Score</span>
            </div>
            <div className="text-lg sm:text-2xl font-bold text-purple-900">
              {trafficAnalysis?.recommendationScore || 'N/A'}
              {trafficAnalysis?.recommendationScore && '%'}
            </div>
          </div>
        </div>

        {/* Traffic Analysis */}
        {trafficAnalysis && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2 mb-3">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="font-medium text-gray-900">Traffic Analysis</span>
              {lastUpdated && (
                <span className="text-xs text-gray-500">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Traffic Level</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTrafficLevelColor(trafficAnalysis.overallTrafficLevel)}`}>
                    {trafficAnalysis.overallTrafficLevel}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Congestion</span>
                  <span className="text-sm font-medium">{trafficAnalysis.congestionScore}%</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Incidents</span>
                  <span className="text-sm font-medium">
                    {trafficAnalysis.segmentAnalysis.reduce((sum, seg) => sum + seg.incidents.length, 0)}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Recommendation</span>
                  <span className={`text-sm font-medium ${getRecommendationColor(trafficAnalysis.recommendationScore)}`}>
                    {trafficAnalysis.recommendationScore >= 80 ? 'Excellent' :
                     trafficAnalysis.recommendationScore >= 60 ? 'Good' :
                     trafficAnalysis.recommendationScore >= 40 ? 'Fair' : 'Poor'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Peak Hour Impact</span>
                  <span className="text-sm font-medium">
                    {trafficAnalysis.peakHourImpact.isCurrentlyPeakHour ? (
                      <span className="text-orange-600">Active</span>
                    ) : (
                      <span className="text-green-600">Normal</span>
                    )}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Estimated Delay</span>
                  <span className="text-sm font-medium">
                    {formatDuration(trafficAnalysis.estimatedDelay)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Route Monitoring */}
        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${isMonitoring ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
            <div>
              <div className="font-medium text-sm text-gray-900">
                Real-time Monitoring
              </div>
              <div className="text-xs text-gray-600">
                {isMonitoring ? 'Monitoring route for traffic changes' : 'Start monitoring to get live updates'}
              </div>
            </div>
          </div>
          
          <Button
            variant={isMonitoring ? "outline" : "default"}
            onClick={isMonitoring ? onStopMonitoring : onStartMonitoring}
            className="px-3 py-2 text-sm"
          >
            {isMonitoring ? (
              <>
                <Square className="w-4 h-4 mr-2" />
                Stop
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Start
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Alternative Routes */}
      {alternativeRoutes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={onToggleAlternatives}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <Navigation className="w-5 h-5 text-gray-600" />
              <div className="text-left">
                <h3 className="font-medium text-gray-900">Alternative Routes</h3>
                <p className="text-sm text-gray-600">{alternativeRoutes.length} alternatives available</p>
              </div>
            </div>
            {showAlternatives ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {showAlternatives && (
            <div className="border-t border-gray-200">
              {alternativeRoutes.map((route, index) => (
                <div key={route.id} className="p-4 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-white">{index + 2}</span>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">Route {index + 2}</h4>
                          <p className="text-xs text-gray-600">Alternative option</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Time: </span>
                          <span className="font-medium">{formatDuration(route.summary.travelTimeInSeconds)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Distance: </span>
                          <span className="font-medium">{formatDistance(route.summary.lengthInMeters)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Delay: </span>
                          <span className="font-medium">
                            {route.summary.trafficDelayInSeconds > 0 
                              ? formatDuration(route.summary.trafficDelayInSeconds)
                              : 'None'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-4 space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => onRouteSelect(route)}
                        className="px-3 py-2 text-sm"
                      >
                        Select
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Route Comparison Summary */}
      {routeComparison && (
        <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-4 border border-blue-200">
          <div className="flex items-center space-x-2 mb-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="font-medium text-gray-900">Route Recommendation</span>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-gray-700">{routeComparison.recommendation.message}</p>
            
            {routeComparison.recommendation.timeSavings && (
              <div className="flex items-center space-x-2 text-sm">
                <Clock className="w-4 h-4 text-green-600" />
                <span className="text-green-700">
                  Saves {routeComparison.recommendation.timeSavings} minutes vs alternatives
                </span>
              </div>
            )}
            
            <div className="flex items-center space-x-2 text-sm">
              <Info className="w-4 h-4 text-blue-600" />
              <span className="text-blue-700">
                {routeComparison.recommendation.trafficAdvantage}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteDetailsPanel;