/**
 * Plan Mode draws the day's route; route mode draws the user's route.
 *
 * Both read the same map props, so the only thing keeping them apart is which
 * endpoints and waypoints reach the map. A regression here is silent: the map
 * would render the user's old route while the sheet listed a plan, or overwrite
 * the user's endpoints and never give them back.

 */
import React from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExploreMapView from '../ExploreMapView'

// jsdom implements neither, and the island measures itself on mount.
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never
  global.DOMRect = class {
    constructor(
      public x = 0,
      public y = 0,
      public width = 448,
      public height = 52
    ) {}
    top = 0
    left = 0
    right = 448
    bottom = 52
    toJSON() {
      return {}
    }
  } as never
})

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

const calculateMock = jest.fn()
const clearMock = jest.fn()

jest.mock('../../hooks/useRouteCalculation', () => ({
  useRouteCalculation: () => ({
    state: {
      currentRoute: null,
      alternativeRoutes: [],
      trafficConditions: null,
      routeComparison: null,
      isCalculating: false,
      error: null,
      lastUpdated: null,
    },
    calculate: calculateMock,
    selectAlternative: jest.fn(),
    refreshTraffic: jest.fn(),
    clear: clearMock,
  }),
}))

jest.mock('../route/InteractiveRouteMap', () => ({
  __esModule: true,
  default: ({
    origin,
    destination,
    waypoints,
  }: {
    origin: { name: string } | null
    destination: { name: string } | null
    waypoints: Array<{ name: string }>
  }) => (
    <div data-testid="map">
      {JSON.stringify({
        origin: origin?.name ?? null,
        destination: destination?.name ?? null,
        waypoints: waypoints.map((w) => w.name),
      })}
    </div>
  ),
}))

let publishDayStops: ((points: Array<Record<string, unknown>>) => void) | null = null

// The lazy surface is stubbed at its boundary: this suite is about how the map
// responds to a published day, not about the surface's own resolution.
jest.mock('../PlanModeSurface', () => ({
  __esModule: true,
  default: ({
    islandSlot,
    onDayStops,
  }: {
    islandSlot: HTMLElement | null
    onDayStops?: (points: Array<Record<string, unknown>>) => void
  }) => {
    // Register on every render, slot or not: the slot only exists after the
    // island mounts, and the map must react to a published day either way.
    publishDayStops = (points) => onDayStops?.(points as never)
    void islandSlot
    return <div data-testid="surface" />
  },
}))

const planSwitch = () => screen.getByRole('button', { name: /plan mode/i })

const mapState = () => JSON.parse(screen.getByTestId('map').textContent as string)

/** Publishing drives React state, so it must run inside act(). */
function publish(points: Array<Record<string, unknown>>) {
  act(() => publishDayStops?.(points))
}

const stop = (name: string, lat: number, lng: number) => ({
  id: `plan:${name}`,
  name,
  address: name,
  lat,
  lng,
  category: 'Stop',
})

describe('ExploreMapView plan route drawing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    publishDayStops = null
  })

  it('draws the published day as three numbered itinerary pins, with no green/red endpoints', async () => {
    const user = userEvent.setup()
    render(<ExploreMapView />)

    await user.click(planSwitch())
    publish([stop('A', 16.4, 120.5), stop('B', 16.41, 120.51), stop('C', 16.42, 120.52)])

    // Fails on the old :250-252 substitution (origin 'A', destination 'C',
    // waypoints ['B']): plan mode must flatten every stop into waypoints.
    expect(mapState()).toEqual({ origin: null, destination: null, waypoints: ['A', 'B', 'C'] })
    expect(calculateMock).toHaveBeenCalledTimes(1)
  })

  it('calls the route pipeline with the day anchored on its own stops', async () => {
    const user = userEvent.setup()
    render(<ExploreMapView />)

    await user.click(planSwitch())
    publish([stop('A', 16.4, 120.5), stop('B', 16.41, 120.51)])

    expect(calculateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: expect.objectContaining({ name: 'A' }),
        destination: expect.objectContaining({ name: 'B' }),
      })
    )
  })

  it('draws nothing and calls nothing when fewer than two stops resolve', async () => {
    const user = userEvent.setup()
    render(<ExploreMapView />)

    await user.click(planSwitch())
    publish([stop('A', 16.4, 120.5)])

    expect(mapState()).toEqual({ origin: null, destination: null, waypoints: [] })
    expect(calculateMock).not.toHaveBeenCalled()
  })

  it('draws nothing for a day where nothing resolved', async () => {
    const user = userEvent.setup()
    render(<ExploreMapView />)

    await user.click(planSwitch())
    publish([])

    expect(mapState()).toEqual({ origin: null, destination: null, waypoints: [] })
    expect(calculateMock).not.toHaveBeenCalled()
  })

  it('redraws numbered pins when a different day is published', async () => {
    const user = userEvent.setup()
    render(<ExploreMapView />)

    await user.click(planSwitch())
    publish([stop('A', 16.4, 120.5), stop('B', 16.41, 120.51)])
    // Fails on the old :250-252 substitution (origin 'A', destination 'B',
    // waypoints []): both stops must be waypoint pins.
    expect(mapState()).toEqual({ origin: null, destination: null, waypoints: ['A', 'B'] })

    publish([stop('D', 15.1, 121.0), stop('E', 15.2, 121.1)])
    expect(mapState()).toEqual({ origin: null, destination: null, waypoints: ['D', 'E'] })
    expect(calculateMock).toHaveBeenCalledTimes(2)
  })

  it('caps numbered pins at origin + destination + first 10 middles, dropping middles past index 10', async () => {
    const user = userEvent.setup()
    render(<ExploreMapView />)

    await user.click(planSwitch())
    const names = Array.from({ length: 14 }, (_, i) => `S${i + 1}`)
    publish(names.map((name, i) => stop(name, 16.4 + i * 0.01, 120.5 + i * 0.01)))

    // MAX_WAYPOINTS truncation is unchanged: middles S12/S13 never reach the map.
    expect(mapState()).toEqual({
      origin: null,
      destination: null,
      waypoints: [...names.slice(0, 11), names[names.length - 1]],
    })
  })

  it('leaves the map without a plan route when plan mode is turned off', async () => {
    const user = userEvent.setup()
    render(<ExploreMapView />)

    await user.click(planSwitch())
    publish([stop('A', 16.4, 120.5), stop('B', 16.41, 120.51)])
    expect(mapState().waypoints).toEqual(['A', 'B'])

    await user.click(planSwitch())

    expect(mapState()).toEqual({ origin: null, destination: null, waypoints: [] })
  })
})