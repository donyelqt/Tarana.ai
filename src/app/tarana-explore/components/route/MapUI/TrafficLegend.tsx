'use client';

import React from 'react';
import { RouteTrafficAnalysis, TrafficLevel } from '@/types/route-optimization';
import { TrafficCone } from 'lucide-react';

interface TrafficLegendProps {
  trafficConditions: RouteTrafficAnalysis | null;
}

const trafficColorMap: Record<TrafficLevel, string> = {
  VERY_LOW: 'bg-emerald-400',
  LOW: 'bg-green-500',
  MODERATE: 'bg-yellow-500',
  HIGH: 'bg-orange-500',
  SEVERE: 'bg-red-500',
};

export default function TrafficLegend({ trafficConditions }: TrafficLegendProps) {
  if (!trafficConditions) return null;

  const trafficColor = trafficColorMap[trafficConditions.overallTrafficLevel] || 'bg-gray-500';

  return (
    <div className="absolute top-4 left-4 w-48">
      <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200 shadow-sm p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-2.5 h-2.5 rounded-full ${trafficColor}`}></div>
            <div className="text-sm font-medium text-gray-900 capitalize">{trafficConditions.overallTrafficLevel.toLowerCase()}</div>
          </div>
          <TrafficCone className="h-4 w-4 text-gray-400" />
        </div>
        <p className="text-xs text-gray-500 mt-1.5">
          Congestion: {trafficConditions.congestionScore}/100
        </p>
      </div>
    </div>
  );
}
