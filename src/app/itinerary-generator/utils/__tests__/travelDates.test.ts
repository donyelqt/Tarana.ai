/**
 * Travel-date arithmetic is the contract both the Gala form and Explore's Plan
 * Mode depend on. The inclusive-day rule is the part worth pinning: an
 * off-by-one here silently shifts every saved trip's date range.
 */
import {
  durationDays,
  endDateForDuration,
  inclusiveDayCount,
  datesMatchDuration,
} from '../travelDates'

describe('durationDays', () => {
  it('reads the leading day count from Gala labels', () => {
    expect(durationDays('1 Day')).toBe(1)
    expect(durationDays('2 Days')).toBe(2)
    expect(durationDays('3 Days')).toBe(3)
  })

  it('uses the first number of a range label, matching existing Gala behaviour', () => {
    expect(durationDays('4-5 Days')).toBe(4)
  })

  it('returns null when the label carries no usable count', () => {
    expect(durationDays('Anytime')).toBeNull()
    expect(durationDays('')).toBeNull()
  })
})

describe('endDateForDuration', () => {
  it('ends a one-day trip on the start date itself', () => {
    const start = new Date(2026, 10, 5)
    expect(endDateForDuration(start, '1 Day')?.getDate()).toBe(5)
  })

  it('counts the first day, so two days ends the next day', () => {
    const start = new Date(2026, 10, 5)
    expect(endDateForDuration(start, '2 Days')?.getDate()).toBe(6)
  })

  it('spans a three day trip', () => {
    const start = new Date(2026, 10, 5)
    expect(endDateForDuration(start, '3 Days')?.getDate()).toBe(7)
  })

  it('crosses a month boundary correctly', () => {
    const start = new Date(2026, 9, 30) // Oct 30
    const end = endDateForDuration(start, '3 Days')
    expect(end?.getMonth()).toBe(10) // November
    expect(end?.getDate()).toBe(1)
  })

  it('leaves the end date untouched when there is no start date', () => {
    expect(endDateForDuration(undefined, '3 Days')).toBeUndefined()
  })

  it('leaves the end date untouched when the label has no day count', () => {
    const start = new Date(2026, 10, 5)
    expect(endDateForDuration(start, 'Anytime')).toBeUndefined()
  })
})

describe('inclusiveDayCount', () => {
  it('counts a same-day range as one day', () => {
    const d = new Date(2026, 10, 5)
    expect(inclusiveDayCount(d, new Date(d))).toBe(1)
  })

  it('counts an inclusive range', () => {
    expect(
      inclusiveDayCount(new Date(2026, 10, 5), new Date(2026, 10, 7))
    ).toBe(3)
  })
})

describe('datesMatchDuration', () => {
  it('accepts a range that matches the duration', () => {
    expect(
      datesMatchDuration(new Date(2026, 10, 5), new Date(2026, 10, 7), '3 Days')
    ).toBe(true)
  })

  it('rejects a range that contradicts the duration', () => {
    expect(
      datesMatchDuration(new Date(2026, 10, 5), new Date(2026, 10, 11), '3 Days')
    ).toBe(false)
  })

  it('has nothing to check when dates are missing', () => {
    expect(datesMatchDuration(undefined, new Date(2026, 10, 7), '3 Days')).toBe(true)
    expect(datesMatchDuration(new Date(2026, 10, 5), undefined, '3 Days')).toBe(true)
  })
})