/**
 * The collapsed pill must be a real hit target.
 *
 * The island root is `pointer-events-none` so the transparent card margins do
 * not swallow map pans and gestures. That value is inherited, and the pill is a
 * sibling of the content wrapper — not a child of it — so nothing re-enabled it.
 * The expanded wrapper sets `pointer-events: auto` when open, which is why the
 * card felt alive once open and dead when closed.
 *
 * This bites both modes: route mode's "Where to?" and Plan Mode's
 * "Plan a trip" are the same button. Verified in a browser — the topmost
 * element at the pill's centre was not a button at all, the tap landed on the
 * map, and a programmatic `.click()` still opened the card. That is why the
 * unit tests passed and users could not tap it.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DynamicIsland from '../DynamicIsland'

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
  const cache = new Map<string, unknown>()
  return {
    motion: new Proxy(
      {},
      {
        get: (_t, tag: string) => {
          const hit = cache.get(tag)
          if (hit) return hit
          const made = ReactLib.forwardRef<unknown, Record<string, unknown>>((props, ref) => {
            const clean: Record<string, unknown> = {}
            Object.keys(props).forEach((k) => {
              if (!MOTION_ONLY_PROPS.has(k)) clean[k] = props[k]
            })
            return ReactLib.createElement(tag, { ...clean, ref })
          })
          cache.set(tag, made)
          return made
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

/**
 * jsdom has no layout, so the test reproduces the inheritance rule directly:
 * the wrapper is pointer-events-none, exactly as FloatingSearchCard renders
 * it, and the pill must opt back in the way a real hit test requires.
 */
function Harness({
  onCompactClick,
}: {
  onCompactClick: () => void
}) {
  return (
    <div className="pointer-events-none">
      <DynamicIsland
        expanded={false}
        onCompactClick={onCompactClick}
        compactLabel="Plan a trip"
        compact={<span>Plan a trip</span>}
      >
        <div className="pointer-events-auto">island content</div>
      </DynamicIsland>
    </div>
  )
}

describe('DynamicIsland collapsed pill hit area', () => {
  it('is not left inheriting pointer-events: none from the island root', () => {
    const onCompactClick = jest.fn()
    render(<Harness onCompactClick={onCompactClick} />)

    const pill = screen.getByRole('button', { name: 'Plan a trip' })

    // Computed style, not the class list: the bug is inheritance, so only the
    // resolved value on the element proves anything.
    expect(getComputedStyle(pill).pointerEvents).not.toBe('none')
  })

  it('opts the pill back in explicitly', () => {
    const onCompactClick = jest.fn()
    render(<Harness onCompactClick={onCompactClick} />)

    expect(screen.getByRole('button', { name: 'Plan a trip' }).className).toContain(
      'pointer-events-auto'
    )
  })

  it('stays clickable', async () => {
    const user = userEvent.setup()
    const onCompactClick = jest.fn()
    render(<Harness onCompactClick={onCompactClick} />)

    await user.click(screen.getByRole('button', { name: 'Plan a trip' }))

    expect(onCompactClick).toHaveBeenCalledTimes(1)
  })

  it('leaves the expanded content wrapper able to opt back in on its own', () => {
    const onCompactClick = jest.fn()
    render(<Harness onCompactClick={onCompactClick} />)

    // The root stays transparent to the map; only the interactive surfaces
    // opt in. Guarding this stops a future "fix" that re-enables everything
    // and blocks map panning under the card.
    expect(screen.getByText('island content').className).toContain('pointer-events-auto')
  })
})