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
