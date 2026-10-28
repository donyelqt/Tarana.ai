'use client';

import { useEffect, useState, useMemo } from 'react';
import { updateItinerary, SavedItinerary } from '@/lib/data';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { ChevronDown, PiggyBank, Wallet, CreditCard, Gem, DollarSign, X } from 'lucide-react';
import { cn } from '@/lib/core';
import { budgetOptions, BUDGET_ICONS } from '@/app/itinerary-generator/data/tripFieldOptions';
import { endDateForDuration } from '@/app/itinerary-generator/utils/travelDates';
import {
  draftFromTrip,
  tripEditChanged,
  tripEditError,
  tripEditPayload,
  dateRangeFromDraft,
  dateRangeFromRowDate,
  rowDateFromDateRange,
  dateToIso,
  parseTags,
  type TripEditDraft,
  type TripDateRange,
} from './tripEdit';

const FIELD_MAX = {
  title: 200,
  // Tags are capped by count, not length, so this is not a per-tag character
  // limit. It is the raw string the count needs room for: N tags plus the
  // N-1 ", " separators between them, with a tag running one character at
  // least, is 3N - 2 long. Sizing it for 50 tags fits any legitimate list
  // while a 51st cannot be typed — the comma it would need never fits.
  // `tripEditError` remains the enforcement; this only keeps the field from
  // accepting what it would refuse.
  tags: 3 * 50 - 2,
};

/** The budget icons by position, matching Gala's ItineraryForm switch. */
const BUDGET_ICON: typeof PiggyBank[] = BUDGET_ICONS;

export function TripEditDialog({
  itinerary,
  open,
  onOpenChange,
  onSaved,
}: {
  itinerary: SavedItinerary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: SavedItinerary) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<TripEditDraft>({
    title: '',
    date: '',
    budget: '',
    tags: '',
  });
  const [dateRange, setDateRange] = useState<TripDateRange>({ start: '', end: '' });
  const [openBudget, setOpenBudget] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Seed the draft + date-pair only when the dialog opens, not on every render:
  // a keystroke re-render must not overwrite what the user is typing.
  useEffect(() => {
    if (open && itinerary) {
      const seeded = draftFromTrip(itinerary);
      setDraft(seeded);
      const range = dateRangeFromDraft(seeded);
      setDateRange(range);
      setBudgetFromRange(range);
      setError(null);
    }
  }, [open, itinerary]);

  /** The budget selected for the row, kept in sync with the pair on seed. */
  const [budgetValue, setBudgetValue] = useState('');

  function setBudgetFromRange(range: TripDateRange) {
    // Budget is independent from dates; this is a no-op placeholder that
    // seeds budget from the draft. See `seedBudgetFromRow`.
    setBudgetValue('');
  }

  // The draft's budget must mirror the row so the Popover trigger shows it.
  useEffect(() => {
    if (open && itinerary) {
      setBudgetValue(itinerary.budget ?? '');
    }
  }, [open, itinerary]);

  const selectedBudgetIcon = useMemo(() => {
    const idx = budgetOptions.indexOf(budgetValue);
    return idx >= 0 ? BUDGET_ICON[idx] : DollarSign;
  }, [budgetValue]);

  const handleDateChange = (field: 'start' | 'end', value: Date | undefined) => {
    const isoDate = value ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}` : '';
    let next: TripDateRange;
    if (field === 'start') {
      // End date auto-derives from start + duration, matching Gala and Plan
      // Mode. A hand-edited end date is overridden when start moves, because
      // the duration is fixed by the trip and a new start needs a new end.
      const duration = itinerary?.formData?.duration ?? '';
      if (value && duration) {
        const derived = endDateForDuration(value, duration);
        next = { start: isoDate, end: derived ? dateToIso(derived) : '' };
      } else {
        next = { start: isoDate, end: '' };
      }
    } else {
      next = { ...dateRange, end: isoDate };
    }
    setDateRange(next);
    // One-sided → null (empty) so we never write a half-filled pair.
    const written = rowDateFromDateRange(next);
    setDraft((d) => ({ ...d, date: written ?? '' }));
  };

  const handleSave = async () => {
    if (!itinerary) return;

    const reason = tripEditError(draft);
    if (reason) {
      setError(reason);
      return;
    }
    // An untouched draft is a no-op save; the write is a wasted round trip
    // and the row would be re-written with identical values.
    if (!tripEditChanged(itinerary, draft)) {
      setError('Nothing has changed yet.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateItinerary(
        itinerary.id,
        tripEditPayload(draft, { dates: dateRange, formData: itinerary.formData })
      );
      // A null return means the row is gone or belongs to someone else; leave
      // the open form rather than silently claiming success.
      if (!updated) {
        setError('This trip could not be saved. It may have been deleted.');
        return;
      }
      await onSaved(updated);
      toast({
        title: 'Success',
        description: 'Trip updated successfully',
        variant: 'success',
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save trip.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedBudget = budgetValue || null;
  const Icon = selectedBudgetIcon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] rounded-3xl border border-gray-200/60 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900">Edit trip</DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Trip title"
              maxLength={FIELD_MAX.title}
              className="w-full rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-gray-900 placeholder:text-gray-400 transition-shadow focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <div className="mt-1 text-xs text-gray-500">
              {draft.title.length}/{FIELD_MAX.title} characters
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">Travel dates</label>
            <div className="grid grid-cols-2 gap-3">
              <DatePicker
                date={dateRange.start ? new Date(dateRange.start) : undefined}
                setDate={(d) => handleDateChange('start', d)}
                placeholder="Start date"
                className="w-full"
                dateFormat="MMM d, yyyy"
              />
              <DatePicker
                date={dateRange.end ? new Date(dateRange.end) : undefined}
                setDate={(d) => handleDateChange('end', d)}
                placeholder="End date"
                className="w-full"
                dateFormat="MMM d, yyyy"
              />
            </div>
            <input type="hidden" value={draft.date} />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">Budget Range</label>
            <Popover open={openBudget} onOpenChange={setOpenBudget}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    "w-full justify-between text-md font-medium",
                    !selectedBudget && "text-muted-foreground",
                    selectedBudget && "border-slate-300 text-gray-700 hover:text-blue-600",
                  )}
                  disabled={isSaving}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    {selectedBudget || 'Select budget range'}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="center">
                <div className="grid gap-1 p-2">
                  {budgetOptions.map((option, idx) => {
                    const OptionIcon = BUDGET_ICON[idx] ?? DollarSign;
                    return (
                      <Button
                        key={option}
                        variant="ghost"
                        className={cn(
                          "w-full flex items-center text-md justify-start gap-2 py-2 px-3 rounded-md text-left",
                          selectedBudget === option && "bg-primary/10",
                        )}
                        onClick={() => {
                          setBudgetValue(option);
                          setDraft((d) => ({ ...d, budget: option }));
                          setOpenBudget(false);
                        }}
                      >
                        <OptionIcon className="w-5 h-5 text-primary" />
                        <span>{option}</span>
                      </Button>
                    );
                  })}
                  {/* Clear */}
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full flex items-center text-md justify-start gap-2 py-2 px-3 rounded-md text-left",
                      !selectedBudget && "bg-primary/10",
                    )}
                    onClick={() => {
                      setBudgetValue('');
                      setDraft((d) => ({ ...d, budget: '' }));
                      setOpenBudget(false);
                    }}
                  >
                    <X className="w-5 h-5 text-gray-500" />
                    <span>Not set</span>
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">Tags</label>
            <input
              type="text"
              value={draft.tags}
              onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
              placeholder="Baguio, food trip"
              maxLength={FIELD_MAX.tags}
              className="w-full rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-gray-900 placeholder:text-gray-400 transition-shadow focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {parseTags(draft.tags).map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Separate tags with commas. A trip can hold at most 50 tags.
            </div>
          </div>
        </div>

        {error ? (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="rounded-xl border border-gray-300 bg-white px-6 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="rounded-xl bg-gradient-to-b from-blue-700 to-blue-500 px-6 py-2 font-medium text-white shadow-lg shadow-blue-500/30 transition-all duration-300 hover:to-blue-700 hover:shadow-xl hover:shadow-blue-500/40 disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
