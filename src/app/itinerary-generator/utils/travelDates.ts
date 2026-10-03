/**
 * Travel-date arithmetic shared by Gala's form and Explore's Plan Mode.
 *
 * This exists because both surfaces let a user pick a start date and a
 * duration, and the end date is derived from the two. When that rule lived
 * only in ItineraryForm, the Plan Mode island shipped with two independent
 * DatePickers and no derivation at all, so a plan picked for "3 Days" saved
 * with no end date and rendered as an incomplete range.
 *
 * One rule, one place. If the arithmetic changes, both surfaces change.
 */

/**
 * Days implied by a duration label such as "1 Day", "2 Days" or "4-5 Days".
 *
 * Returns null for a label with no leading number. Note that "4-5 Days" yields
 * 4, the first number, matching the existing Gala behaviour exactly rather
 * than "improving" it — two surfaces must not disagree about what a label means.
 */
export function durationDays(label: string): number | null {
  const match = label.match(/\d+/);
  if (!match) return null;
  const days = parseInt(match[0], 10);
  return Number.isNaN(days) || days <= 0 ? null : days;
}

/**
 * The end date implied by a start date and a duration label.
 *
 * Inclusive of the first day, so "1 Day" ends on the start date itself and
 * "2 Days" ends one day later. Returns undefined when either input is missing
 * or the label carries no day count, leaving the user's end date untouched
 * rather than clearing it.
 */
export function endDateForDuration(
  start: Date | undefined,
  durationLabel: string
): Date | undefined {
  if (!start) return undefined;
  const days = durationDays(durationLabel);
  if (days === null) return undefined;
  const end = new Date(start);
  end.setDate(start.getDate() + days - 1);
  return end;
}

/** Whole days between two dates, counting the first day. */
export function inclusiveDayCount(start: Date, end: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((end.getTime() - start.getTime()) / msPerDay) + 1;
}

/**
 * True when a chosen range matches the chosen duration.
 *
 * Returns true when there is nothing to check, so callers can gate on this
 * alone without first testing whether dates were picked.
 */
export function datesMatchDuration(
  start: Date | undefined,
  end: Date | undefined,
  durationLabel: string
): boolean {
  if (!start || !end) return true;
  const days = durationDays(durationLabel);
  if (days === null) return true;
  return inclusiveDayCount(start, end) === days;
}