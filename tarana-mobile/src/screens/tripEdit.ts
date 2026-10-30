

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

export function dateToIso(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseLocaleDateToIso(token: string): string | null {
  const d = new Date(token);
  if (Number.isNaN(d.getTime())) return null;
  return dateToIso(d);
}

export function deriveEndDate(
  startIso: string | null,
  durationLabel: string
): string | null {
  if (!startIso) return null;
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return null;
  const derived = endDateForDuration(start, durationLabel);
  return derived ? dateToIso(derived) : null;
}

export type TripEditDraft = {
  title: string;
  date: string;
  endDate: string;
  budget: string;
  tags: string;
};

export function draftFromTrip(trip: {
  title: string | null;
  date: string | null;
  budget: string | null;
  tags: string[];
  payload?: string | null;
}): TripEditDraft {
  const form = parsePayloadDates(trip.payload);
  return {
    title: trip.title ?? '',
    date: trip.date ?? '',
    endDate: form.end ?? '',
    budget: trip.budget ?? '',
    tags: (trip.tags ?? []).join(', '),
  };
}

function parsePayloadDates(raw: string | null | undefined): { start: string; end: string } {
  if (!raw) return { start: '', end: '' };
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.formData?.dates) {
      return {
        start: parsed.formData.dates.start ?? '',
        end: parsed.formData.dates.end ?? '',
      };
    }
  } catch {
  }
  return { start: '', end: '' };
}

export function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export function tripEditError(draft: TripEditDraft): string | null {
  if (draft.title.trim().length === 0) return 'Give the trip a title before saving.';
  return null;
}

export function tripEditChanged(trip: {
  title: string | null;
  date: string | null;
  budget: string | null;
  tags: string[];
  payload?: string | null;
}, draft: TripEditDraft): boolean {
  if ((trip.title ?? '') !== draft.title) return true;
  if ((trip.date ?? '') !== draft.date) return true;
  const form = parsePayloadDates(trip.payload);
  if (form.end !== draft.endDate) return true;
  if ((trip.budget ?? '') !== draft.budget) return true;
  const stored = [...(trip.tags ?? [])];
  const edited = parseTags(draft.tags);
  if (stored.length !== edited.length) return true;
  return stored.some((tag, i) => tag !== edited[i]);
}

export function tripEditPayload(
  draft: TripEditDraft,
  options?: {
    payload?: string | null;
  }
): {
  title: string;
  date: string | null;
  budget: string | null;
  tags: string[];
  payload?: string | null;
} {
  const base = {
    title: draft.title.trim(),
    date: draft.date.trim() === '' ? null : draft.date.trim(),
    budget: draft.budget.trim() === '' ? null : draft.budget.trim(),
    tags: parseTags(draft.tags),
  };

  const startIso = base.date;
  const endIso = draft.endDate.trim() === '' ? null : draft.endDate.trim();

  if (!startIso) {
    return { ...base, payload: patchPayloadEndDate(options?.payload ?? null, '', '') };
  }

  if (!endIso) return { ...base, payload: options?.payload ?? null };

  const patched = patchPayloadEndDate(options?.payload ?? null, startIso, endIso);
  return { ...base, payload: patched };
}

function patchPayloadEndDate(
  rawPayload: string | null,
  startIso: string,
  endIso: string
): string | null {
  if (!rawPayload) return null;
  try {
    const parsed = JSON.parse(rawPayload);
    if (typeof parsed !== 'object' || parsed === null) return rawPayload;
    if (!parsed.formData || typeof parsed.formData !== 'object') {
      parsed.formData = {};
    }
    parsed.formData.dates = { start: startIso, end: endIso };
    return JSON.stringify(parsed);
  } catch {
    return rawPayload;
  }
}
