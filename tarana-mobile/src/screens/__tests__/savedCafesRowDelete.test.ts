import { describe, expect, it } from '@jest/globals';
import {
  afterDelete,
  idleRowDelete,
  mealRow,
  nextArmedId,
  rowDeleteCaption,
  rowDeleteErrorMessage,
  rowDeleteLabel,
  ROW_DELETE_FALLBACK_REASON,
  tapDeletes,
  type RowDeleteModel,
} from '../savedRowDelete';
import type { LocalMeal } from '../../data';

function meal(id: string, cafeName: string): LocalMeal {
  return {
    id,
    profile_id: 'p1',
    cafe_name: cafeName,
    meal_type: 'Lunch',
    price: 250,
    good_for: [],
    location: 'Baguio',
    items: null,
    source: 'local',
    source_id: null,
    imported_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

const second = meal('m2', 'Arca\'s');

describe('mealRow — the projection the screen reader announces', () => {
  it('projects cafe_name as the row name', () => {
    expect(mealRow(second)).toEqual({ id: 'm2', name: 'Arca\'s' });
  });
});

describe('rowDeleteLabel — the control announces the confirm step', () => {
  it('says Delete while idle and Confirm delete while armed', () => {
    expect(rowDeleteLabel(mealRow(second), 'idle')).toBe('Delete Arca\'s');
    expect(rowDeleteLabel(mealRow(second), 'armed')).toBe('Confirm delete Arca\'s');
  });
});

describe('tapDeletes — the second tap, and only the second', () => {
  it('does not delete on the first tap, and deletes on the second', () => {
    const armed: RowDeleteModel = { armedId: 'm2', deletingId: null };
    expect(tapDeletes(idleRowDelete, 'm2')).toBe(false);
    expect(tapDeletes(armed, 'm2')).toBe(true);
  });

  it('refuses a different row while another is armed', () => {
    expect(tapDeletes({ armedId: 'm2', deletingId: null }, 'm9')).toBe(false);
  });

  it('refuses another tap while a delete is in flight', () => {
    expect(tapDeletes({ armedId: 'm2', deletingId: 'm2' }, 'm2')).toBe(false);
  });
});

describe('nextArmedId — one row armed at a time', () => {
  it('arms the tapped row', () => {
    expect(nextArmedId(idleRowDelete, 'm2')).toBe('m2');
  });

  it('keeps the row armed when it is tapped again, so the confirm is reachable', () => {
    expect(nextArmedId({ armedId: 'm2', deletingId: null }, 'm2')).toBe('m2');
  });

  it('moves the arm to a different tapped row', () => {
    expect(nextArmedId({ armedId: 'm2', deletingId: null }, 'm9')).toBe('m9');
  });
});

describe('afterDelete — no stale id survives either outcome', () => {
  it('clears armedId and deletingId after a delete', () => {
    expect(afterDelete({ armedId: 'm2', deletingId: 'm2' }, 'deleted')).toEqual({
      armedId: null,
      deletingId: null,
    });
  });

  it('clears armedId and deletingId after a failure', () => {
    expect(afterDelete({ armedId: 'm2', deletingId: 'm2' }, 'failed')).toEqual({
      armedId: null,
      deletingId: null,
    });
  });
});

describe('rowDeleteCaption — the confirm step is written out', () => {
  it('is a caption while armed and nothing otherwise', () => {
    expect(rowDeleteCaption('armed')).toBe('Delete?');
    expect(rowDeleteCaption('idle')).toBeNull();
    expect(rowDeleteCaption('deleting')).toBeNull();
  });
});

describe('rowDeleteErrorMessage — the user always sees a reason', () => {
  it('uses the thrown message when there is one', () => {
    expect(rowDeleteErrorMessage(new Error('no active profile'), ROW_DELETE_FALLBACK_REASON)).toBe(
      'no active profile'
    );
  });

  it('falls back when the throw carries no message', () => {
    expect(rowDeleteErrorMessage(new Error(''), ROW_DELETE_FALLBACK_REASON)).toBe(
      ROW_DELETE_FALLBACK_REASON
    );
    expect(rowDeleteErrorMessage('boom', ROW_DELETE_FALLBACK_REASON)).toBe(
      ROW_DELETE_FALLBACK_REASON
    );
  });
});
