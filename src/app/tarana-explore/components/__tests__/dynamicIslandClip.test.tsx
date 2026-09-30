/**
 * Regression: the DynamicIsland clipped its own controls while expanded.
 *
 * `clip` was driven purely by framer-motion's onAnimationStart/onAnimationComplete.
 * It initialises to `true` and is only cleared when an animation *completes*, so
 * during the expand morph — and after any interrupted or never-run animation —
 * the container kept `overflow: hidden`. The card is still narrower than its
 * content at that moment, which pushed the "To" field's clear (X) button outside
 * the hit area: the button rendered but was untappable.
 *
 * The invariant now: an expanded island is never clipped. Collapsed content is
 * `opacity: 0` + `pointer-events: none`, so clipping it is free.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import DynamicIsland from '../DynamicIsland'

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
})

// The animated shell is the outer element; the content wrapper is its child.
const islandShell = () =>
  screen.getByTestId('island-content').parentElement?.parentElement as HTMLElement

describe('DynamicIsland clipping', () => {
  it('never clips its content while expanded, so controls stay tappable', () => {
    render(
      <DynamicIsland expanded compact={<span>Where to?</span>}>
        <div data-testid="island-content">
          <button type="button">Clear to</button>
        </div>
      </DynamicIsland>,
    )

    // Expanded: the shell must not clip. This is the condition that made the
    // X untappable while the morph was still running.
    expect(islandShell()).toHaveStyle({ overflow: 'visible' })
  })

  it('clips the collapsed pill so content does not bleed out of the lozenge', () => {
    render(
      <DynamicIsland expanded={false} compact={<span>Where to?</span>}>
        <div data-testid="island-content">hidden</div>
      </DynamicIsland>,
    )

    // Collapsed content is inert (opacity 0, pointer-events none), so clipping
    // is the correct look and cannot block anything.
    expect(islandShell()).toHaveStyle({ overflow: 'hidden' })
  })

  it('keeps the expanded content interactive (pointer-events auto)', () => {
    render(
      <DynamicIsland expanded compact={<span>Where to?</span>}>
        <div data-testid="island-content">
          <button type="button">Clear to</button>
        </div>
      </DynamicIsland>,
    )
    // The interactive layer is the island content wrapper itself.
    expect(screen.getByRole('button', { name: 'Clear to' })).toBeInTheDocument()
    expect(screen.getByTestId('island-content').parentElement).toHaveStyle({ pointerEvents: 'auto' })
  })
})