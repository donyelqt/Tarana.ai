'use client';

import React from 'react';
import { RouteTrafficAnalysis } from '@/types/route-optimization';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gauge, TrafficCone } from 'lucide-react';

interface TrafficLegendProps {
  trafficConditions: RouteTrafficAnalysis | null;
}

const trafficColorMap = {
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
      <Card className="shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-2.5 h-2.5 rounded-full ${trafficColor}`}></div>
              <div className="text-sm font-medium capitalize">{trafficConditions.overallTrafficLevel.toLowerCase()}</div>
            </div>
            <TrafficCone className="h-3 w-3 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Congestion: {trafficConditions.congestionScore}/100
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
