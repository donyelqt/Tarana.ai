/**
 * Regression tests for useRouteCalculation.refreshTraffic.
 *
 * Defect: refreshTraffic performed fetch() INSIDE a setState updater, which
 * React StrictMode double-invokes in dev — firing the traffic request twice
 * per 5-minute tick. The fix reads state outside the updater (ref mirror),
 * so one invocation always equals exactly one fetch.
 */

import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { useRouteCalculation } from '../useRouteCalculation'
import type { LocationPoint } from '@/types/route-optimization'

const fetchMock = global.fetch as unknown as jest.Mock

const ORIGIN: LocationPoint = {
  id: 'origin',
  name: 'Origin',
  address: 'Origin Addr',
  lat: 16.4088,
  lng: 120.5979,
}

const DESTINATION: LocationPoint = {
  id: 'destination',
  name: 'Destination',
  address: 'Destination Addr',
  lat: 16.4158,
  lng: 120.6122,
}

const PRIMARY_ROUTE = {
  id: 'route-123',
  summary: {},
  legs: [],
  geometry: {},
  instructions: [],
} as unknown as import('@/types/route-optimization').RouteData

const INITIAL_TRAFFIC = {
  overallTrafficLevel: 'LOW',
  congestionScore: 20,
} as unknown as import('@/types/route-optimization').RouteTrafficAnalysis

const REFRESHED_TRAFFIC = {
  overallTrafficLevel: 'HIGH',
  congestionScore: 80,
} as unknown as import('@/types/route-optimization').RouteTrafficAnalysis

const StrictModeWrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(React.StrictMode, null, children)

/** Seed the hook with a current route via calculate(). */
async function seedWithRoute(result: { current: ReturnType<typeof useRouteCalculation> }) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      primaryRoute: PRIMARY_ROUTE,
      alternativeRoutes: [],
      trafficAnalysis: INITIAL_TRAFFIC,
    }),
  })
  await act(async () => {
    await result.current.calculate({
      origin: ORIGIN,
      destination: DESTINATION,
      preferences: { routeType: 'fastest', vehicleType: 'car' },
    } as never)
  })
  expect(result.current.state.currentRoute?.id).toBe('route-123')
  fetchMock.mockClear()
}

describe('useRouteCalculation.refreshTraffic', () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it('performs zero fetches when there is no current route', async () => {
    const { result } = renderHook(() => useRouteCalculation())
    expect(result.current.state.currentRoute).toBeNull()

    await act(async () => {
      await result.current.refreshTraffic()
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('one invocation → exactly one fetch to the right URL (StrictMode-safe)', async () => {
    const { result } = renderHook(() => useRouteCalculation(), {
      wrapper: StrictModeWrapper,
    })
    await seedWithRoute(result)

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => REFRESHED_TRAFFIC,
    })

    await act(async () => {
      await result.current.refreshTraffic()
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/routes/traffic-analysis/route-123')
    expect(result.current.state.trafficConditions).toEqual(REFRESHED_TRAFFIC)
    expect(result.current.state.lastUpdated).not.toBeNull()
  })

  it('two invocations → exactly two fetches (no StrictMode doubling)', async () => {
    const { result } = renderHook(() => useRouteCalculation(), {
      wrapper: StrictModeWrapper,
    })
    await seedWithRoute(result)

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => REFRESHED_TRAFFIC,
    })

    await act(async () => {
      await result.current.refreshTraffic()
    })
    await act(async () => {
      await result.current.refreshTraffic()
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('failed fetch leaves state untouched and does not throw', async () => {
    const { result } = renderHook(() => useRouteCalculation())
    await seedWithRoute(result)

    const beforeTraffic = result.current.state.trafficConditions
    const beforeUpdated = result.current.state.lastUpdated

    fetchMock.mockRejectedValueOnce(new Error('network down'))

    await expect(
      act(async () => {
        await result.current.refreshTraffic()
      }),
    ).resolves.not.toThrow()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current.state.trafficConditions).toBe(beforeTraffic)
    expect(result.current.state.lastUpdated).toBe(beforeUpdated)
  })

  it('non-ok response leaves state untouched and does not throw', async () => {
    const { result } = renderHook(() => useRouteCalculation())
    await seedWithRoute(result)

    const beforeTraffic = result.current.state.trafficConditions

    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => null })

    await expect(
      act(async () => {
        await result.current.refreshTraffic()
      }),
    ).resolves.not.toThrow()

    expect(result.current.state.trafficConditions).toBe(beforeTraffic)
  })
})
