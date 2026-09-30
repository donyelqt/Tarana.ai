/**
 * Repro for the reported Visit Spot -> Tarana Explore landing defects.
 *
 *  1. Arriving from Suggested Spots prefills the destination but the map stays
 *     framed on Baguio, so the spot is off-screen (or 500km away for a
 *     Visayas/Manila spot).
 *  2. The "To" field's X (clear) is unclickable on arrival.
 *  3. Nothing carries the card's photo/title/traffic across the link.
 *
 * These assert observable behaviour of the real components, not internals.
 */

import React, { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FloatingSearchCard from '../FloatingSearchCard'
import SpotPreviewCard from '../SpotPreviewCard'
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

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

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
]
const DEFAULT_PREFS: RoutePreferences = { routeType: 'fastest', vehicleType: 'car' }

/** A spot outside Baguio — the case where "stays framed on Baguio" is visible. */
const SM_SEASIDE: LocationPoint = {
  id: 'spot:10.28,123.88',
  name: 'SM Seaside City Cebu',
  address: 'SM Seaside City Cebu',
  lat: 10.281732,
  lng: 123.880608,
}

/** Mirrors ExploreMapView's controlled endpoints, seeded by the deep link. */
const DeepLinkHarness: React.FC<{ onDestinationChange?: (d: LocationPoint | null) => void }> = ({
  onDestinationChange,
}) => {
  const [origin, setOrigin] = useState<LocationPoint | null>(null)
  const [destination, setDestination] = useState<LocationPoint | null>(SM_SEASIDE)
  const [preferences, setPreferences] = useState<RoutePreferences>(DEFAULT_PREFS)
  return (
    <div>
      <div data-testid="destination">{destination ? destination.name : 'none'}</div>
      <FloatingSearchCard
        origin={origin}
        destination={destination}
        preferences={preferences}
        onOriginChange={setOrigin}
        onDestinationChange={(d) => {
          setDestination(d)
          onDestinationChange?.(d)
        }}
        onPreferencesChange={(p) => setPreferences((prev) => ({ ...prev, ...p }))}
        onSubmit={jest.fn()}
        isCalculating={false}
        popularLocations={POPULAR}
      />
    </div>
  )
}

describe('Explore arrival from a Suggested Spots deep link', () => {
  beforeEach(() => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ results: [] }) })
  })

  it('seeds the destination from the deep link', () => {
    render(<DeepLinkHarness />)
    expect(screen.getByTestId('destination')).toHaveTextContent('SM Seaside City Cebu')
  })

  it('the To field is reachable and its X actually clears the destination', async () => {
    // Reported defect: tapping X on arrival does nothing. The clear button is
    // gated on `!!query`, and the query only syncs from the parent value via an
    // effect — so if that sync never runs the X is not rendered at all, and if
    // the click handler re-collapses the island the tap lands on nothing.
    const user = userEvent.setup()
    const onDestinationChange = jest.fn()
    render(<DeepLinkHarness onDestinationChange={onDestinationChange} />)

    // Open the collapsed island the way a user would.
    await user.click(screen.getByRole('button', { name: /open search|edit route/i }))

    const toInput = await screen.findByLabelText('To')
    await waitFor(() => expect(toInput).toHaveValue('SM Seaside City Cebu'))

    const clear = screen.getByRole('button', { name: /^clear to$/i })
    await user.click(clear)

    expect(onDestinationChange).toHaveBeenCalledWith(null)
    await waitFor(() => expect(screen.getByTestId('destination')).toHaveTextContent('none'))
  })
})

describe('SpotPreviewCard (arrival card)', () => {
  it('shows the photo, the title, and the measured traffic tag', () => {
    render(
      <SpotPreviewCard
        name="SM Seaside City Cebu"
        image="https://images.unsplash.com/photo-seaside"
        traffic="Moderate"
        onDismiss={jest.fn()}
      />
    )

    expect(screen.getByRole('heading', { name: /SM Seaside City Cebu/i })).toBeInTheDocument()
    expect(screen.getByAltText('SM Seaside City Cebu')).toHaveAttribute(
      'src',
      'https://images.unsplash.com/photo-seaside',
    )
    expect(screen.getByText(/moderate traffic/i)).toBeInTheDocument()
  })

  it('hides the traffic tag when nothing was measured rather than guessing a level', () => {
    render(
      <SpotPreviewCard name="Mines View Park" image={null} traffic={null} onDismiss={jest.fn()} />
    )

    expect(screen.queryByText(/traffic/i)).not.toBeInTheDocument()
  })

  it('falls back to the brand mark when the photo is missing', () => {
    render(<SpotPreviewCard name="Mines View Park" image={null} traffic="Low" onDismiss={jest.fn()} />)

    expect(screen.getByAltText('Tarana.ai')).toBeInTheDocument()
  })

  it('exposes a keyboard-reachable dismiss control', async () => {
    const user = userEvent.setup()
    const onDismiss = jest.fn()
    render(<SpotPreviewCard name="Burnham Park" image={null} traffic={null} onDismiss={onDismiss} />)

    await user.click(screen.getByRole('button', { name: /dismiss spot preview/i }))
    expect(onDismiss).toHaveBeenCalled()
  })
})