/**
 * The From/To suggestion list must escape the island, not be clipped by it,
 * and the island must collapse when a plan finishes.
 *
 * #695 capped the island's expanded wrapper with `max-h-[70dvh] overflow-y-auto`
 * so a tall planner could not be trapped behind the map's control rail on a
 * short viewport. That `overflow-y: auto` turned the wrapper into a scroll
 * container, and the suggestion list is absolutely positioned *below* its
 * field, so it was clipped to whatever height the wrapper happened to have.
 * Measured in a browser at 1280x900: the list rendered to y=563 inside a
 * wrapper that ended at y=282 — 281px of a 448px list lost, plus every
 * control below the From field.
 *
 * DynamicIsland deliberately keeps `overflow: visible` while expanded for the
 * same reason. The cap belongs in plan mode, where the content is genuinely
 * taller than the viewport, and not in route mode, where it is short and the
 * dropdown needs to escape.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FloatingSearchCard from '../FloatingSearchCard'
import type { LocationPoint, RoutePreferences } from '@/types/route-optimization'

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
  } as never
  global.DOMRect = class {
    constructor(
      public x = 0,
      public y = 0,
      public width = 240,
      public height = 52
    ) {}
    top = 0
    left = 0
    right = 240
    bottom = 52
    toJSON() {
      return {}
    }
  } as never
})

const prefs = { routeType: 'fastest', vehicleType: 'car' } as RoutePreferences
const noop = () => {}
const pillName = /open search|edit route|plan a trip/i

function baseProps() {
  return {
    origin: null,
    destination: null,
    preferences: prefs,
    onOriginChange: noop,
    onDestinationChange: noop,
    onPreferencesChange: noop,
    onSubmit: noop,
    isCalculating: false,
    popularLocations: [] as LocationPoint[],
    disabled: false,
  }
}

function islandContent(): HTMLElement {
  const pill = screen.getByRole('button', { name: pillName })
  const node = pill.parentElement?.querySelector('.pointer-events-auto') as HTMLElement | null
  if (!node) throw new Error('island content wrapper not found')
  return node
}

describe('island scroll wrapper', () => {
  it('does not clip in route mode, so the suggestion list can escape', () => {
    render(<FloatingSearchCard {...baseProps()} planMode={false} />)

    // Asserted on the class list, not computed style: jsdom has no Tailwind
    // stylesheet, so `getComputedStyle(...).overflowY` is "" for an unset
    // property and cannot distinguish visible from a scroll container. The
    // resolved behaviour was verified in a browser instead, where the wrapper
    // measured overflowY "visible" and all 8 options rendered in the viewport.
    expect(islandContent().className).not.toContain('overflow-y-auto')
  })

  it('still caps and scrolls in plan mode, where the config exceeds a short viewport', () => {
    render(<FloatingSearchCard {...baseProps()} planMode />)

    const content = islandContent()

    expect(content.className).toContain('max-h-[70dvh]')
    expect(content.className).toContain('overflow-y-auto')
  })
})

describe('island auto-collapse', () => {
  beforeEach(() => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    })
  })

  it('collapses when plan generation finishes, not only when routing does', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <FloatingSearchCard {...baseProps()} planMode isPlanning />
    )

    await user.click(screen.getByRole('button', { name: pillName }))

    // Generation completes: isPlanning goes busy -> idle.
    rerender(<FloatingSearchCard {...baseProps()} planMode isPlanning={false} />)

    // The compact pill is back, which is the observable form of "collapsed".
    await waitFor(() =>
      expect(screen.getByRole('button', { name: pillName })).toBeInTheDocument()
    )
  })

  it('stays open while plan generation is still running', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <FloatingSearchCard {...baseProps()} planMode isPlanning />
    )

    await user.click(screen.getByRole('button', { name: pillName }))
    // Re-render with generation STILL running: no collapse.
    rerender(<FloatingSearchCard {...baseProps()} planMode isPlanning />)

    expect(screen.queryByRole('button', { name: pillName })).not.toBeInTheDocument()
  })
})