
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

    
    expect(screen.getByRole('button', { name: /^Baguio/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Manila/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Davao/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Visayas/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Luzon/i })).toBeInTheDocument()

    
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

    
    
    const submit = screen.getByRole('button', { name: /generat/i })
    expect(submit).toBeDisabled()

    await user.click(submit)

    expect(props.onSubmit).not.toHaveBeenCalled()
  })

  it('labels every control for assistive tech', () => {
    setup()

    
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

  
  async function pickStartDay(user: ReturnType<typeof userEvent.setup>, day: number) {
    await user.click(screen.getByText(/start date/i))
    const calendar = await screen.findByRole('dialog')
    
    
    
    const cell = within(calendar).getByRole('gridcell', { name: new RegExp(`^${day}$`) })
    await user.click(within(cell).getByRole('button'))
    await user.keyboard('{Escape}')
  }

  it('fills the end date from the start date and the chosen duration', async () => {
    const user = userEvent.setup()
    setup()

    await pickStartDay(user, 5)
    await user.click(screen.getByRole('button', { name: durationOptions[2] })) 

    
    
    
    await waitFor(() => expect(screen.queryByText('End date')).not.toBeInTheDocument())
    
    
    
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
    await user.click(screen.getByRole('button', { name: durationOptions[1] })) 
    await waitFor(() => expect(screen.getByText(expectedFor(6))).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: durationOptions[2] })) 
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
    await user.click(screen.getByRole('button', { name: durationOptions[0] })) 
    await user.click(screen.getByRole('button', { name: /Nature & Scenery/i }))

    
    
    
    
    
    
    const endTrigger = screen
      .getAllByRole('button')
      .filter((b) => /^\w{3,9} \d{1,2}, \d{4}$/.test(b.textContent || ''))[1]
    await user.click(endTrigger)
    const calendar = await screen.findByRole('dialog')
    const cell = within(calendar).getByRole('gridcell', { name: /^20$/ })
    await user.click(within(cell).getByRole('button'))
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: /generate itinerary/i }))

    
    
    
    
    expect(props.onSubmit).not.toHaveBeenCalled()
  })
})
