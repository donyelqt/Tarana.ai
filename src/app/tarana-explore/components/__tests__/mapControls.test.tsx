/**
 * Plan Mode control contract.
 *
 * The switch is a display-mode toggle, not a route control: it must report its
 * state to assistive tech, be reachable by keyboard, and fire exactly once per
 * press. Tapping it must never be mistaken for a recenter/tilt/style action.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MapControls from '../MapControls'

const baseProps = {
  currentMapStyle: 'main' as const,
  isChangingStyle: false,
  onStyleChange: jest.fn(),
  onRecenter: jest.fn(),
  tiltOn: false,
  onToggleTilt: jest.fn(),
  planMode: false,
  onTogglePlan: jest.fn(),
  onZoom: jest.fn(),
  zoomDisabled: false,
}

function setup(overrides: Partial<typeof baseProps> = {}) {
  const props = { ...baseProps, ...overrides }
  render(<MapControls {...props} />)
  return props
}

describe('MapControls plan mode switch', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders the plan switch with a pressed state that reflects the prop', () => {
    setup({ planMode: false })
    expect(screen.getByRole('button', { name: /plan mode/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('reports pressed when plan mode is on', () => {
    setup({ planMode: true })
    expect(screen.getByRole('button', { name: /plan mode/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('fires the toggle exactly once per press', async () => {
    const user = userEvent.setup()
    const props = setup()

    await user.click(screen.getByRole('button', { name: /plan mode/i }))

    expect(props.onTogglePlan).toHaveBeenCalledTimes(1)
  })

  it('is keyboard reachable', async () => {
    const user = userEvent.setup()
    const props = setup()
    const planButton = screen.getByRole('button', { name: /plan mode/i })

    // Order-independent: the switch must be tabbable and activate from the
    // keyboard. Asserting a tab count would pin its position in the stack,
    // which is incidental to the contract.
    planButton.focus()
    expect(planButton).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(props.onTogglePlan).toHaveBeenCalledTimes(1)

    await user.keyboard(' ')
    expect(props.onTogglePlan).toHaveBeenCalledTimes(2)
  })

  it('clicking plan mode does not trigger the other map controls', async () => {
    const user = userEvent.setup()
    const props = setup()

    await user.click(screen.getByRole('button', { name: /plan mode/i }))

    expect(props.onRecenter).not.toHaveBeenCalled()
    expect(props.onToggleTilt).not.toHaveBeenCalled()
    expect(props.onStyleChange).not.toHaveBeenCalled()
  })
})

describe('MapControls stacking', () => {
  it('sits above the island so the plan switch stays reachable', () => {
    // The island root paints at z-30. A rail below it would be covered by an
    // expanded planner card on a narrow viewport, and the switch that opened
    // the card would be unreachable — Plan Mode could not be turned off.
    setup()
    expect(screen.getByRole('button', { name: /plan mode/i }).parentElement).toHaveClass('z-40')
  })

  it('keeps every control on the rail\'s 40px target', () => {
    setup()
    // Pre-existing rail language, deliberately unchanged: restyling all four
    // map controls is a separate decision from Plan Mode.
    for (const control of screen.getAllByRole('button')) {
      expect(control).toHaveClass('w-10', 'h-10')
    }
  })
})

describe('MapControls zoom', () => {
  beforeEach(() => jest.clearAllMocks())

  it('sends signed steps so repeated presses accumulate', async () => {
    const user = userEvent.setup()
    const props = setup()

    await user.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(props.onZoom).toHaveBeenLastCalledWith(1)

    await user.click(screen.getByRole('button', { name: 'Zoom out' }))
    expect(props.onZoom).toHaveBeenLastCalledWith(-1)

    expect(props.onRecenter).not.toHaveBeenCalled()
    expect(props.onToggleTilt).not.toHaveBeenCalled()
  })

  it('uses the rail\'s circular language, matching the other controls', () => {
    setup()

    for (const name of ['Zoom in', 'Zoom out']) {
      expect(screen.getByRole('button', { name })).toHaveClass('rounded-full', 'w-10', 'h-10')
    }
  })

  it('disables both buttons at a zoom bound', () => {
    setup({ zoomDisabled: true })

    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled()
  })

  it('keeps every other control intact', () => {
    setup()

    // Regression guard: an earlier edit of this rail dropped four controls.
    for (const name of [
      /plan mode/i,
      'Recenter to my route',
      /3D tilt/i,
      'Change map style',
      'Zoom in',
      'Zoom out',
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })
})
