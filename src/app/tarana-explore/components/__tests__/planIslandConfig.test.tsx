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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlanIslandConfig from '../PlanIslandConfig'
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
  render(<PlanIslandConfig {...props} />)
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
})
