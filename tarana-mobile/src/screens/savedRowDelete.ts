import type { LocalMeal, LocalTrip } from '../data';

export type DeletableRow = { id: string; name: string };

export type RowDeleteState = 'idle' | 'armed' | 'deleting';

export type RowDeleteModel = {
  armedId: string | null;
  deletingId: string | null;
};

export const idleRowDelete: RowDeleteModel = { armedId: null, deletingId: null };

export function rowDeleteLabel(row: DeletableRow, state: RowDeleteState): string {
  const name = row.name || 'this item';
  if (state === 'armed') return `Confirm delete ${name}`;
  return `Delete ${name}`;
}

export function rowDeleteCaption(state: RowDeleteState): string | null {
  if (state === 'armed') return 'Delete?';
  return null;
}

export function nextArmedId(model: RowDeleteModel, tappedId: string): string | null {
  return model.deletingId === tappedId ? model.armedId : tappedId;
}

export function tapDeletes(model: RowDeleteModel, tappedId: string): boolean {
  if (model.deletingId !== null) return false;
  return model.armedId === tappedId;
}

export function rowDeleteState(model: RowDeleteModel, rowId: string): RowDeleteState {
  if (model.deletingId === rowId) return 'deleting';
  if (model.armedId === rowId) return 'armed';
  return 'idle';
}

export type RowDeleteOutcome = 'deleted' | 'failed';

export function afterDelete(model: RowDeleteModel, outcome: RowDeleteOutcome): RowDeleteModel {
  void outcome;
  return { armedId: null, deletingId: null };
}

export function rowDeleteErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export const ROW_DELETE_FALLBACK_REASON = 'Could not delete this item.';

export function tripRow(item: LocalTrip): DeletableRow {
  return { id: item.id, name: item.title ?? '' };
}

export function mealRow(item: LocalMeal): DeletableRow {
  return { id: item.id, name: item.cafe_name };
}
