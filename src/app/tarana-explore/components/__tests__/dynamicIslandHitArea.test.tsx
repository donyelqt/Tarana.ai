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

    expect(screen.getByText('island content').className).toContain('pointer-events-auto')
  })
})