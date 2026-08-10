"use client"

import React, { useState } from 'react'
import {
  Clock,
  MapPin,
  TrendingUp,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Zap,
  X,
} from 'lucide-react'
import {
  RouteData,
  RouteTrafficAnalysis,
  RouteComparison,
  TrafficLevel,
} from '@/types/route-optimization'

interface BottomRouteSheetProps {
  currentRoute: RouteData | null
  trafficAnalysis: RouteTrafficAnalysis | null
  routeComparison: RouteComparison | null
  alternatives: RouteData[]
  onSelectAlternative: (routeId: string) => void
  onClose: () => void
  lastUpdated: Date | null
}

const formatDuration = (seconds: number): string => {
  if (!seconds || seconds < 0) return '—'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m}m`
}

const formatDistance = (meters: number): string => {
  if (!meters || meters < 0) return '—'
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

const formatArrival = (seconds: number): string => {
  const now = Date.now()
  const arrival = new Date(now + seconds * 1000)
  return arrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

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

const BottomRouteSheet: React.FC<BottomRouteSheetProps> = ({
  currentRoute,
  trafficAnalysis,
  routeComparison,
  alternatives,
  onSelectAlternative,
  onClose,
  lastUpdated,
}) => {
  const [expanded, setExpanded] = useState(false)

  if (!currentRoute) return null

  const summary = currentRoute.summary
  const trafficColor = trafficAnalysis
    ? TRAFFIC_COLORS[trafficAnalysis.overallTrafficLevel]
    : 'bg-gray-300'

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
      <div className="mx-auto max-w-2xl px-3 pb-3 pointer-events-auto">
        <div className="bg-white rounded-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.18)] border border-gray-200 overflow-hidden">
          {/* Drag handle */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex justify-center pt-2 pb-1 hover:bg-gray-50 transition-colors"
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </button>

          {/* Primary summary row — Google Maps style */}
          <div className="px-4 pt-2 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${trafficColor}`} />
                <span className="text-xs font-semibold text-gray-700">
                  {trafficAnalysis
                    ? `${TRAFFIC_LABELS[trafficAnalysis.overallTrafficLevel]} traffic`
                    : 'Traffic unknown'}
                </span>
              </div>
              <div className="flex-1" />
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                aria-label="Close route"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-2 flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold text-gray-900">
                {formatDuration(summary.travelTimeInSeconds)}
              </span>
              <span className="text-sm text-gray-500">·</span>
              <span className="text-sm text-gray-700">
                {formatDistance(summary.lengthInMeters)}
              </span>
              <span className="text-sm text-gray-500">·</span>
              <span className="text-sm text-gray-700">
                arrive {formatArrival(summary.travelTimeInSeconds)}
              </span>
              {summary.trafficDelayInSeconds > 0 && (
                <>
                  <span className="text-sm text-gray-500">·</span>
                  <span className="text-sm text-red-600 font-medium">
                    +{formatDuration(summary.trafficDelayInSeconds)} delay
                  </span>
                </>
              )}
            </div>

            {/* Alternatives pill bar */}
            {alternatives.length > 0 && (
              <div className="mt-3 flex items-center gap-1.5 overflow-x-auto -mx-1 px-1">
                <button
                  type="button"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-600 text-white text-xs font-medium flex-shrink-0"
                  title="Best route"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  Best
                </button>
                {alternatives.map((alt, i) => (
                  <button
                    key={alt.id}
                    type="button"
                    onClick={() => onSelectAlternative(alt.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium flex-shrink-0 transition-colors"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                    {formatDuration(alt.summary.travelTimeInSeconds)} · {formatDistance(alt.summary.lengthInMeters)}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 flex items-center justify-between w-full text-xs font-medium text-gray-600 hover:text-gray-900"
            >
              <span>{expanded ? 'Hide details' : 'Show details'}</span>
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>

          {/* Expanded details */}
          {expanded && (
            <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-gray-50/50">
              {routeComparison && (
                <div className="flex items-start gap-2.5">
                  <Zap className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">Why this route</div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      {routeComparison.recommendation.message}
                    </div>
                    {routeComparison.recommendation.timeSavings && (
                      <div className="text-xs text-green-700 font-medium mt-1">
                        Saves {routeComparison.recommendation.timeSavings} min vs alternatives
                      </div>
                    )}
                  </div>
                </div>
              )}

              {trafficAnalysis && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white rounded-lg p-2.5 border border-gray-100">
                    <div className="flex items-center gap-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">
                      <TrendingUp className="w-3 h-3" />
                      <span>Congestion</span>
                    </div>
                    <div className="text-sm font-bold text-gray-900">
                      {trafficAnalysis.congestionScore}%
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-2.5 border border-gray-100">
                    <div className="flex items-center gap-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">
                      <Clock className="w-3 h-3" />
                      <span>Delay</span>
                    </div>
                    <div className="text-sm font-bold text-gray-900">
                      {formatDuration(trafficAnalysis.estimatedDelay)}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-2.5 border border-gray-100">
                    <div className="flex items-center gap-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">
                      <MapPin className="w-3 h-3" />
                      <span>Incidents</span>
                    </div>
                    <div className="text-sm font-bold text-gray-900">
                      {trafficAnalysis.segmentAnalysis.reduce(
                        (s, seg) => s + seg.incidents.length,
                        0,
                      )}
                    </div>
                  </div>
                </div>
              )}

              {lastUpdated && (
                <div className="text-[10px] text-gray-400 text-center pt-1">
                  Updated {lastUpdated.toLocaleTimeString()} · refreshes every 5 min
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BottomRouteSheet
