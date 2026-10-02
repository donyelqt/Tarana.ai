/**
 * Plan results surface.
 *
 * The sheet is the only place a generated plan is readable, so it has to be
 * honest about what it knows. A stop whose coordinates could not be resolved is
 * still a stop: it is listed by name and marked, never dropped and never given
 * a fake pin. Silently omitting stops would make a 3-stop day look complete
 * when the user only sees 2.
 */
import React from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlanSheet from '../PlanSheet'
import type { ItineraryData } from '@/app/itinerary-generator/types'

const itinerary: ItineraryData = {
  title: 'Your Baguio Adventure',
  subtitle: '3 days',
  items: [
    {
      period: 'Day 1 - Morning',
      activities: [
        { title: 'Burnham Park', desc: 'Lakeside walk', time: '9:00 AM', image: '', tags: ['Park'] },
        { title: 'Mystery Tower', desc: 'Overlook', time: '11:00 AM', image: '', tags: ['Viewpoint'] },
      ],
    },
    {
      period: 'Day 1 - Evening',
      activities: [
        { title: 'Session Road', desc: 'Dinner', time: '7:00 PM', image: '', tags: ['Food'] },
      ],
    },
    {
      period: 'Day 2 - Morning',
      activities: [
        { title: 'Nonexistent Place', desc: 'Unresolved', time: '9:00 AM', image: '', tags: [] },
      ],
    },
  ],
}

// Day 1: Burnham Park and Mystery Tower resolve; Session Road does not.
// Day 2: Nonexistent Place does not. The two misses are the only ones marked.
const resolvedFor = (title: string) =>
  title === 'Burnham Park'
    ? { lat: 16.4093, lon: 120.595 }
    : title === 'Mystery Tower'
      ? { lat: 16.4025, lon: 120.5698 }
      : null

function setup(overrides: Partial<React.ComponentProps<typeof PlanSheet>> = {}) {
  const props = {
    itinerary,
    resolveCoordinates: resolvedFor,
    onSave: jest.fn(),
    onClose: jest.fn(),
    isSaving: false,
    ...overrides,
  }
  render(<PlanSheet {...props} />)
  return props
}

describe('PlanSheet', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders nothing without an itinerary', () => {
    const { container } = render(
      <PlanSheet
        itinerary={null}
        resolveCoordinates={resolvedFor}
        onSave={jest.fn()}
        onClose={jest.fn()}
        isSaving={false}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('groups stops by day', () => {
    setup()
    expect(screen.getByRole('tab', { name: /day 1/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /day 2/i })).toBeInTheDocument()
  })

  it('lists every stop of the selected day', async () => {
    const user = userEvent.setup()
    setup()

    expect(screen.getByText('Burnham Park')).toBeInTheDocument()
    expect(screen.getByText('Mystery Tower')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /day 2/i }))
    expect(screen.getByText('Nonexistent Place')).toBeInTheDocument()
  })

  it('marks a stop whose location could not be resolved instead of dropping it', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('tab', { name: /day 2/i }))

    expect(screen.getByText('Nonexistent Place')).toBeInTheDocument()
    expect(screen.getByText(/no location/i)).toBeInTheDocument()
  })

  it('marks only the stops it could not resolve', async () => {
    // Day 1 holds Burnham Park (resolves), Mystery Tower (resolves) and
    // Session Road (no registry entry, no exact provider hit). The marker
    // belongs on the third row only.
    setup()

    // Resolution settles in a promise, so the row updates a tick after render.
    await act(async () => {})

    expect(screen.getAllByText(/no location/i)).toHaveLength(1)
    const burnhamRow = screen.getByText('Burnham Park').closest('li') as HTMLElement
    const mysteryRow = screen.getByText('Mystery Tower').closest('li') as HTMLElement
    const sessionRow = screen.getByText('Session Road').closest('li') as HTMLElement
    expect(burnhamRow).not.toHaveTextContent(/no location/i)
    expect(mysteryRow).not.toHaveTextContent(/no location/i)
    expect(sessionRow).toHaveTextContent(/no location/i)
  })

  it('resolves every stop of the selected day through the callback', () => {
    const resolveCoordinates = jest.fn(resolvedFor)
    setup({ resolveCoordinates })

    // Day 1 spans two periods (Morning, Evening) and holds three stops.
    expect(resolveCoordinates).toHaveBeenCalledTimes(3)
  })

  it('saves the plan', async () => {
    const user = userEvent.setup()
    const props = setup()

    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(props.onSave).toHaveBeenCalledTimes(1)
  })

  it('disables save while a save is in flight', async () => {
    const user = userEvent.setup()
    const props = setup({ isSaving: true })

    // The label reports progress, so match either state rather than pinning
    // the idle string.
    await user.click(screen.getByRole('button', { name: /sav(e|ing)/i }))

    expect(props.onSave).not.toHaveBeenCalled()
  })
})