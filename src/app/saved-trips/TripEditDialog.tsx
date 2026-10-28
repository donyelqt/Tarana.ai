'use client';

import { useEffect, useState } from 'react';
import { updateItinerary, SavedItinerary } from '@/lib/data';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  draftFromTrip,
  tripEditChanged,
  tripEditError,
  tripEditPayload,
  MAX_TAGS,
  type TripEditDraft,
} from './tripEdit';

/**
 * The editor for a trip's own four fields.
 *
 * Why the list page owns it: the detail page renders `date`, `budget` and
 * `tags` out of `formData`, the generator's inputs, and only falls back to
 * the row columns. An editor on that page would write the columns and show
 * the old payload values, so a user who changed the budget would watch the
 * tile keep saying 5000. Here the values on screen are the row's own, so a
 * save is visible the moment it lands.
 *
 * Why it is a dialog: the grid row is the display surface, and an inline
 * editor would resize every card around it. The draft is copied on open so a
 * half-typed title never reaches the row a render would show.
 */

const FIELD_MAX = {
  title: 200,
  date: 100,
  budget: 100,
  // Tags are capped by count, not length, so this is not a per-tag character
  // limit. It is the raw string the count needs room for: N tags plus the
  // N-1 ", " separators between them, with a tag running one character at
  // least, is 3N - 2 long. Sizing it for 50 tags fits any legitimate list
  // while a 51st cannot be typed — the comma it would need never fits.
  // `tripEditError` remains the enforcement; this only keeps the field from
  // accepting what it would refuse.
  tags: 3 * MAX_TAGS - 2,
};

export function TripEditDialog({
  itinerary,
  open,
  onOpenChange,
  onSaved,
}: {
  itinerary: SavedItinerary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<TripEditDraft>({
    title: '',
    date: '',
    budget: '',
    tags: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Copy the row into a draft only when the dialog opens, not on every render:
  // a keystroke re-render must not overwrite what the user is typing.
  useEffect(() => {
    if (open && itinerary) {
      setDraft(draftFromTrip(itinerary));
      setError(null);
    }
  }, [open, itinerary]);

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
      const updated = await updateItinerary(itinerary.id, tripEditPayload(draft));
      // A null return means the row is gone or belongs to someone else; leave
      // the open form rather than silently claiming success.
      if (!updated) {
        setError('This trip could not be saved. It may have been deleted.');
        return;
      }
      await onSaved();
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
            <label className="mb-2 block text-sm font-semibold text-gray-900">Date</label>
            <input
              type="text"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              placeholder="YYYY-MM-DD"
              maxLength={FIELD_MAX.date}
              className="w-full rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-gray-900 placeholder:text-gray-400 transition-shadow focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <div className="mt-1 text-xs text-gray-500">
              {draft.date.length}/{FIELD_MAX.date} characters
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900">Budget</label>
            <input
              type="text"
              value={draft.budget}
              onChange={(e) => setDraft({ ...draft, budget: e.target.value })}
              placeholder="5000"
              maxLength={FIELD_MAX.budget}
              className="w-full rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-gray-900 placeholder:text-gray-400 transition-shadow focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <div className="mt-1 text-xs text-gray-500">
              {draft.budget.length}/{FIELD_MAX.budget} characters
            </div>
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
            <div className="mt-1 text-xs text-gray-500">
              Separate tags with commas. A trip can hold at most {MAX_TAGS} tags.
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
