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
    expect((screen.getByPlaceholderText('YYYY-MM-DD') as HTMLInputElement).value).toBe('2026-03-04');
    expect((screen.getByPlaceholderText('5000') as HTMLInputElement).value).toBe('5000');
    expect((screen.getByPlaceholderText('Baguio, food trip') as HTMLInputElement).value).toBe(
      'Baguio, food trip'
    );
  });

  it('does not seed from formData, whose budget differs on purpose', () => {
    renderDialog();
    // formData.budget is 9000; the row's is 5000. Showing 9000 would mean the
    // editor is reading the payload it is not allowed to edit.
    expect((screen.getByPlaceholderText('5000') as HTMLInputElement).value).toBe('5000');
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
      },
    });
  });

  it('sends null for a cleared budget while a date remains', async () => {
    renderDialog();
    fireEvent.change(screen.getByPlaceholderText('5000'), { target: { value: '' } });
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
    fireEvent.change(screen.getByPlaceholderText('YYYY-MM-DD'), { target: { value: '' } });
    fireEvent.change(screen.getByPlaceholderText('5000'), { target: { value: '' } });
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
