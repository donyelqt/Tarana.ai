"use client"

import React from 'react'
import { RouteTrafficAnalysis, TrafficLevel } from '@/types/route-optimization'

const TRAFFIC_COLORS: Record<TrafficLevel, string> = {
  VERY_LOW: 'bg-emerald-500',
  LOW: 'bg-green-500',
  MODERATE: 'bg-yellow-500',
  HIGH: 'bg-orange-500',
  SEVERE: 'bg-red-500',
}

const TRAFFIC_LABELS: Record<TrafficLevel, string> = {
  VERY_LOW: 'Very low',
  LOW: 'Low',
  MODERATE: 'Moderate',
  HIGH: 'Heavy',
  SEVERE: 'Severe',
}

const TrafficBadge: React.FC<{ trafficConditions: RouteTrafficAnalysis | null }> = ({
  trafficConditions,
}) => {
  if (!trafficConditions) return null
  const color = TRAFFIC_COLORS[trafficConditions.overallTrafficLevel] ?? 'bg-gray-400'
  return (
    <div className="absolute top-3 left-3 z-20 pointer-events-none">
      <div className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-full shadow-md border border-gray-200 px-3 py-1.5 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-xs font-semibold text-gray-900">
          {TRAFFIC_LABELS[trafficConditions.overallTrafficLevel]} traffic
        </span>
      </div>
    </div>
  )
}

export default TrafficBadge
