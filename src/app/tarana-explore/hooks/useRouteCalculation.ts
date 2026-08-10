"use client"

import { useState, useCallback, useRef } from 'react'
import {
  RouteRequest,
  RouteData,
  LocationPoint,
  RoutePreferences,
  RouteTrafficAnalysis,
  RouteComparison,
} from '@/types/route-optimization'

export interface RouteCalculationState {
  currentRoute: RouteData | null
  alternativeRoutes: RouteData[]
  trafficConditions: RouteTrafficAnalysis | null
  routeComparison: RouteComparison | null
  isCalculating: boolean
  error: string | null
  lastUpdated: Date | null
}

const initialState: RouteCalculationState = {
  currentRoute: null,
  alternativeRoutes: [],
  trafficConditions: null,
  routeComparison: null,
  isCalculating: false,
  error: null,
  lastUpdated: null,
}

/**
 * Owns all route-calculation state and the call to /api/routes/calculate.
 * Pure orchestration — no UI.
 */
export function useRouteCalculation() {
  const [state, setState] = useState<RouteCalculationState>(initialState)
  const abortRef = useRef<NodeJS.Timeout | null>(null)

  const calculate = useCallback(async (request: RouteRequest) => {
    if (!request.origin || !request.destination) return

    setState({
      ...initialState,
      isCalculating: true,
    })

    try {
      const response = await fetch('/api/routes/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        throw new Error(`Route calculation failed: ${response.statusText}`)
      }

      const data = await response.json()

      const comparison: RouteComparison | null =
        data.alternativeRoutes?.length > 0
          ? {
              routes: [data.primaryRoute, ...data.alternativeRoutes],
              trafficAnalyses: [
                data.trafficAnalysis,
                ...(data.alternativeAnalyses || []),
              ],
              recommendation: data.recommendations?.[0] || {
                type: 'primary',
                reason: 'Best available route',
                message: 'Recommended based on current traffic conditions',
                priority: 'medium',
              },
              bestRouteId: data.primaryRoute.id,
              comparisonMetrics: data.comparisonMetrics || {
                timeDifference: 0,
                distanceDifference: 0,
                trafficScore: data.trafficAnalysis?.congestionScore ?? 50,
              },
            }
          : null

      setState({
        currentRoute: data.primaryRoute,
        alternativeRoutes: data.alternativeRoutes ? [...data.alternativeRoutes] : [],
        trafficConditions: data.trafficAnalysis ?? null,
        routeComparison: comparison,
        isCalculating: false,
        error: null,
        lastUpdated: new Date(),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Route calculation failed'
      setState({
        ...initialState,
        error: message,
      })
    }
  }, [])

  /**
   * Promote an alternative to the primary slot while preserving the others.
   * Mirrors Google's behaviour where tapping an alternative route makes it the active one.
   */
  const selectAlternative = useCallback((routeId: string) => {
    setState((prev) => {
      if (!prev.currentRoute || prev.currentRoute.id === routeId) return prev

      const all = [prev.currentRoute, ...prev.alternativeRoutes]
      const target = all.find((r) => r.id === routeId)
      if (!target) return prev

      const newAlternatives = all.filter((r) => r.id !== routeId)

      return {
        ...prev,
        currentRoute: target,
        alternativeRoutes: newAlternatives,
        routeComparison: prev.routeComparison
          ? { ...prev.routeComparison, bestRouteId: routeId }
          : prev.routeComparison,
      }
    })
  }, [])

  const clear = useCallback(() => setState(initialState), [])

  /**
   * Patch the current traffic analysis (used by the 5-minute auto-refresh).
   */
  const refreshTraffic = useCallback(async () => {
    setState((prev) => {
      if (!prev.currentRoute) return prev
      const routeId = prev.currentRoute.id
      // Fire-and-forget fetch — we don't await in setState
      fetch(`/api/routes/traffic-analysis/${routeId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((trafficData) => {
          if (!trafficData) return
          setState((p) => ({
            ...p,
            trafficConditions: trafficData,
            lastUpdated: new Date(),
          }))
        })
        .catch(() => {
          /* silent — refresh is best-effort */
        })
      return prev
    })
  }, [])

  return {
    state,
    calculate,
    selectAlternative,
    refreshTraffic,
    clear,
  }
}

export type { RoutePreferences, LocationPoint, RouteRequest }
