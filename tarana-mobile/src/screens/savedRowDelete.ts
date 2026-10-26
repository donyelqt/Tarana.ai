/**
 * The arm/confirm state machine behind both saved-list rows' delete
 * controls (SavedTrips, SavedCafes).
 *
 * Web parity: the web saved-trips list gives every row a trash button that
 * opens a confirm modal (`src/app/saved-trips/page.tsx:219-266`), and the
 * web saved-meals list does the same from `MealCard.tsx:140-153`. A modal
 * on a scrolling native list needs its own dismissal contract, so mobile
 * keeps the two-step arm this app already ships on its destructive detail
 * actions (TripDetail's delete button, CafeDetail's unsave button) and
 * this module holds the rules they share.
 *
 * The rules live here, not in the screens, because they are the part that
 * must never regress and the part no React Native render is needed to
 * check: a delete on the first tap is unrecoverable, so it is worth
 * pinning to tests that can run headless.
 *
 * Nothing here touches I/O. The screens resolve the profile id and call
 * the data seam; this module only decides what a tap means and what
 * happens to the row afterwards.
 */
import type { LocalMeal, LocalTrip } from '../data';

/** A list row the delete control can act on: an id plus a display name. */
export type DeletableRow = { id: string; name: string };

/** One row's delete-control state. */
export type RowDeleteState = 'idle' | 'armed' | 'deleting';

/**
 * Which row the control is currently acting on, and whether that row is
 * mid-delete. Only one row can be armed at a time — see
 * `nextArmedId` for why.
 */
export type RowDeleteModel = {
  armedId: string | null;
  deletingId: string | null;
};

export const idleRowDelete: RowDeleteModel = { armedId: null, deletingId: null };

/**
 * The label a screen reader announces for the control. It names the row
 * because the control sits inside a list of identically-shaped rows: a
 * bare "Delete" is not actionable for a user who cannot see which row the
 * focus is on. When armed the word changes to "Confirm", because a
 * disabled-looking button whose label did not change would give no
 * non-visual signal that the second tap is now the destructive one.
 */
export function rowDeleteLabel(row: DeletableRow, state: RowDeleteState): string {
  const name = row.name || 'this item';
  if (state === 'armed') return `Confirm delete ${name}`;
  return `Delete ${name}`;
}

/**
 * What the control says under the icon. The confirm step is written out
 * rather than signalled by color alone: an armed row turns red-on-red,
 * which is the one state change a color-blind user may not perceive.
 */
export function rowDeleteCaption(state: RowDeleteState): string | null {
  if (state === 'armed') return 'Delete?';
  return null;
}

/**
 * The row a tap arms: the tapped row, or null to disarm.
 *
 * Only one row may be armed. Two armed rows would mean a user who has
 * lost track of which confirm they accepted can delete the wrong item
 * with a single further tap, so any tap anywhere (on this row, on another
 * row, or on the same row a second time) resolves to at most one armed
 * row. A tap on the ALREADY-armed row keeps it armed — that is the
 * confirm, and it must not silently disarm.
 */
export function nextArmedId(model: RowDeleteModel, tappedId: string): string | null {
  return model.deletingId === tappedId ? model.armedId : tappedId;
}

/**
 * Whether a tap deletes. True only for the second tap on the armed row,
 * and never while a delete is already in flight: a double-tap on the
 * confirm must enqueue one delete, not two.
 */
export function tapDeletes(model: RowDeleteModel, tappedId: string): boolean {
  if (model.deletingId !== null) return false;
  return model.armedId === tappedId;
}

/** Row state for rendering, derived from the model. */
export function rowDeleteState(model: RowDeleteModel, rowId: string): RowDeleteState {
  if (model.deletingId === rowId) return 'deleting';
  if (model.armedId === rowId) return 'armed';
  return 'idle';
}

/** The disposal after a delete attempt resolved. */
export type RowDeleteOutcome = 'deleted' | 'failed';

/**
 * The model after an attempt. On either outcome the arm clears:
 *
 * - deleted — the row is gone from the list, so an arm for it would point
 *   at nothing and the next row appearing under a refreshed focus could
 *   inherit a live confirm.
 * - failed — the row is still there, so keeping the arm would let one
 *   more tap finish a delete the user already saw fail once. The reason
 *   goes to the screen's error line instead (see `rowDeleteErrorMessage`).
 */
export function afterDelete(model: RowDeleteModel, outcome: RowDeleteOutcome): RowDeleteModel {
  void outcome;
  return { armedId: null, deletingId: null };
}

/**
 * The text the screen shows when the seam throws. The seam's own message
 * is preferred when it carries one, so the row the user tapped explains
 * itself; a non-Error throw or a blank message still has to say something
 * readable, because an empty error line reads as a working control.
 */
export function rowDeleteErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

/** The generic reason a screen uses when it has no better one. */
export const ROW_DELETE_FALLBACK_REASON = 'Could not delete this item.';

/** Projection: the delete control's inputs, read off a local trip row. */
export function tripRow(item: LocalTrip): DeletableRow {
  return { id: item.id, name: item.title ?? '' };
}

/** Projection: the same, read off a local meal row. */
export function mealRow(item: LocalMeal): DeletableRow {
  return { id: item.id, name: item.cafe_name };
}
