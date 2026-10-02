/**
 * The island is one surface with two configurations.
 *
 * Plan Mode swaps what the island *contains* without touching what it *is*:
 * the morph, the dismissal, and the collapse contract are shared. The test that
 * matters is that route mode is untouched by the swap — a regression there
 * breaks the page Plan Mode is supposed to sit beside, not the feature.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FloatingSearchCard from '../FloatingSearchCard'
import { LocationPoint, RoutePreferences } from '@/types/route-optimization'

jest.mock('framer-motion', () => {
  const ReactLib = jest.requireActual<typeof import('react')>('react')
  const MOTION_ONLY_PROPS = new Set([
    'animate',
    'initial',
    'exit',
    'transition',
    'layout',
    'layoutId',
    'variants',
    'whileHover',
    'whileTap',
    'whileFocus',
    'whileInView',
    'onAnimationStart',
    'onAnimationComplete',
    'drag',
  ])
  return {
    motion: new Proxy(
      {},
      {
        get: (_t, tag: string) =>
          ReactLib.forwardRef<unknown, Record<string, unknown>>((props, ref) => {
            const clean: Record<string, unknown> = {}
            Object.keys(props).forEach((k) => {
              if (!MOTION_ONLY_PROPS.has(k)) clean[k] = props[k]
            })
            return ReactLib.createElement(tag, { ...clean, ref })
          }),
      }
    ),
  }
})

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // jsdom implements neither of these; the island measures itself.
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

const origin: LocationPoint = {
  id: 'o1',
  name: 'Burnham Park',
  address: 'Downtown',
  lat: 16.4095,
  lng: 120.5948,
  category: 'Park',
}

const prefs: RoutePreferences = { routeType: 'fastest', vehicleType: 'car' }

const noop = () => {}

function renderIsland(overrides: Partial<React.ComponentProps<typeof FloatingSearchCard>> = {}) {
  const props = {
    origin,
    destination: null,
    preferences: prefs,
    onOriginChange: noop,
    onDestinationChange: noop,
    onPreferencesChange: noop,
    onSubmit: noop,
    isCalculating: false,
    popularLocations: [],
    disabled: false,
    ...overrides,
  }
  render(<FloatingSearchCard {...props} />)
  return props
}

describe('FloatingSearchCard plan-mode swap', () => {
  beforeEach(() => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ results: [] }) })
  })

  /**
   * The island renders its collapsed children inert (opacity 0,
   * pointer-events none), so any test that clicks planner controls has to open
   * it first — exactly as a user taps the pill. The pill's accessible name is
   * `compactLabel` ("Open search" by default); its visible text in plan mode is
   * "Plan a trip", so match the name.
   */
  async function openIsland(user: ReturnType<typeof userEvent.setup>) {
    // The pill's name is state-dependent: "Open search" with no endpoints,
    // "Edit route from …" once one is set. Both are the same control.
    await user.click(screen.getByRole('button', { name: /open search|edit route/i }))
  }

  it('renders the route config when plan mode is off', () => {
    renderIsland({ planMode: false })
    expect(screen.getByText('From')).toBeInTheDocument()
    expect(screen.getByText('To')).toBeInTheDocument()
    // The planner's group heading, not the route pill's "Destination" placeholder.
    expect(screen.queryByRole('group', { name: /destination/i })).not.toBeInTheDocument()
  })

  it('renders the planner config when plan mode is on', () => {
    renderIsland({ planMode: true })
    expect(screen.getByRole('group', { name: /destination/i })).toBeInTheDocument()
    expect(screen.getByText('Travel Interests')).toBeInTheDocument()
    expect(screen.queryByText('From')).not.toBeInTheDocument()
    expect(screen.queryByText('To')).not.toBeInTheDocument()
  })

  it('never renders both configurations at once', () => {
    renderIsland({ planMode: true })
    const routeFields = screen.queryByText('From')
    const plannerFields = screen.queryByRole('group', { name: /destination/i })
    expect(Boolean(routeFields) && Boolean(plannerFields)).toBe(false)
  })
  it('shows a plan affordance on the collapsed pill in plan mode', () => {
    renderIsland({ planMode: true, origin: null, destination: null })
    expect(screen.getByText('Plan a trip')).toBeInTheDocument()
    expect(screen.queryByText('Where to?')).not.toBeInTheDocument()
  })

  it('keeps the route affordance on the collapsed pill when plan mode is off', () => {
    renderIsland({ planMode: false, origin: null, destination: null })
    expect(screen.getByText('Where to?')).toBeInTheDocument()
    expect(screen.queryByText('Plan a trip')).not.toBeInTheDocument()
  })

  it('stays open while the budget popover is used', async () => {
    const user = userEvent.setup()
    renderIsland({ planMode: true, onPlanSubmit: jest.fn() })
    await openIsland(user)

    await user.click(screen.getByRole('button', { name: /budget range/i }))
    await user.click(await screen.findByRole('button', { name: /₱5,000 - ₱10,000\/day/i }))

    // The budget popover renders in a portal outside the island's own root, so
    // its pointerdown read as an outside press and closed the card mid-choice,
    // leaving the rest of the form unreachable.
    expect(screen.getByRole('button', { name: /budget range/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2' })).toBeEnabled()
  })

  it('forwards the planner payload to onPlanSubmit', async () => {
    const user = userEvent.setup()
    const onPlanSubmit = jest.fn()
    renderIsland({ planMode: true, onPlanSubmit })
    await openIsland(user)

    await user.click(screen.getByRole('button', { name: /^Davao/i }))
    await user.click(screen.getByRole('button', { name: /budget range/i }))
    await user.click(await screen.findByRole('button', { name: /₱5,000 - ₱10,000\/day/i }))
    await user.click(screen.getByRole('button', { name: '2' }))
    await user.click(screen.getByRole('button', { name: '2 Days' }))
    await user.click(screen.getByRole('button', { name: /Culture & Arts/i }))
    await user.click(screen.getByRole('button', { name: /generate itinerary/i }))

    expect(onPlanSubmit).toHaveBeenCalledTimes(1)
    expect(onPlanSubmit.mock.calls[0][0]).toEqual(
      expect.objectContaining({ cityId: 'davao', duration: '2 Days', selectedInterests: ['Culture & Arts'] })
    )
  })

  it('never calls the route submit while planning', async () => {
    const user = userEvent.setup()
    const onSubmit = jest.fn()
    renderIsland({ planMode: true, onSubmit })
    await openIsland(user)

    await user.click(screen.getByRole('button', { name: /^Davao/i }))
    await user.click(screen.getByRole('button', { name: /budget range/i }))
    await user.click(await screen.findByRole('button', { name: /₱5,000 - ₱10,000\/day/i }))
    await user.click(screen.getByRole('button', { name: '2' }))
    await user.click(screen.getByRole('button', { name: '2 Days' }))
    await user.click(screen.getByRole('button', { name: /Culture & Arts/i }))
    await user.click(screen.getByRole('button', { name: /generate itinerary/i }))

    expect(onSubmit).not.toHaveBeenCalled()
  })
})