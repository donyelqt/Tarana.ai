
import React, { useState } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FloatingSearchCard from '../FloatingSearchCard'
import { LocationPoint, RoutePreferences } from '@/types/route-optimization'

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

const compactPill = () => screen.queryByRole('button', { name: /open search|edit route/i })
const fromInput = () => screen.getByLabelText('From')
const toInput = () => screen.getByLabelText('To')
const submitButton = () => screen.getByRole('button', { name: /get directions/i })
const routeState = () => JSON.parse(screen.getByTestId('state').textContent || '{}')

const openCard = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(compactPill() as HTMLElement)
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
    await screen.findByRole('option', { name: /Burnham Park/i }) 

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

    await user.click(screen.getByRole('button', { name: /clear from/i }))
    expect(fromInput()).toHaveFocus()
    await user.keyboard('x')

    expect(fromInput()).toHaveValue('x')
    expect(routeState().o).toBeNull()
  })

  it('collapses back to "Where to?" once a route calculation finishes', async () => {
    const { rerender } = render(<Harness isCalculating />)
    expect(compactPill()).not.toBeInTheDocument()

    rerender(<Harness isCalculating={false} />)

    expect(compactPill()).toBeInTheDocument()
  })

  const moreOptions = () => screen.getByRole('button', { name: /more options/i })
  const avoidPill = (label: 'Tolls' | 'Ferries' | 'Traffic' | 'Highways') =>
    screen.getByRole('button', { name: label })

  it('opens the Avoid options drawer from the More options button', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openCard(user)

    expect(moreOptions()).toBeInTheDocument()
    await user.click(moreOptions())

    expect(screen.getByText(/Depart at/i)).toBeInTheDocument()
    expect(screen.getByText(/Avoid/i)).toBeInTheDocument()
    expect(avoidPill('Tolls')).toBeInTheDocument()
    expect(avoidPill('Ferries')).toBeInTheDocument()
    expect(avoidPill('Traffic')).toBeInTheDocument()
    expect(avoidPill('Highways')).toBeInTheDocument()
  })

  it('toggles an Avoid preference on and off', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openCard(user)
    await user.click(moreOptions())

    expect(avoidPill('Tolls')).not.toHaveAttribute('aria-pressed', 'true')

    await user.click(avoidPill('Tolls'))
    expect(avoidPill('Tolls')).toHaveAttribute('aria-pressed', 'true')

    await user.click(avoidPill('Tolls'))
    expect(avoidPill('Tolls')).not.toHaveAttribute('aria-pressed', 'true')
  })

  it('reflects each Avoid preference independently', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openCard(user)
    await user.click(moreOptions())

    await user.click(avoidPill('Tolls'))
    await user.click(avoidPill('Highways'))

    expect(avoidPill('Tolls')).toHaveAttribute('aria-pressed', 'true')
    expect(avoidPill('Ferries')).not.toHaveAttribute('aria-pressed', 'true')
    expect(avoidPill('Traffic')).not.toHaveAttribute('aria-pressed', 'true')
    expect(avoidPill('Highways')).toHaveAttribute('aria-pressed', 'true')
  })
})




