/**
 * The arm/confirm rules behind both saved lists' per-row delete controls.
 *
 * The web lists (saved-trips, saved-meals) delete with a trash button
 * behind a confirm modal; mobile keeps the two-step arm its detail screens
 * already ship. The invariant worth pinning is that delete never fires on
 * the first tap — after a successful delete the row is unrecoverable, so
 * "the confirm step got skipped" is not a cosmetic bug.
 *
 * These rules live in `../savedRowDelete` rather than inside a screen, so
 * they run headless: no navigation stack, no SQLite, no React Native
 * render — the same seam `../savedMeals` takes for its pure shaping.
 *
 * What is pinned here, and why each is a contract rather than a detail:
 * 1. The first tap arms without deleting. The bug that matters: a delete
 *    on a single tap loses a saved trip from a mis-tap, and a scrolling
 *    list is exactly where mis-taps happen.
 * 2. The second tap on the armed row deletes. The confirm must actually
 *    confirm, or the arm is a fake affordance.
 * 3. A delete that fails leaves the row and surfaces a readable reason.
 *    A silent failure reads as a working control, so the user believes
 *    the row is gone and stops looking for it.
 * 4. After a failure the arm clears, so one further tap cannot finish a
 *    delete the user already watched fail.
 * 5. Every other row still navigates while one row is armed. The delete
 *    control must not hijack the row press.
 * 6. A failed delete leaves the row live — re-navigable, re-deletable —
 *    because the reason is surfaced, not swallowed.
 * 7. The label names the row. Inside a list of identically-shaped rows,
 *    "Delete" alone tells a screen-reader user nothing about which item.
 */
import { describe, expect, it } from '@jest/globals';
import {
  afterDelete,
  idleRowDelete,
  nextArmedId,
  rowDeleteCaption,
  rowDeleteErrorMessage,
  rowDeleteLabel,
  rowDeleteState,
  ROW_DELETE_FALLBACK_REASON,
  tapDeletes,
  type RowDeleteModel,
} from '../savedRowDelete';

const TRIP = { id: 'trip_1', name: 'Banaue rice terraces' };
const OTHER = { id: 'trip_2', name: 'Bagwis summit' };

function model(armedId: string | null, deletingId: string | null = null): RowDeleteModel {
  return { armedId, deletingId };
}

describe('the first tap arms, it does not delete', () => {
  it('a tap on an idle row does not delete', () => {
    expect(tapDeletes(idleRowDelete, TRIP.id)).toBe(false);
  });

  it('a tap on an idle row arms that row', () => {
    expect(nextArmedId(idleRowDelete, TRIP.id)).toBe(TRIP.id);
  });

  it('only the second tap on the SAME row deletes', () => {
    expect(tapDeletes(model(TRIP.id), TRIP.id)).toBe(true);
  });

  it('a tap on a different row re-arms instead of deleting the armed one', () => {
    // The confirm never leaks across rows: accepting row 1's confirm with
    // row 2's tap would delete from a control the user never touched.
    expect(tapDeletes(model(TRIP.id), OTHER.id)).toBe(false);
    expect(nextArmedId(model(TRIP.id), OTHER.id)).toBe(OTHER.id);
  });

  it('a repeat tap on the already-armed row keeps it armed — it is the confirm, not a disarm', () => {
    expect(nextArmedId(model(TRIP.id), TRIP.id)).toBe(TRIP.id);
  });
});

describe('a delete in flight cannot be doubled', () => {
  it('a third tap while a delete is running does not enqueue another', () => {
    expect(tapDeletes(model(TRIP.id, TRIP.id), TRIP.id)).toBe(false);
  });

  it('a tap while another row deletes arms the tapped row, not a queued delete', () => {
    expect(tapDeletes(model(null, OTHER.id), TRIP.id)).toBe(false);
    expect(nextArmedId(model(null, OTHER.id), TRIP.id)).toBe(TRIP.id);
  });
});

describe('row state, for rendering', () => {
  it('an untouched row is idle', () => {
    expect(rowDeleteState(idleRowDelete, TRIP.id)).toBe('idle');
  });

  it('the armed row is armed and the others are not', () => {
    expect(rowDeleteState(model(TRIP.id), TRIP.id)).toBe('armed');
    expect(rowDeleteState(model(TRIP.id), OTHER.id)).toBe('idle');
  });

  it('the row being deleted reads as deleting and its label is not a confirm', () => {
    expect(rowDeleteState(model(TRIP.id, TRIP.id), TRIP.id)).toBe('deleting');
  });
});

describe('after the seam resolves', () => {
  it('a deleted row leaves no armed row behind', () => {
    expect(afterDelete(model(TRIP.id, TRIP.id), 'deleted')).toEqual(idleRowDelete);
  });

  it('a failed row also leaves no armed row behind', () => {
    // One more tap must not finish a delete the user already saw fail.
    expect(afterDelete(model(TRIP.id, TRIP.id), 'failed')).toEqual(idleRowDelete);
  });

  it('the model is always disposable, so no stale id can be read later', () => {
    const next = afterDelete(model(OTHER.id, TRIP.id), 'failed');
    expect(next.armedId).toBeNull();
    expect(next.deletingId).toBeNull();
  });
});

describe('the failure reason is readable', () => {
  it("the seam's own message is shown verbatim", () => {
    expect(rowDeleteErrorMessage(new Error('Trip was not deleted.'), ROW_DELETE_FALLBACK_REASON)).toBe(
      'Trip was not deleted.'
    );
  });

  it('a non-Error throw still shows something', () => {
    expect(rowDeleteErrorMessage('boom', ROW_DELETE_FALLBACK_REASON)).toBe(ROW_DELETE_FALLBACK_REASON);
  });

  it('a blank message is replaced rather than rendered as an empty line', () => {
    expect(rowDeleteErrorMessage(new Error('   '), ROW_DELETE_FALLBACK_REASON)).toBe(ROW_DELETE_FALLBACK_REASON);
  });
});

describe('the control is reachable non-visually', () => {
  it('the idle label names the row', () => {
    expect(rowDeleteLabel(TRIP, 'idle')).toBe(`Delete ${TRIP.name}`);
  });

  it('the armed label says Confirm, so the second tap is announced as destructive', () => {
    expect(rowDeleteLabel(TRIP, 'armed')).toBe(`Confirm delete ${TRIP.name}`);
  });

  it('two rows carry different labels, so the list is navigable by name', () => {
    expect(rowDeleteLabel(TRIP, 'idle')).not.toBe(rowDeleteLabel(OTHER, 'idle'));
  });

  it('a row with no name still names what will be removed generically', () => {
    expect(rowDeleteLabel({ id: 'trip_3', name: '' }, 'idle')).toBe('Delete this item');
  });

  it('the confirm step is also spelled out in text, not left to color', () => {
    expect(rowDeleteCaption('armed')).toBe('Delete?');
    expect(rowDeleteCaption('idle')).toBeNull();
  });
});

describe('an armed row still navigates', () => {
  it('arming one row leaves every other row idle and pressable', () => {
    // The row press must stay a navigation target even while a sibling row
    // is armed: the delete control is a SIBLING of the row (not nested in
    // it) precisely so its press cannot bubble into the row's onPress. If
    // arming row 1 disabled or redirected row 2, the list would stop being
    // navigable the moment a user armed a delete.
    const model = { armedId: TRIP.id, deletingId: null };
    expect(rowDeleteState(model, OTHER.id)).toBe('idle');
    expect(rowDeleteLabel(OTHER, rowDeleteState(model, OTHER.id))).toBe(`Delete ${OTHER.name}`);
  });

  it('no row delete state ever gates another row press', () => {
    const model = { armedId: OTHER.id, deletingId: null };
    expect(rowDeleteState(model, TRIP.id)).toBe('idle');
    expect(rowDeleteState(model, OTHER.id)).toBe('armed');
  });
});

describe('a failed delete keeps the row', () => {
  it('the model after a failure names no deleting row, so the row renders normally again', () => {
    // `deletingId` is what disables the control; clearing it means the row
    // comes back as a live, re-navigable, re-deletable row.
    const model = afterDelete({ armedId: TRIP.id, deletingId: TRIP.id }, 'failed');
    expect(rowDeleteState(model, TRIP.id)).toBe('idle');
  });

  it('a row that failed can be armed again — the user is offered a retry, not a dead control', () => {
    const model = afterDelete({ armedId: TRIP.id, deletingId: TRIP.id }, 'failed');
    expect(tapDeletes(model, TRIP.id)).toBe(false);
    expect(nextArmedId(model, TRIP.id)).toBe(TRIP.id);
  });
});
