'use client'

import React, { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/core'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  budgetOptions,
  paxOptions,
  durationOptions,
  interests as galaInterests,
} from '@/app/itinerary-generator/data/itineraryData'
import { CITY_PILLS } from '@/app/itinerary-generator/components/ItineraryForm'
import type { CityId, FormData } from '@/app/itinerary-generator/types'
import { DatePicker } from '@/components/ui/date-picker'
import { endDateForDuration, datesMatchDuration } from '@/app/itinerary-generator/utils/travelDates'
import { useToast } from '@/components/ui/use-toast'
/**
 * Plan Mode's configuration surface, rendered inside the Explore island.
 *
 * Two rules it exists to enforce:
 *
 * 1. **Same vocabulary as Gala.** Option lists are imported, never re-typed in
 *    Explore. A plan composed on the map must be the plan Gala would have
 *    built, or the two surfaces quietly disagree about what "3 Days" costs.
 * 2. **Aliases resolve before the request leaves the browser.** Visayas and
 *    Luzon are UI keys pointing at a real member city (`CITY_PILLS` carries the
 *    mapping). Sending a region id would ask the API for a scope it cannot
 *    serve, and the strict-city path answers honest-empty — a blank itinerary
 *    with no error to explain it.
 */

export interface PlanIslandConfigProps {
  onSubmit: (formData: FormData) => void
  isGenerating: boolean
  disabled?: boolean
}

/**
 * Date pattern for the island's date triggers.
 *
 * The triggers are 150px wide, which leaves ~92px for the label. `PPP`
 * ("September 30th, 2026") needs ~198px of button at this font and truncates
 * to "September 30...". This pattern needs ~80px and fits with headroom.
 *
 * Exported so the tests assert on the same pattern the component renders
 * rather than a copy that can drift.
 */
export const PLAN_DATE_FORMAT = 'MMM d, yyyy'

const PlanIslandConfig: React.FC<PlanIslandConfigProps> = ({
  onSubmit,
  isGenerating,
  disabled = false,
}) => {
  const { toast } = useToast()
  const [budget, setBudget] = useState('')
  const [pax, setPax] = useState('')
  const [duration, setDuration] = useState('')
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [pillKey, setPillKey] = useState(CITY_PILLS[0].key)
  const [openBudget, setOpenBudget] = useState(false)

  // End date follows from start + duration, exactly as it does in Gala. Without
  // this the two DatePickers were independent and a plan picked for "3 Days"
  // saved with no end date at all. The arithmetic lives in one shared helper so
  // the two surfaces cannot drift apart again.
  useEffect(() => {
    if (!startDate || !duration) return
    const derived = endDateForDuration(startDate, duration)
    if (derived) setEndDate(derived)
  }, [startDate, duration])

  const activePill = CITY_PILLS.find((p) => p.key === pillKey) ?? CITY_PILLS[0]
  const complete =
    budget !== '' && pax !== '' && duration !== '' && selectedInterests.length > 0
  const canSubmit = complete && !isGenerating && !disabled

  const toggleInterest = (label: string) => {
    setSelectedInterests((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    )
  }

  const submit = () => {
    if (!canSubmit) return
    // A hand-edited end date must still agree with the duration, or the saved
    // trip contradicts the plan on screen. Same rule as Gala.
    if (!datesMatchDuration(startDate, endDate, duration)) {
      toast({
        title: 'Invalid Travel Dates',
        description: `The selected travel dates do not match the chosen duration (${duration}). Please adjust your dates.`,
        variant: 'destructive',
      })
      return
    }
    const formData: FormData = {
      budget,
      pax,
      duration,
      // Dates do not reach the generation prompt — the itinerary pipeline never
      // reads them. They are the saved trip's date range, so omitting them here
      // made every Plan Mode save land as "Date not specified".
      dates: { start: startDate, end: endDate },
      selectedInterests,
      trafficAware: true,
      // Resolve the alias here, at the boundary. `activePill.cityId` is a real
      // member id, never the pill's own key.
      cityId: activePill.cityId as CityId,
    }
    onSubmit(formData)
  }

  return (
    <div className="pointer-events-auto">
      {/* Destination — same alias tiles Gala uses, compressed for island width */}
      <div className="px-3 pt-2 pb-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
          Destination
        </div>
        <div
          role="group"
          aria-label="Destination"
          className="grid grid-cols-4 gap-1.5"
        >
          {CITY_PILLS.map((pill) => {
            const isSelected = pill.key === pillKey
            return (
              <button
                key={pill.key}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setPillKey(pill.key)}
                title={`${pill.label} — ${pill.sublabel}`}
                className={cn(
                  'flex flex-col items-center justify-center rounded-lg border py-1.5 px-1 transition-colors',
                  isSelected
                    ? 'bg-gradient-to-b from-blue-700 to-blue-500 text-white border-blue-500'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
                )}
              >
                <pill.Icon className={cn('h-4 w-4', isSelected ? 'text-white' : 'text-gray-400')} aria-hidden="true" />
                <span className="text-[10px] font-semibold leading-tight mt-0.5">{pill.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* Budget */}
      <div className="px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
          Budget Range
        </div>
        <Popover open={openBudget} onOpenChange={setOpenBudget}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-expanded={openBudget}
              aria-haspopup="dialog"
              aria-label="Budget range"
              className="w-full flex items-center justify-between text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white outline-none focus:border-blue-400"
            >
              <span className={budget ? 'text-gray-900' : 'text-gray-400'}>
                {budget || 'Select budget range'}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          {/*
            Radix renders this panel in a portal, so the trigger owns no listbox
            child to point `aria-controls` at. Real buttons with an accessible
            name, plus `aria-expanded` on the trigger, is the honest markup;
            wrapping these in `role="listbox"`/`role="option"` would
            misdescribe a set of buttons.
          */}
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1" align="start">
            {budgetOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setBudget(option)
                  setOpenBudget(false)
                }}
                aria-pressed={budget === option}
                className={cn(
                  'w-full text-left text-sm px-3 py-2 rounded-md hover:bg-blue-50',
                  budget === option && 'bg-blue-50 text-blue-700 font-medium'
                )}
              >
                {option}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      {/* Pax */}
      <div className="px-3 pb-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
          Number of Pax
        </div>
        <div role="group" aria-label="Number of pax" className="grid grid-cols-4 gap-1.5">
          {paxOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              aria-pressed={pax === opt}
              onClick={() => setPax(opt)}
              className={cn(
                'rounded-lg border py-1.5 text-xs font-medium transition-colors',
                pax === opt
                  ? 'bg-gradient-to-b from-blue-700 to-blue-500 text-white border-blue-500'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div className="px-3 pb-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
          Duration
        </div>
        <div role="group" aria-label="Duration" className="grid grid-cols-4 gap-1.5">
          {durationOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              aria-pressed={duration === opt}
              onClick={() => setDuration(opt)}
              className={cn(
                'rounded-lg border py-1.5 text-xs font-medium transition-colors',
                duration === opt
                  ? 'bg-gradient-to-b from-blue-700 to-blue-500 text-white border-blue-500'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>


      {/* Travel dates, in Gala's position between duration and interests. */}
      <div className="px-3 pb-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
          Travel Dates
        </div>
        <div className="flex gap-1.5">
          {/* 150px rather than the component's fixed 220px, which spilled 11px
              past the panel's content edge, and rather than filling the row,
              which stretched the buttons far wider than their labels. The row
              is deliberately left short of the panel width. min-w-0 lets a
              trigger shrink below its content width so the label truncates
              rather than pushing out. The compact date pattern is what makes
              150px viable: `PPP` needs ~198px of button and would truncate. */}
          <DatePicker
            date={startDate}
            setDate={setStartDate}
            placeholder="Start date"
            className="w-[150px] min-w-0"
            dateFormat={PLAN_DATE_FORMAT}
          />
          <DatePicker
            date={endDate}
            setDate={setEndDate}
            placeholder="End date"
            className="w-[150px] min-w-0"
            dateFormat={PLAN_DATE_FORMAT}
          />
        </div>
      </div>
      <div className="border-t border-gray-100" />

      {/* Interests */}
      <div className="px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
          Travel Interests
        </div>
        <div role="group" aria-label="Travel interests" className="grid grid-cols-2 gap-1.5">
          {galaInterests.map(({ label }) => (
            <button
              key={label}
              type="button"
              aria-pressed={selectedInterests.includes(label)}
              onClick={() => toggleInterest(label)}
              className={cn(
                'rounded-lg border py-1.5 px-2 text-xs font-medium transition-colors truncate',
                selectedInterests.includes(label)
                  ? 'bg-gradient-to-b from-blue-700 to-blue-500 text-white border-blue-500'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <div className="border-t border-gray-100 p-2.5">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-b from-blue-700 to-blue-500 hover:to-blue-700 disabled:bg-none disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium text-sm py-2.5 rounded-xl transition-colors"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              <span>Generating itinerary…</span>
            </>
          ) : (
            <span>Generate itinerary</span>
          )}
        </button>
      </div>
    </div>
  )
}

export default PlanIslandConfig
