import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockSearchParams: { current: URLSearchParams } = {
  current: new URLSearchParams(),
}

interface StubRouteState {
  currentRoute: { id: string } | null
  alternativeRoutes: Array<{ id: string }>
  trafficConditions: { overallTrafficLevel: string } | null
  routeComparison: null
  isCalculating: boolean
  error: string | null
  lastUpdated: null
}
const mockNullRouteState = (): StubRouteState => ({
  currentRoute: null,
  alternativeRoutes: [],
  trafficConditions: null,
  routeComparison: null,
  isCalculating: false,
  error: null,
  lastUpdated: null,
})
const mockRouteState: { current: StubRouteState } = {
  current: mockNullRouteState(),
}
const mockCalculate = jest.fn()
const mockClear = jest.fn()
const mockRefreshTraffic = jest.fn()

jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams.current,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/',
}))

jest.mock('../../hooks/useRouteCalculation', () => ({
  useRouteCalculation: () => ({
    state: mockRouteState.current,
    calculate: mockCalculate,
    selectAlternative: jest.fn(),
    refreshTraffic: mockRefreshTraffic,
    clear: mockClear,
  }),
}))

jest.mock('../FloatingSearchCard', () => ({
  __esModule: true,
  default: ({
    origin,
    destination,
    collapseSignal,
  }: {
    origin: unknown
    destination: unknown
    collapseSignal?: number
  }) => (
    <div data-testid="island">
      {JSON.stringify({ origin, destination, collapseSignal })}
    </div>
  ),
}))

jest.mock('../BottomRouteSheet', () => ({
  __esModule: true,
  default: () => <div data-testid="route-sheet" />,
}))

jest.mock('../TrafficBadge', () => ({
  __esModule: true,
  default: () => <div data-testid="traffic-badge" />,
}))

jest.mock('../SpotPreviewCard', () => ({
  __esModule: true,
  default: ({ onDismiss }: { onDismiss: () => void }) => (
    <div data-testid="spot-preview">
      <button type="button" aria-label="Dismiss preview" onClick={onDismiss} />
    </div>
  ),
}))

jest.mock('../PlanModeSurface', () => ({
  __esModule: true,
  default: () => <div data-testid="plan-surface" />,
}))

jest.mock('../../hooks/usePlanMode', () => ({
  usePlanMode: () => ({
    formSnapshot: null,
    generate: jest.fn(),
    clearPlan: jest.fn(),
    itinerary: null,
    save: jest.fn(),
    isGenerating: false,
    isOutOfCredits: false,
    isCheckingCredits: false,
    creditBalance: null,
  }),
}))

import ExploreMapView from '../ExploreMapView'

function planSwitch() {
  return screen.getByRole('button', { name: /plan mode/i })
}

function islandState() {
  return JSON.parse(screen.getByTestId('island').textContent!)
}

function seedPlanPipelineOutput() {
  mockRouteState.current = {
    ...mockNullRouteState(),
    currentRoute: { id: 'plan-leg' },
    trafficConditions: { overallTrafficLevel: 'HIGH' },
  }
}

describe('ExploreMapView plan mode boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams.current = new URLSearchParams()
    mockRouteState.current = mockNullRouteState()
  })

  it('starts with plan mode off', () => {
    render(<ExploreMapView />)
    expect(planSwitch()).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggles on and back off', async () => {
    const user = userEvent.setup()
    render(<ExploreMapView />)

    await user.click(planSwitch())
    expect(planSwitch()).toHaveAttribute('aria-pressed', 'true')

    await user.click(planSwitch())
    expect(planSwitch()).toHaveAttribute('aria-pressed', 'false')
  }, 30_000)

  it('leaves the route state byte-identical across both toggle directions', async () => {
    const user = userEvent.setup()
    render(<ExploreMapView />)

    const routeState = () =>
      screen.getByTestId('island').textContent!.replace(/"collapseSignal":\d+/, '')

    const before = routeState()

    await user.click(planSwitch())
    expect(routeState()).toBe(before)

    await user.click(planSwitch())
    expect(routeState()).toBe(before)
  })

  it('does not recalculate a route on toggle alone', async () => {
    const user = userEvent.setup()
    const { useRouteCalculation } = jest.requireMock('../../hooks/useRouteCalculation')
    render(<ExploreMapView />)

    await user.click(planSwitch())

    expect(useRouteCalculation().calculate).not.toHaveBeenCalled()
  })

  it('signals the island to collapse when the mode changes', async () => {
    const user = userEvent.setup()
    render(<ExploreMapView />)

    const before = JSON.parse(screen.getByTestId('island').textContent!).collapseSignal

    await user.click(planSwitch())
    const afterOn = JSON.parse(screen.getByTestId('island').textContent!).collapseSignal
    expect(afterOn).toBeGreaterThan(before)

    await user.click(planSwitch())
    const afterOff = JSON.parse(screen.getByTestId('island').textContent!).collapseSignal
    expect(afterOff).toBeGreaterThan(afterOn)
  })

  it('dismisses the deep-link preview on entering plan mode but keeps the destination seed', async () => {
    mockSearchParams.current = new URLSearchParams('to=Cafe&toLat=16.4&toLon=120.6')
    const user = userEvent.setup()
    render(<ExploreMapView />)

    expect(screen.getByTestId('spot-preview')).toBeInTheDocument()

    await user.click(planSwitch())

    expect(screen.queryByTestId('spot-preview')).not.toBeInTheDocument()
    expect(islandState().destination?.name).toBe('Cafe')

    await user.click(planSwitch())
    expect(islandState().destination?.name).toBe('Cafe')
  })

  it('clears plan-pipeline output on leaving plan mode without touching user endpoints', async () => {
    mockSearchParams.current = new URLSearchParams('to=Cafe&toLat=16.4&toLon=120.6')
    seedPlanPipelineOutput()
    const user = userEvent.setup()
    render(<ExploreMapView />)

    await user.click(planSwitch())
    expect(mockClear).not.toHaveBeenCalled()

    await user.click(planSwitch())

    expect(mockClear).toHaveBeenCalledTimes(1)
    expect(islandState().origin).toBeNull()
    expect(islandState().destination?.name).toBe('Cafe')
  })

  it('hides route chrome while a plan route is active in plan mode', async () => {
    seedPlanPipelineOutput()
    const user = userEvent.setup()
    render(<ExploreMapView />)

    expect(screen.getByTestId('route-sheet')).toBeInTheDocument()
    expect(screen.getByTestId('traffic-badge')).toBeInTheDocument()

    await user.click(planSwitch())

    expect(screen.queryByTestId('route-sheet')).not.toBeInTheDocument()
    expect(screen.queryByTestId('traffic-badge')).not.toBeInTheDocument()
  })

  it('stops the 5-minute refresh while plan output is showing', () => {
    jest.useFakeTimers()
    try {
      seedPlanPipelineOutput()
      render(<ExploreMapView />)

      fireEvent.click(planSwitch())
      jest.advanceTimersByTime(5 * 60 * 1000)

      expect(mockRefreshTraffic).not.toHaveBeenCalled()
    } finally {
      jest.useRealTimers()
    }
  })
})
