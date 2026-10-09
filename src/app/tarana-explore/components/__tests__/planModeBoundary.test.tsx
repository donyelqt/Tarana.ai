/**
 * Plan Mode must be display-only.
 *
 * The switch swaps the island's configuration surface. It must not mutate or
 * clear the route the user already set up — endpoints and preferences are the
 * user's work, not mode state. A toggle that silently dropped a half-built
 * route would be worse than no toggle at all.
 *
 * Plan mode also owns the map visually while it is on: the deep-link preview
 * card must go away on entry (it has no pin once the endpoints are hidden),
 * and plan-pipeline output (currentRoute/traffic from the plan's calculate())
 * must never render as the user's route chrome or feed its refresh.
 */
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

// The deep-link tests below seed mockSearchParams.current per test. Without
// this wiring the global jest.setup mock always returns an empty
// URLSearchParams, so parseDeepLink never yields a destination or preview and
// the harness asserts on state it never seeded.
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

// Route chrome is stubbed at the render-site seam: these tests assert WHEN the
// parent renders it, not what it renders. The suite must fail if the parent
// gates inside the children instead (the contract forbids that), so the stubs
// render unconditionally — only the parent's planMode condition can hide them.
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

// Plan Mode pulls in Gala's generation hook, which needs ToastProvider and a
// credit query. This suite is about the mode boundary, not generation, so the
// hook is stubbed at its own seam — the boundary tests then assert the island
// contract without standing up the billing stack.
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

// A completed plan-pipeline output: currentRoute + traffic from the plan's own
// calculate(), which must never read as the user's route.
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

  // Mounting the map view is heavy, and sibling suites in this directory run
  // 30-40s each on a saturated machine, which pushes this past Jest's 5s
  // default even though the test itself takes ~50ms in isolation. CI hides it
  // with --maxWorkers=2. The margin is explicit rather than left to load.
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

    // Compare route state only. The island payload also carries the collapse
    // signal, which is expected to change — the invariant here is that the
    // user's endpoints and preferences survive the mode switch untouched.
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
    // Fails on current code: handleTogglePlan only flips the mode flag and
    // never touches spotPreview, so the pin-less photo card floats over the
    // plan sheet — plan mode does not own the map visually.
    mockSearchParams.current = new URLSearchParams('to=Cafe&toLat=16.4&toLon=120.6')
    const user = userEvent.setup()
    render(<ExploreMapView />)

    expect(screen.getByTestId('spot-preview')).toBeInTheDocument()

    await user.click(planSwitch())

    expect(screen.queryByTestId('spot-preview')).not.toBeInTheDocument()
    // The deep-link destination is a routing seed, not preview chrome: it must
    // survive for the return trip to route mode.
    expect(islandState().destination?.name).toBe('Cafe')

    await user.click(planSwitch())
    expect(islandState().destination?.name).toBe('Cafe')
  })

  it('clears plan-pipeline output on leaving plan mode without touching user endpoints', async () => {
    // Fails on current code: leaving plan mode only flips the flag, so a
    // completed plan currentRoute/traffic keeps feeding BottomRouteSheet,
    // TrafficBadge, and the 5-minute refresh after the mode is gone.
    // (The hook exposes clear() only — its abortRef is an unused Timeout, so
    // an in-flight plan calculate cannot be cancelled, only its completed
    // output cleared.)
    mockSearchParams.current = new URLSearchParams('to=Cafe&toLat=16.4&toLon=120.6')
    seedPlanPipelineOutput()
    const user = userEvent.setup()
    render(<ExploreMapView />)

    await user.click(planSwitch())
    expect(mockClear).not.toHaveBeenCalled()

    await user.click(planSwitch())

    expect(mockClear).toHaveBeenCalledTimes(1)
    // The user's own endpoints stay untouched; a pre-plan route, if any, is
    // not reconstructed here — this only guarantees nothing destroys it.
    expect(islandState().origin).toBeNull()
    expect(islandState().destination?.name).toBe('Cafe')
  })

  it('hides route chrome while a plan route is active in plan mode', async () => {
    // Fails on current code: BottomRouteSheet and TrafficBadge render
    // unconditionally, so plan-mode calculate() output shows a drive-time
    // summary and a traffic badge as if it were the user's route. The guard
    // must live at the ExploreMapView render site — the stubs above render
    // unconditionally, so gating inside the shared children cannot hide them.
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
    // Fails on current code: the interval watches state.currentRoute alone,
    // so it keeps refreshing plan-pipeline traffic on the plan's behalf.
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
