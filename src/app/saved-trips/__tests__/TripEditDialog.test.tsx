/**
 * The dialog's own contract — what it sends, and what it refuses to send.
 *
 * `tripEdit.test.ts` pins the pure rules; this suite pins that the dialog
 * actually routes through them, because a save button wired to the wrong
 * payload would pass every pure test and still write nothing.
 *
 * The write is mocked at the module boundary so the assertions are about the
 * payload handed to `updateItinerary`, not about Supabase. jsdom provides the
 * DOM; `ToastProvider` is required because the component toasts on success and
 * `useToast` throws outside one.
 *
 * `DatePicker` is mocked as a plain `<input type="date">` because the real
 * picker renders a full calendar grid that jsdom cannot drive; the dialog's
 * contract for dates is "read/write an ISO string", which the mock preserves.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const calls: { id: string; payload: unknown }[] = [];

jest.mock('@/lib/data', () => ({
  updateItinerary: async (id: string, payload: unknown) => {
    calls.push({ id, payload });
    return { id, ...(payload as Record<string, unknown>) };
  },
}));

jest.mock('@/components/ui/date-picker', () => ({
  DatePicker: ({ date, setDate, placeholder }: any) => (
    <input
      type="date"
      data-testid={placeholder}
      value={date instanceof Date ? date.toISOString().split('T')[0] : ''}
      onChange={(e) => setDate(e.target.value ? new Date(e.target.value) : undefined)}
    />
  ),
}));

import { ToastProvider } from '@/components/ui/use-toast';
import { TripEditDialog } from '../TripEditDialog';
import type { SavedItinerary } from '@/lib/data';

/** A row whose payload carries different values from the row's own columns. */
const itinerary: SavedItinerary = {
  id: 'itin-1',
  title: 'Baguio Loop',
  date: '2026-03-04',
  budget: '5000',
  image: '/images/burnham.jpg',
  tags: ['Baguio', 'food trip'],
  formData: {
    budget: '9000',
    pax: '2',
    duration: '1 day',
    dates: { start: '2026-03-04', end: '2026-03-04' },
    selectedInterests: ['Culture & Arts'],
  },
  itineraryData: { title: 'Baguio Loop', subtitle: 'A day out', items: [] },
  createdAt: '2026-03-01T00:00:00.000Z',
};

function renderDialog(open = true, onOpenChange = () => {}) {
  return render(
    <ToastProvider>
      <TripEditDialog
        itinerary={itinerary}
        open={open}
        onOpenChange={onOpenChange}
        onSaved={async () => {}}
      />
    </ToastProvider>
  );
}

beforeEach(() => {
  calls.length = 0;
});

describe('TripEditDialog — the form is seeded from the row, not the payload', () => {
  it('shows the row title, date, budget and tags', () => {
    renderDialog();
    expect((screen.getByPlaceholderText('Trip title') as HTMLInputElement).value).toBe('Baguio Loop');
    const dateInputs = screen.getAllByTestId('Start date');
    expect((dateInputs[0] as HTMLInputElement).value).toBe('2026-03-04');
    expect((screen.getAllByTestId('End date')[0] as HTMLInputElement).value).toBe('2026-03-04');
    expect(screen.getByText('5000')).toBeTruthy();
    expect((screen.getByPlaceholderText('Baguio, food trip') as HTMLInputElement).value).toBe(
      'Baguio, food trip'
    );
  });

  it('does not seed from formData, whose budget differs on purpose', () => {
    renderDialog();
    // formData.budget is 9000; the row's is 5000. Showing 9000 would mean the
    // editor is reading the payload it is not allowed to edit.
    expect(screen.getByText('5000')).toBeTruthy();
  });
});

describe('TripEditDialog — a permitted save writes the edited fields', () => {
  it('sends the trimmed draft through updateItinerary', async () => {
    renderDialog();
    fireEvent.change(screen.getByPlaceholderText('Trip title'), {
      target: { value: 'Baguio Loop v2' },
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Save Changes'));
    });

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({
      id: 'itin-1',
      payload: {
        title: 'Baguio Loop v2',
        date: '2026-03-04',
        budget: '5000',
        tags: ['Baguio', 'food trip'],
        formData: {
          budget: '9000',
          pax: '2',
          duration: '1 day',
          dates: { start: '2026-03-04', end: '2026-03-04' },
          selectedInterests: ['Culture & Arts'],
        },
      },
    });
  });

  it('sends null for a cleared budget while a date remains', async () => {
    renderDialog();
    // Open the budget popover and click "Not set".
    const budgetButton = screen.getByText('5000').closest('button')!;
    await act(async () => {
      fireEvent.click(budgetButton);
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Not set'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Save Changes'));
    });

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].payload).toMatchObject({ title: 'Baguio Loop', date: '2026-03-04', budget: null });
  });

  it('parses edited tags into an array, dropping blanks', async () => {
    renderDialog();
    fireEvent.change(screen.getByPlaceholderText('Baguio, food trip'), {
      target: { value: 'Baguio, , food trip, photos' },
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Save Changes'));
    });

    await waitFor(() => expect(calls).toHaveLength(1));
    expect((calls[0].payload as { tags: string[] }).tags).toEqual(['Baguio', 'food trip', 'photos']);
  });
});

describe('TripEditDialog — a refused save writes nothing', () => {
  it('blocks a blank title without calling the writer', async () => {
    renderDialog();
    fireEvent.change(screen.getByPlaceholderText('Trip title'), { target: { value: '   ' } });
    await act(async () => {
      fireEvent.click(screen.getByText('Save Changes'));
    });
    expect(await screen.findByText('Give the trip a title before saving.')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('allows clearing both date and budget and writes nulls', async () => {
    renderDialog();
    fireEvent.change(screen.getAllByTestId('Start date')[0], { target: { value: '' } });
    fireEvent.change(screen.getAllByTestId('End date')[0], { target: { value: '' } });
    // Clear budget via the popover.
    await act(async () => {
      fireEvent.click(screen.getByText('5000').closest('button')!);
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Not set'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Save Changes'));
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].payload).toMatchObject({ date: null, budget: null });
  });

  it('blocks a save with nothing changed', async () => {
    renderDialog();
    await act(async () => {
      fireEvent.click(screen.getByText('Save Changes'));
    });
    expect(await screen.findByText('Nothing has changed yet.')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });
});

describe('TripEditDialog — the end date follows the start date and the duration', () => {
  it('derives the end date from the start date when the start changes', () => {
    renderDialog();
    // The row's duration is '1 day', so a one-day trip that starts on the 10th
    // ends on the 10th. Before this rule the end picker stayed on the row's
    // old date, so a moved start produced a range nobody asked for.
    fireEvent.change(screen.getAllByTestId('Start date')[0], {
      target: { value: '2026-03-10' },
    });
    expect((screen.getAllByTestId('Start date')[0] as HTMLInputElement).value).toBe(
      '2026-03-10'
    );
    expect((screen.getAllByTestId('End date')[0] as HTMLInputElement).value).toBe(
      '2026-03-10'
    );
  });

  it('derives a multi-day end date from the start date and the duration', () => {
    // A 3-day duration from the 10th ends on the 12th, inclusive of the
    // first day — the same rule Gala and Plan Mode use.
    render(
      <ToastProvider>
        <TripEditDialog
          itinerary={{ ...itinerary, formData: { ...itinerary.formData, duration: '3 Days' } }}
          open={true}
          onOpenChange={() => {}}
          onSaved={async () => {}}
        />
      </ToastProvider>
    );
    fireEvent.change(screen.getAllByTestId('Start date')[0], {
      target: { value: '2026-03-10' },
    });
    expect((screen.getAllByTestId('End date')[0] as HTMLInputElement).value).toBe(
      '2026-03-12'
    );
  });

  it('clears the end date when the start date is cleared', () => {
    // A one-sided pair has no honest single-string form, so the end goes with
    // the start rather than being left behind as a stale half-pair.
    renderDialog();
    fireEvent.change(screen.getAllByTestId('Start date')[0], { target: { value: '' } });
    expect((screen.getAllByTestId('Start date')[0] as HTMLInputElement).value).toBe('');
    expect((screen.getAllByTestId('End date')[0] as HTMLInputElement).value).toBe('');
  });

  it('writes the derived pair when the trip is saved', async () => {
    renderDialog();
    fireEvent.change(screen.getAllByTestId('Start date')[0], {
      target: { value: '2026-03-10' },
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Save Changes'));
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].payload).toMatchObject({
      date: `${new Date(2026, 2, 10).toLocaleDateString()} - ${new Date(
        2026,
        2,
        10
      ).toLocaleDateString()}`,
    });
  });

  it('writes the derived pair into formData.dates, not just the date column', async () => {
    // The detail view reads its dates from formData.dates, so a save that
    // only updated the date column left the detail page showing the old
    // dates. The two have to move together.
    renderDialog();
    fireEvent.change(screen.getAllByTestId('Start date')[0], {
      target: { value: '2026-03-10' },
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Save Changes'));
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].payload).toMatchObject({
      formData: { dates: { start: '2026-03-10', end: '2026-03-10' } },
    });
  });

  it('writes a multi-day derived end into formData.dates', async () => {
    render(
      <ToastProvider>
        <TripEditDialog
          itinerary={{ ...itinerary, formData: { ...itinerary.formData, duration: '3 Days' } }}
          open={true}
          onOpenChange={() => {}}
          onSaved={async () => {}}
        />
      </ToastProvider>
    );
    fireEvent.change(screen.getAllByTestId('Start date')[0], {
      target: { value: '2026-03-10' },
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Save Changes'));
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].payload).toMatchObject({
      formData: { dates: { start: '2026-03-10', end: '2026-03-12' } },
    });
  });
});
