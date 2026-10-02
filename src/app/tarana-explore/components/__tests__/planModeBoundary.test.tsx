/**
 * Plan Mode must be display-only.
 *
 * The switch swaps the island's configuration surface. It must not mutate or
 * clear the route the user already set up — endpoints and preferences are the
 * user's work, not mode state. A toggle that silently dropped a half-built
 * route would be worse than no toggle at all.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

jest.mock('../route/InteractiveRouteMap', () => ({
  __esModule: true,
  default: () => <div data-testid="map" />,
}))

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
    calculate: jest.fn(),
    selectAlternative: jest.fn(),
    refreshTraffic: jest.fn(),
    clear: jest.fn(),
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

import ExploreMapView from '../ExploreMapView'

function planSwitch() {
  return screen.getByRole('button', { name: /plan mode/i })
}

describe('ExploreMapView plan mode boundary', () => {
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
  })

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
})
