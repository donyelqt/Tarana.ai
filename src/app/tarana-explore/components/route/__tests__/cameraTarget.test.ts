/**
 * Regression tests for "Visit Spot does not move the map".
 *
 * The reported symptom: the arrival card renders, the DynamicIsland already
 * reads "Edit route to <spot>", yet the camera never leaves Baguio city centre.
 * Great Wall of Baguio is 5.2km from that centre, so it sat off-centre; a Cebu or
 * Manila spot sat hundreds of km off-screen entirely.
 *
 * Root cause: the recenter effect hardcoded Baguio as its fallback and was
 * triggered by the deep link, so it overrode the endpoint framing. These tests
 * pin the decision as a pure function so the priority order cannot regress.
 */

import { resolveCameraTarget, applyCameraTarget } from '../cameraTarget'

const BAGUIO_CENTER: [number, number] = [120.5934, 16.4134]
const GREAT_WALL = { lat: 16.3698, lng: 120.6116 }
const SM_SEASIDE = { lat: 10.281732, lng: 123.880608 }

const base = {
  singleZoom: 15,
  homeCenter: BAGUIO_CENTER,
  homeZoom: 12,
  maxFitZoom: 15,
}

describe('resolveCameraTarget', () => {
  it('centres on a lone destination — the deep-link case that was broken', () => {
    const target = resolveCameraTarget({ ...base, origin: null, destination: GREAT_WALL })

    expect(target).toEqual({
      kind: 'center',
      center: [GREAT_WALL.lng, GREAT_WALL.lat],
      zoom: 15,
    })
  })

  it('never falls back to home while any endpoint is selected', () => {
    // The exact regression: a selected spot must never resolve to 'home'.
    for (const destination of [GREAT_WALL, SM_SEASIDE]) {
      expect(resolveCameraTarget({ ...base, destination }).kind).not.toBe('home')
    }
    expect(resolveCameraTarget({ ...base, origin: GREAT_WALL, destination: null }).kind).not.toBe('home')
    expect(
      resolveCameraTarget({ ...base, origin: null, destination: null, waypoints: [GREAT_WALL] }).kind,
    ).not.toBe('home')
  })

  it('frames a Cebu spot hundreds of km away instead of parking on Baguio', () => {
    const target = resolveCameraTarget({ ...base, destination: SM_SEASIDE })

    expect(target.kind).toBe('center')
    if (target.kind !== 'center') throw new Error('unreachable')
    // Not the home centre — the camera must actually travel.
    expect(target.center).not.toEqual(BAGUIO_CENTER)
    expect(target.center[0]).toBeCloseTo(123.880608, 5)
    expect(target.center[1]).toBeCloseTo(10.281732, 5)
  })

  it('fits bounds when both endpoints exist', () => {
    const target = resolveCameraTarget({ ...base, origin: GREAT_WALL, destination: SM_SEASIDE })

    expect(target.kind).toBe('fitBounds')
    if (target.kind !== 'fitBounds') throw new Error('unreachable')
    expect(target.points).toHaveLength(2)
  })

  it('prefers an active route over raw endpoints', () => {
    const route: [number, number][] = [
      [120.6, 16.4],
      [120.7, 16.5],
      [120.8, 16.6],
    ]
    const target = resolveCameraTarget({
      ...base,
      origin: GREAT_WALL,
      destination: SM_SEASIDE,
      routeCoords: route,
    })

    expect(target.kind).toBe('fitBounds')
    if (target.kind !== 'fitBounds') throw new Error('unreachable')
    expect(target.points).toEqual(route)
  })

  it('routes route-mode empties home to Baguio — the unchanged fallback', () => {
    // Pins the fallthrough at cameraTarget.ts:83 (`return { kind: 'home' }`):
    // route mode with nothing selected must still ease to Baguio.
    expect(resolveCameraTarget({ ...base, origin: null, destination: null }).kind).toBe('home')
    expect(
      resolveCameraTarget({ ...base, origin: null, destination: null, planMode: false }).kind,
    ).toBe('home')
  })

  it('plan-on with no generated plan holds instead of sliding home to Baguio', () => {
    // "No plan yet": planMode on, no planRoute endpoints, no waypoints, no
    // currentRoute geometry. Fails on the old `{ kind: 'home' }` fallthrough.
    const target = resolveCameraTarget({ ...base, origin: null, destination: null, planMode: true })

    expect(target).toEqual({ kind: 'hold' })
  })

  it('plan-on with an unresolvable day (zero resolved stops) holds Day 1 view', () => {
    // Twin case: the day published [] so planRoute is null — switching tabs
    // must hold, not slide home. Same empty shape, planMode on.
    const target = resolveCameraTarget({
      ...base,
      origin: null,
      destination: null,
      waypoints: [],
      routeCoords: [],
      planMode: true,
    })

    expect(target.kind).toBe('hold')
    expect(target.kind).not.toBe('home')
  })

  it('ignores endpoints with non-finite coordinates instead of centring on 0,0', () => {
    const target = resolveCameraTarget({
      ...base,
      origin: null,
      destination: { lat: NaN, lng: NaN },
    })

    expect(target.kind).toBe('home')
  })
})

describe('applyCameraTarget', () => {
  const opts = { homeCenter: BAGUIO_CENTER, homeZoom: 12, maxFitZoom: 15 }

  afterEach(() => {
    delete (window as unknown as { tt?: unknown }).tt
  })

  it('easeTo the destination for a centre target, without needing LngLatBounds', () => {
    // The single-point path must work even when the SDK does not expose the
    // bounds class — that gate is what made the original easeTo skip silently.
    const easeTo = jest.fn()
    const applied = applyCameraTarget(
      { easeTo },
      { kind: 'center', center: [123.880608, 10.281732], zoom: 15 },
      opts,
    )

    expect(applied).toBe(true)
    expect(easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [123.880608, 10.281732], zoom: 15 }),
    )
  })

  it('falls back to centring the first point when LngLatBounds is unavailable', () => {
    const easeTo = jest.fn()
    const fitBounds = jest.fn()
    applyCameraTarget({ easeTo, fitBounds }, { kind: 'fitBounds', points: [[1, 2]] }, opts)

    expect(fitBounds).not.toHaveBeenCalled()
    expect(easeTo).toHaveBeenCalledWith(expect.objectContaining({ center: [1, 2] }))
  })

  it('fits real bounds when the SDK exposes LngLatBounds', () => {
    const extend = jest.fn()
    ;(window as unknown as Record<string, unknown>).tt = {
      LngLatBounds: class {
        extend = extend
      },
    }

    const fitBounds = jest.fn()
    applyCameraTarget({ fitBounds }, { kind: 'fitBounds', points: [[1, 2], [3, 4]] }, opts)

    expect(extend).toHaveBeenCalledTimes(2)
    expect(fitBounds).toHaveBeenCalled()
  })

  it('is a no-op without a map rather than throwing', () => {
    expect(applyCameraTarget(null, { kind: 'home' }, opts)).toBe(false)
    expect(applyCameraTarget(undefined, { kind: 'home' }, opts)).toBe(false)
  })

  it('home target returns to Baguio centre', () => {
    const easeTo = jest.fn()
    applyCameraTarget({ easeTo }, { kind: 'home' }, opts)

    expect(easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: BAGUIO_CENTER, zoom: 12 }),
    )
  })

  it('hold target makes no camera call so the Cebu view stays', () => {
    const easeTo = jest.fn()
    const fitBounds = jest.fn()
    const applied = applyCameraTarget({ easeTo, fitBounds }, { kind: 'hold' }, opts)

    expect(applied).toBe(false)
    expect(easeTo).not.toHaveBeenCalled()
    expect(fitBounds).not.toHaveBeenCalled()
  })
})