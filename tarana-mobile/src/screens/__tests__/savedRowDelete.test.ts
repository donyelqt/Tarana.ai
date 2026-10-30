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
    const model = afterDelete({ armedId: TRIP.id, deletingId: TRIP.id }, 'failed');
    expect(rowDeleteState(model, TRIP.id)).toBe('idle');
  });

  it('a row that failed can be armed again — the user is offered a retry, not a dead control', () => {
    const model = afterDelete({ armedId: TRIP.id, deletingId: TRIP.id }, 'failed');
    expect(tapDeletes(model, TRIP.id)).toBe(false);
    expect(nextArmedId(model, TRIP.id)).toBe(TRIP.id);
  });
});
