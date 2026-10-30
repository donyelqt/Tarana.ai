
export function durationDays(label: string): number | null {
  const match = label.match(/\d+/);
  if (!match) return null;
  const days = parseInt(match[0], 10);
  return Number.isNaN(days) || days <= 0 ? null : days;
}

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

export function inclusiveDayCount(start: Date, end: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((end.getTime() - start.getTime()) / msPerDay) + 1;
}

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