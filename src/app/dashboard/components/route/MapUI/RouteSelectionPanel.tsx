'use client';

import React from 'react';
import { RouteData, RouteTrafficAnalysis } from '@/types/route-optimization';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Clock, MapPin } from 'lucide-react';

interface RouteSelectionPanelProps {
  currentRoute: RouteData | null;
  alternativeRoutes: RouteData[];
  trafficConditions: RouteTrafficAnalysis | null;
  onRouteSelect: (routeId: string) => void;
}

export default function RouteSelectionPanel({ currentRoute, alternativeRoutes, trafficConditions, onRouteSelect }: RouteSelectionPanelProps) {
  if (!currentRoute) return null;

  // Create unique routes array with deduplication
  const allRoutes = React.useMemo(() => {
    const routes = [currentRoute];
    
    // Filter out alternatives that have the same ID as current route
    const uniqueAlternatives = alternativeRoutes.filter(
      altRoute => altRoute.id !== currentRoute.id
    );
    
    return [...routes, ...uniqueAlternatives];
  }, [currentRoute, alternativeRoutes]);

  return (
    <div className="absolute bottom-2 sm:bottom-4 left-1/2 transform -translate-x-1/2 w-full max-w-sm sm:max-w-none sm:w-auto px-2 sm:px-0">
      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-white/90 backdrop-blur-sm rounded-full border border-gray-200 shadow-lg">
        {allRoutes.map((route, index) => {
          const isPrimary = index === 0;
          // Create unique key combining route ID and position to prevent duplicates
          const uniqueKey = `${route.id}-${isPrimary ? 'primary' : `alt-${index}`}`;
          
          return (
            <Button
              key={uniqueKey}
              variant="ghost"
              className={`h-6 sm:h-8 px-2 sm:px-3 text-xs font-medium transition-all duration-200 rounded-full cursor-pointer ${
                isPrimary 
                  ? 'bg-blue-500 text-white hover:bg-blue-600 border border-blue-600 shadow-md' 
                  : 'bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 border border-gray-200'
              }`}
              onClick={() => onRouteSelect(route.id)}
            >
              <div className="flex items-center space-x-1 sm:space-x-1.5">
                <span className="text-xs font-semibold">
                  {isPrimary ? 'Primary' : `Alt ${index}`}
                </span>
                <div className="hidden sm:flex items-center space-x-1 text-xs opacity-80">
                  <Clock className="w-3 h-3" />
                  <span>{Math.round(route.summary?.travelTimeInSeconds / 60) || 0}m</span>
                  <MapPin className="w-3 h-3 ml-1" />
                  <span>{Math.round(route.summary?.lengthInMeters / 1000) || 0}km</span>
                </div>
                {/* Mobile: Show only time */}
                <div className="sm:hidden flex items-center space-x-1 text-xs opacity-80">
                  <Clock className="w-2.5 h-2.5" />
                  <span>{Math.round(route.summary?.travelTimeInSeconds / 60) || 0}m</span>
                </div>
              </div>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
