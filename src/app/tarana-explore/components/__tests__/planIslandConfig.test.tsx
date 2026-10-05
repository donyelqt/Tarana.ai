/**
 * Plan Mode island configuration.
 *
 * Explore must plan with the same vocabulary Gala generates with. If these
 * drift, a plan composed on the map is not the plan Gala would have built —
 * same route, different options, different result. So the option lists are
 * imported, never re-typed.
 *
 * The alias rule is load-bearing: Visayas and Luzon are UI keys that must
 * resolve to a real member `cityId` before any request leaves the browser. A
 * region id reaching the API is a silent wrong-city generation.
 */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlanIslandConfig, { PLAN_DATE_FORMAT } from '../PlanIslandConfig'
import { ToastProvider } from '@/components/ui/use-toast'
import {
  budgetOptions,
  paxOptions,
  durationOptions,
  interests,
} from '@/app/itinerary-generator/data/itineraryData'

const noop = jest.fn()

/**
 * Budget is behind a popover, as it is in Gala. Select it the way a user does:
 * open the combobox, then pick the option.
 */
async function pickBudget(user: ReturnType<typeof userEvent.setup>, option: string) {
  await user.click(screen.getByRole('button', { name: /budget range/i }))
  await user.click(await screen.findByRole('button', { name: option }))
}

function setup(overrides: Partial<React.ComponentProps<typeof PlanIslandConfig>> = {}) {
  const props = {
    onSubmit: noop,
    isGenerating: false,
    disabled: false,
    ...overrides,
  }
  render(
    <ToastProvider>
      <PlanIslandConfig {...props} />
    </ToastProvider>
  )
  return props
}

describe('PlanIslandConfig', () => {
  beforeEach(() => jest.clearAllMocks())

  it('offers Gala\'s own option vocabulary, not a re-typed copy', () => {
    setup()

    // Destination tiles: Gala's pills verbatim (labels, not city ids).
    expect(screen.getByRole('button', { name: /^Baguio/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Manila/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Davao/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Visayas/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Luzon/i })).toBeInTheDocument()

    // Every Gala interest is offered.
    interests.forEach((i) => {
      expect(screen.getByRole('button', { name: new RegExp(i.label, 'i') })).toBeInTheDocument()
    })
  })

  it('blocks submit until budget, pax, duration and at least one interest are set', async () => {
    const user = userEvent.setup()
    const props = setup()

    const submit = screen.getByRole('button', { name: /generate itinerary/i })
    expect(submit).toBeDisabled()

    await pickBudget(user, budgetOptions[1])
    await user.click(screen.getByRole('button', { name: paxOptions[1] }))
    await user.click(screen.getByRole('button', { name: durationOptions[1] }))

    // Duration and budget and pax set, but no interest yet.
    expect(screen.getByRole('button', { name: /generate itinerary/i })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /Nature & Scenery/i }))

    expect(props.onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /generate itinerary/i })).toBeEnabled()
  })

  it('submits a Gala-shaped FormData', async () => {
    const user = userEvent.setup()
    const props = setup()

    await user.click(screen.getByRole('button', { name: /^Manila/i }))
    await pickBudget(user, budgetOptions[1])
    await user.click(screen.getByRole('button', { name: paxOptions[1] }))
    await user.click(screen.getByRole('button', { name: durationOptions[1] }))
    await user.click(screen.getByRole('button', { name: /Food & Culinary/i }))
    await user.click(screen.getByRole('button', { name: /generate itinerary/i }))

    expect(props.onSubmit).toHaveBeenCalledTimes(1)
    const formData = (props.onSubmit as jest.Mock).mock.calls[0][0]
    expect(formData).toEqual(
      expect.objectContaining({
        budget: budgetOptions[1],
        pax: paxOptions[1],
        duration: durationOptions[1],
        selectedInterests: ['Food & Culinary'],
        cityId: 'manila',
        trafficAware: true,
      })
    )
  })

  it('resolves the Visayas alias to a real city id before submitting', async () => {
    const user = userEvent.setup()
    const props = setup()

    await user.click(screen.getByRole('button', { name: /^Visayas/i }))
    await pickBudget(user, budgetOptions[0])
    await user.click(screen.getByRole('button', { name: paxOptions[0] }))
    await user.click(screen.getByRole('button', { name: durationOptions[0] }))
    await user.click(screen.getByRole('button', { name: /Adventure/i }))
    await user.click(screen.getByRole('button', { name: /generate itinerary/i }))

    const formData = (props.onSubmit as jest.Mock).mock.calls[0][0]
    expect(formData.cityId).toBe('boracay')
    // A region name must never leave the browser as a scope.
    expect(['visayas', 'luzon']).not.toContain(formData.cityId)
  })

  it('resolves the Luzon alias to a real city id', async () => {
    const user = userEvent.setup()
    const props = setup()

    await user.click(screen.getByRole('button', { name: /^Luzon/i }))
    await pickBudget(user, budgetOptions[0])
    await user.click(screen.getByRole('button', { name: paxOptions[0] }))
    await user.click(screen.getByRole('button', { name: durationOptions[0] }))
    await user.click(screen.getByRole('button', { name: /Adventure/i }))
    await user.click(screen.getByRole('button', { name: /generate itinerary/i }))

    const formData = (props.onSubmit as jest.Mock).mock.calls[0][0]
    expect(formData.cityId).toBe('manila')
  })

  it('marks the selected destination with aria-pressed', async () => {
    const user = userEvent.setup()
    setup()

    const baguio = screen.getByRole('button', { name: /^Baguio/i })
    expect(baguio).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: /^Davao/i }))
    expect(screen.getByRole('button', { name: /^Davao/i })).toHaveAttribute('aria-pressed', 'true')
    expect(baguio).toHaveAttribute('aria-pressed', 'false')
  })

  it('does not submit while generation is in flight', async () => {
    const user = userEvent.setup()
    const props = setup({ isGenerating: true })

    // The button keeps its identity while its label reports progress, so match
    // either state rather than pinning the idle string.
    const submit = screen.getByRole('button', { name: /generat/i })
    expect(submit).toBeDisabled()

    await user.click(submit)

    expect(props.onSubmit).not.toHaveBeenCalled()
  })

  it('labels every control for assistive tech', () => {
    setup()

    // Destination group and each field group carry a name.
    expect(screen.getByRole('group', { name: /destination/i })).toBeInTheDocument()
    expect(screen.getByText('Budget Range')).toBeInTheDocument()
    expect(screen.getByText('Number of Pax')).toBeInTheDocument()
    expect(screen.getByText('Duration')).toBeInTheDocument()
    expect(screen.getByText('Travel Interests')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /travel interests/i })).toBeInTheDocument()
  })

  it('offers travel dates, in Gala\'s position and shape', () => {
    setup()

    expect(screen.getByText('Travel Dates')).toBeInTheDocument()
    expect(screen.getByText(/start date/i)).toBeInTheDocument()
    expect(screen.getByText(/end date/i)).toBeInTheDocument()
  })

  it('submits a dates object so a saved plan is not "Date not specified"', async () => {
    const user = userEvent.setup()
    const props = setup()

    await pickBudget(user, budgetOptions[1])
    await user.click(screen.getByRole('button', { name: paxOptions[1] }))
    await user.click(screen.getByRole('button', { name: durationOptions[1] }))
    await user.click(screen.getByRole('button', { name: /Culture & Arts/i }))
    await user.click(screen.getByRole('button', { name: /generate itinerary/i }))

    // Dates do not reach the generation prompt. They are the saved trip's date
    // range, which is why omitting them made every Plan Mode save land as
    // "Date not specified" (useItineraryGenerator.ts:143).
    const formData = (props.onSubmit as jest.Mock).mock.calls[0][0]
    expect(formData.dates).toHaveProperty('start')
    expect(formData.dates).toHaveProperty('end')
  })
})

describe('PlanIslandConfig date derivation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ results: [] }) })
  })

  /**
   * Drives the real DatePicker rather than poking state. The calendar lives in
   * a Radix popover with its own grid semantics; driving it the way a user does
   * is the only way to prove the wiring, not just the arithmetic.
   */
  async function pickStartDay(user: ReturnType<typeof userEvent.setup>, day: number) {
    await user.click(screen.getByText(/start date/i))
    const calendar = await screen.findByRole('dialog')
    // react-day-picker renders each day as a gridcell wrapping a button, and
    // the cell itself does not select. Scoped to the calendar because a bare
    // /\b5\b/ also matches the "3-5" pax tile.
    const cell = within(calendar).getByRole('gridcell', { name: new RegExp(`^${day}$`) })
    await user.click(within(cell).getByRole('button'))
    await user.keyboard('{Escape}')
  }

  it('fills the end date from the start date and the chosen duration', async () => {
    const user = userEvent.setup()
    setup()

    await pickStartDay(user, 5)
    await user.click(screen.getByRole('button', { name: durationOptions[2] })) // "3 Days"

    // Asserted on the picker's own formatted text, not a bare day number: a
    // /\b6\b/ also matches the "3-5" pax tile, which makes a loose day
    // matcher ambiguous.
    await waitFor(() => expect(screen.queryByText('End date')).not.toBeInTheDocument())
    // A 3-day trip starting on the 5th ends on the 7th. The month and year
    // come from the calendar react-day-picker opens, so this does not assume
    // "today" and cannot rot.
    const { format } = require('date-fns') as typeof import('date-fns')
    const start = new Date()
    start.setDate(5)
    const expected = new Date(start)
    expected.setDate(7)
    expect(screen.getByText(format(expected, PLAN_DATE_FORMAT))).toBeInTheDocument()
  })

  it('recomputes the end date when the duration changes', async () => {
    const user = userEvent.setup()
    setup()
    const { format } = require('date-fns') as typeof import('date-fns')
    const expectedFor = (day: number) => {
      const d = new Date()
      d.setDate(day)
      return format(d, PLAN_DATE_FORMAT)
    }

    await pickStartDay(user, 5)
    await user.click(screen.getByRole('button', { name: durationOptions[1] })) // "2 Days"
    await waitFor(() => expect(screen.getByText(expectedFor(6))).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: durationOptions[2] })) // "3 Days"
    await waitFor(() => expect(screen.getByText(expectedFor(7))).toBeInTheDocument())
  })

  it('leaves the end date alone until a start date is chosen', () => {
    setup()

    userEvent.setup().click(screen.getByRole('button', { name: durationOptions[2] }))

    expect(screen.getByText(/end date/i)).toBeInTheDocument()
  })

  it('blocks submit when a hand-edited end date contradicts the duration', async () => {
    const user = userEvent.setup()
    const props = setup()

    await pickBudget(user, budgetOptions[0])
    await pickStartDay(user, 5)
    await user.click(screen.getByRole('button', { name: paxOptions[0] }))
    await user.click(screen.getByRole('button', { name: durationOptions[0] })) // "1 Day"
    await user.click(screen.getByRole('button', { name: /Nature & Scenery/i }))

    // Now hand-edit the END date. The derivation only fires when start or
    // duration changes, so editing the end date is the one path that can
    // leave a range contradicting the chosen duration.
    // Both pickers now show a date, so target the END trigger by position
    // rather than matching text alone. The pattern is PLAN_DATE_FORMAT's
    // "Sep 30, 2026" shape, not the default "September 30th, 2026".
    const endTrigger = screen
      .getAllByRole('button')
      .filter((b) => /^\w{3,9} \d{1,2}, \d{4}$/.test(b.textContent || ''))[1]
    await user.click(endTrigger)
    const calendar = await screen.findByRole('dialog')
    const cell = within(calendar).getByRole('gridcell', { name: /^20$/ })
    await user.click(within(cell).getByRole('button'))
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: /generate itinerary/i }))

    // A "1 Day" trip whose end date is the 20th must not save. The toast text
    // is deliberately not asserted: this repo's ToastProvider is a context
    // shim that renders no toast UI, so the message is never in the DOM. The
    // observable contract is that submit did not fire.
    expect(props.onSubmit).not.toHaveBeenCalled()
  })
})
