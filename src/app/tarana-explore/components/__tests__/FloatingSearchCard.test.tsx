/**
 * Regression tests for the tarana-explore floating search card.
 *
 * Covers the two reported defects:
 *  1. Committing one endpoint must hand focus to the other one.
 *  2. Committing an endpoint must NOT collapse the island back to the
 *     "Where to?" phase. On iOS/Safari a tap on a <button> does not move DOM
 *     focus, so the resulting focusout carries relatedTarget === null. The old
 *     implementation derived "expanded" from that focus/blur pair and closed
 *     the card the moment a suggestion was tapped.
 *
 * Also pins the two intended collapse behaviours:
 *  - after a route calculation finishes the island returns to "Where to?"
 *  - pressing outside the card collapses it.
 */

import React, { useState } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FloatingSearchCard from '../FloatingSearchCard'
import { LocationPoint, RoutePreferences } from '@/types/route-optimization'

// framer-motion does no layout work in jsdom; render plain elements so the test
// exercises DynamicIsland's own expanded/collapsed branching, nothing else.
jest.mock('framer-motion', () => {
  const ReactLib = jest.requireActual<typeof import('react')>('react')
  const MOTION_ONLY_PROPS = new Set([
    'animate', 'initial', 'exit', 'transition', 'layout', 'layoutId',
    'variants', 'whileHover', 'whileTap', 'whileFocus', 'whileInView',
    'onAnimationStart', 'onAnimationComplete', 'drag',
  ])
  const create = (tag: string) =>
    ReactLib.forwardRef<unknown, Record<string, unknown>>((props, ref) => {
      const clean: Record<string, unknown> = {}
      Object.keys(props).forEach((k) => {
        if (!MOTION_ONLY_PROPS.has(k)) clean[k] = props[k]
      })
      return ReactLib.createElement(tag, { ...clean, ref })
    })
  return {
    __esModule: true,
    motion: new Proxy({} as Record<string, unknown>, {
      get: (_t, tag: string) => create(tag),
    }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  }
})

// jsdom implements neither of these; DynamicIsland and the suggestion list use them.
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  Element.prototype.scrollIntoView = jest.fn()
})

const POPULAR: LocationPoint[] = [
  { id: 'burnham', name: 'Burnham Park', address: 'Downtown Baguio City', lat: 16.4095, lng: 120.5948 },
  { id: 'sm', name: 'SM City Baguio', address: 'Upper Session Rd', lat: 16.4088, lng: 120.5993 },
]

const DEFAULT_PREFS: RoutePreferences = { routeType: 'fastest', vehicleType: 'car' }

/** Mirrors ExploreMapView: the card is controlled, the parent owns the endpoints. */
const Harness: React.FC<{
  onSubmit?: () => void
  isCalculating?: boolean
}> = ({ onSubmit = jest.fn(), isCalculating = false }) => {
  const [origin, setOrigin] = useState<LocationPoint | null>(null)
  const [destination, setDestination] = useState<LocationPoint | null>(null)
  const [preferences, setPreferences] = useState<RoutePreferences>(DEFAULT_PREFS)
  return (
    <div>
      <button type="button" data-testid="outside">outside</button>
      <div data-testid="state">{JSON.stringify({ o: origin?.id ?? null, d: destination?.id ?? null })}</div>
      <FloatingSearchCard
        origin={origin}
        destination={destination}
        preferences={preferences}
        onOriginChange={setOrigin}
        onDestinationChange={setDestination}
        onPreferencesChange={(p) => setPreferences((prev) => ({ ...prev, ...p }))}
        onSubmit={onSubmit}
        isCalculating={isCalculating}
        popularLocations={POPULAR}
      />
    </div>
  )
}

/** The collapsed pill exists only while the island is NOT expanded. */
const compactPill = () => screen.queryByRole('button', { name: /open search|edit route/i })
const fromInput = () => screen.getByLabelText('From')
const toInput = () => screen.getByLabelText('To')
const submitButton = () => screen.getByRole('button', { name: /get directions/i })
const routeState = () => JSON.parse(screen.getByTestId('state').textContent || '{}')

const openCard = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(compactPill() as HTMLElement)
  // The "From" field opens its popular list only after its focus event fires.
  await screen.findByRole('option', { name: /Burnham Park/i })
}

describe('FloatingSearchCard', () => {
  beforeEach(() => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ results: [] }) })
  })

  it('starts collapsed and expands onto the From field when the pill is tapped', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(compactPill()).toBeInTheDocument()

    await openCard(user)

    expect(compactPill()).not.toBeInTheDocument()
    expect(fromInput()).toHaveFocus()
  })

  it('auto-advances focus to To after committing From', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openCard(user)

    await user.click(screen.getByRole('option', { name: /Burnham Park/i }))
    await screen.findByRole('option', { name: /Burnham Park/i }) // To list opens

    expect(fromInput()).toHaveValue('Burnham Park')
    expect(routeState().o).toBe('burnham')
    expect(toInput()).toHaveFocus()
  })

  it('stays expanded after committing From (does not fall back to "Where to?")', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openCard(user)

    await user.click(screen.getByRole('option', { name: /Burnham Park/i }))
    await waitFor(() => expect(toInput()).toHaveFocus())

    expect(compactPill()).not.toBeInTheDocument()
  })

  it('ignores a focusout with a null relatedTarget (the iOS tap case)', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openCard(user)

    // Exactly what Safari/iOS emits when a non-focusable control is tapped.
    fireEvent.focusOut(fromInput(), { relatedTarget: null })

    expect(compactPill()).not.toBeInTheDocument()
  })

  it('still closes when focus genuinely moves to an element outside the card', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openCard(user)

    fireEvent.focusOut(fromInput(), { relatedTarget: screen.getByTestId('outside') })

    expect(compactPill()).toBeInTheDocument()
  })

  it('closes on an outside pointer press', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openCard(user)

    fireEvent.pointerDown(document.body)

    expect(compactPill()).toBeInTheDocument()
  })

  it('sends focus to the submit button once both endpoints are set', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openCard(user)

    await user.click(screen.getByRole('option', { name: /Burnham Park/i }))
    await screen.findByRole('option', { name: /SM City Baguio/i })
    await user.click(screen.getByRole('option', { name: /SM City Baguio/i }))

    expect(routeState()).toEqual({ o: 'burnham', d: 'sm' })
    await waitFor(() => expect(submitButton()).toHaveFocus())
    expect(submitButton()).toBeEnabled()
  })

  it('reopens onto the field that is still empty', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openCard(user)
    await user.click(screen.getByRole('option', { name: /Burnham Park/i }))
    await screen.findByRole('option', { name: /Burnham Park/i })

    fireEvent.pointerDown(document.body)
    expect(compactPill()).toBeInTheDocument()

    await openCard(user)
    expect(toInput()).toHaveFocus()
  })


  it('drops the committed place as soon as its text is edited', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openCard(user)
    await user.click(screen.getByRole('option', { name: /Burnham Park/i }))
    await screen.findByRole('option', { name: /Burnham Park/i })
    expect(routeState().o).toBe('burnham')

    // Clear re-focuses the field (single char stays under MIN_QUERY, so no
    // geocode fires). Editing the text must invalidate the committed origin.
    await user.click(screen.getByRole('button', { name: /clear from/i }))
    expect(fromInput()).toHaveFocus()
    await user.keyboard('x')

    expect(fromInput()).toHaveValue('x')
    expect(routeState().o).toBeNull()
  })

  it('collapses back to "Where to?" once a route calculation finishes', async () => {
    const { rerender } = render(<Harness isCalculating />)
    // While calculating the card is held open.
    expect(compactPill()).not.toBeInTheDocument()

    rerender(<Harness isCalculating={false} />)

    expect(compactPill()).toBeInTheDocument()
  })
})




