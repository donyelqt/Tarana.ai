/**
 * Traffic Legend Component
 * Displays traffic color coding and information for user awareness
 */

import React from 'react';
import { TRAFFIC_LEVEL_INFO, formatTrafficDelay, getTrafficRecommendation } from '@/lib/utils/trafficColors';
import { TrafficLevel } from '@/types/route-optimization';

interface TrafficLegendProps {
  className?: string;
  showRecommendations?: boolean;
  compact?: boolean;
  currentTrafficLevel?: TrafficLevel;
  estimatedDelay?: number;
}

export function TrafficLegend({ 
  className = '', 
  showRecommendations = true,
  compact = false,
  currentTrafficLevel,
  estimatedDelay
}: TrafficLegendProps) {
  const trafficLevels = Object.values(TRAFFIC_LEVEL_INFO);

  if (compact) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border p-3 ${className}`}>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Traffic Legend</h4>
        <div className="flex flex-wrap gap-2">
          {trafficLevels.map((info) => (
            <div
              key={info.level}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                currentTrafficLevel === info.level ? 'ring-2 ring-blue-500' : ''
              }`}
              style={{ backgroundColor: info.colors.backgroundColor }}
            >
              <span className="text-sm">{info.icon}</span>
              <span style={{ color: info.colors.textColor }} className="font-medium">
                {info.label}
              </span>
            </div>
          ))}
        </div>
        
        {currentTrafficLevel && estimatedDelay && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Current Delay:</span>
              <span className="font-medium text-gray-900">
                {formatTrafficDelay(estimatedDelay)}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-3 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full"></div>
        <h3 className="text-lg font-semibold text-gray-900">Traffic Conditions</h3>
      </div>

      <div className="space-y-3">
        {trafficLevels.map((info) => {
          const isCurrentLevel = currentTrafficLevel === info.level;
          const recommendation = getTrafficRecommendation(info.level);
          
          return (
            <div
              key={info.level}
              className={`p-3 rounded-lg border transition-all ${
                isCurrentLevel 
                  ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-200' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              style={{ 
                backgroundColor: isCurrentLevel ? undefined : info.colors.backgroundColor 
              }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div
                    className="w-4 h-4 rounded-full border-2"
                    style={{ 
                      backgroundColor: info.colors.color,
                      borderColor: info.colors.borderColor
                    }}
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{info.icon}</span>
                    <h4 className="font-semibold text-gray-900">{info.label}</h4>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {info.speedReduction}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">{info.description}</p>
                  
                  {showRecommendations && (
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          recommendation.priority === 'critical' ? 'bg-red-500' :
                          recommendation.priority === 'high' ? 'bg-orange-500' :
                          recommendation.priority === 'medium' ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                      />
                      <span className="text-xs text-gray-700 font-medium">
                        {recommendation.action}
                      </span>
                    </div>
                  )}
                </div>
                
                {isCurrentLevel && estimatedDelay && (
                  <div className="flex-shrink-0 text-right">
                    <div className="text-xs text-gray-500 mb-1">Current Delay</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {formatTrafficDelay(estimatedDelay)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {currentTrafficLevel && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-blue-900 mb-1">
                  Current Route Status
                </h4>
                <p className="text-sm text-blue-800">
                  {getTrafficRecommendation(currentTrafficLevel).message}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TrafficLegend;
