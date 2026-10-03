/**
 * The island is one surface with two configurations.
 *
 * Plan Mode swaps what the island *contains* without touching what it *is*:
 * the morph, the dismissal, and the collapse contract are shared. The island
 * supplies a DOM slot and the lazily-loaded surface portals the planner config
 * into it, so Gala's generator never enters the map's initial bundle.
 */
import React, { useCallback, useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createPortal } from 'react-dom'
import FloatingSearchCard from '../FloatingSearchCard'
import PlanIslandConfig from '../PlanIslandConfig'
import { ToastProvider } from '@/components/ui/use-toast'
import type { LocationPoint, RoutePreferences } from '@/types/route-optimization'
// Aliased: the DOM has its own FormData, which shadows Gala's payload type.
import type { FormData as ItineraryFormData } from '@/app/itinerary-generator/types'
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
  // One component per tag, cached. Returning a fresh component on every
  // property access makes React unmount and remount the subtree on each
  // render, which fires the slot ref as null -> node -> null forever and trips
  // React's update-depth guard.
  const cache = new Map<string, unknown>()
  return {
    motion: new Proxy(
      {},
      {
        get: (_t, tag: string) => {
          const cached = cache.get(tag)
          if (cached) return cached
          const created = ReactLib.forwardRef<unknown, Record<string, unknown>>(
            (props, ref) => {
              const clean: Record<string, unknown> = {}
              Object.keys(props).forEach((k) => {
                if (!MOTION_ONLY_PROPS.has(k)) clean[k] = props[k]
              })
              return ReactLib.createElement(tag, { ...clean, ref })
            }
          )
          cache.set(tag, created)
          return created
        },
      }
    ),
  }
})

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
const budgetOption = /₱5,000 - ₱10,000\/day/i

/**
 * Mirrors the production wiring: the island owns a slot node and the lazily
 * loaded surface portals the config into it. The slot callback ignores a
 * repeated node; React fires ref callbacks on every commit, and a state update
 * per commit would loop.
 */
function PlanHost({
  onSubmit,
  onRouteSubmit = noop,
}: {
  onSubmit: (formData: ItineraryFormData) => void
  onRouteSubmit?: () => void
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const onSlot = useCallback((node: HTMLElement | null) => {
    setSlot((prev) => (prev === node ? prev : node))
  }, [])

  return (
    <div>
      <FloatingSearchCard
        origin={origin}
        destination={null}
        preferences={prefs}
        onOriginChange={noop}
        onDestinationChange={noop}
        onPreferencesChange={noop}
        onSubmit={onRouteSubmit}
        isCalculating={false}
        popularLocations={[]}
        disabled={false}
        planMode
        onPlanSlot={onSlot}
      />
      {slot
        ? createPortal(
            <ToastProvider>
              <PlanIslandConfig onSubmit={onSubmit} isGenerating={false} disabled={false} />
            </ToastProvider>,
            slot
          )
        : null}
    </div>
  )
}

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

/**
 * The island renders its collapsed children inert (opacity 0,
 * pointer-events none), so a test that clicks the config must open it first,
 * exactly as a user taps the pill. The pill's name is state-dependent:
 * "Open search" with no endpoints, "Edit route from ..." once one is set.
 */
async function openIsland(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /open search|edit route/i }))
}

describe('FloatingSearchCard plan-mode swap', () => {
  beforeEach(() => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ results: [] }) })
  })

  it('renders the route config when plan mode is off', () => {
    renderIsland({ planMode: false })
    expect(screen.getByText('From')).toBeInTheDocument()
    expect(screen.getByText('To')).toBeInTheDocument()
  })

  it('offers no plan slot while plan mode is off', () => {
    const onPlanSlot = jest.fn()
    renderIsland({ planMode: false, onPlanSlot })
    expect(onPlanSlot).not.toHaveBeenCalled()
  })

  it('hands out a plan slot and drops the route fields when plan mode is on', () => {
    const onPlanSlot = jest.fn()
    renderIsland({ planMode: true, onPlanSlot })

    expect(onPlanSlot).toHaveBeenCalled()
    expect(screen.queryByText('From')).not.toBeInTheDocument()
    expect(screen.queryByText('To')).not.toBeInTheDocument()
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

  it('portals the planner config into the island slot', async () => {
    const user = userEvent.setup()
    render(<PlanHost onSubmit={jest.fn()} />)
    await openIsland(user)

    expect(screen.getByRole('group', { name: /destination/i })).toBeInTheDocument()
    expect(screen.getByText('Travel Interests')).toBeInTheDocument()
    expect(screen.queryByText('From')).not.toBeInTheDocument()
  })

  it('never renders both configurations at once', async () => {
    const user = userEvent.setup()
    render(<PlanHost onSubmit={jest.fn()} />)
    await openIsland(user)

    const routeFields = screen.queryByText('From')
    const plannerFields = screen.queryByRole('group', { name: /destination/i })
    expect(Boolean(routeFields) && Boolean(plannerFields)).toBe(false)
  })

  it('stays open while the budget popover is used', async () => {
    const user = userEvent.setup()
    render(<PlanHost onSubmit={jest.fn()} />)
    await openIsland(user)

    await user.click(screen.getByRole('button', { name: /budget range/i }))
    await user.click(await screen.findByRole('button', { name: budgetOption }))

    // The budget popover renders in a portal outside the island's own root, so
    // its pointerdown read as an outside press and closed the card mid-choice,
    // leaving the rest of the form unreachable.
    expect(screen.getByRole('button', { name: /budget range/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2' })).toBeEnabled()
  })

  it('forwards the planner payload from inside the island', async () => {
    const user = userEvent.setup()
    const onSubmit = jest.fn()
    render(<PlanHost onSubmit={onSubmit} />)
    await openIsland(user)

    await user.click(screen.getByRole('button', { name: /^Davao/i }))
    await user.click(screen.getByRole('button', { name: /budget range/i }))
    await user.click(await screen.findByRole('button', { name: budgetOption }))
    await user.click(screen.getByRole('button', { name: '2' }))
    await user.click(screen.getByRole('button', { name: '2 Days' }))
    await user.click(screen.getByRole('button', { name: /Culture & Arts/i }))
    await user.click(screen.getByRole('button', { name: /generate itinerary/i }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        cityId: 'davao',
        duration: '2 Days',
        selectedInterests: ['Culture & Arts'],
      })
    )
  })

  it('never calls the route submit while planning', async () => {
    const user = userEvent.setup()
    const onSubmit = jest.fn()
    const onRouteSubmit = jest.fn()
    render(<PlanHost onSubmit={onSubmit} onRouteSubmit={onRouteSubmit} />)
    await openIsland(user)

    await user.click(screen.getByRole('button', { name: /^Davao/i }))
    await user.click(screen.getByRole('button', { name: /budget range/i }))
    await user.click(await screen.findByRole('button', { name: budgetOption }))
    await user.click(screen.getByRole('button', { name: '2' }))
    await user.click(screen.getByRole('button', { name: '2 Days' }))
    await user.click(screen.getByRole('button', { name: /Culture & Arts/i }))
    await user.click(screen.getByRole('button', { name: /generate itinerary/i }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onRouteSubmit).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /get directions/i })).not.toBeInTheDocument()
  })
})