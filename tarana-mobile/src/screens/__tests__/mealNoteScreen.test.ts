import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockGet = jest.fn<(id: string) => Promise<{ title: string | null; notes: string | null } | null>>();
const mockSave = jest.fn<
  (id: string, fields: { title: string | null; notes: string | null }) => Promise<{ title: string | null; notes: string | null } | null>
>();

jest.mock('../../data/notes', () => ({
  getMealNote: (id: string) => mockGet(id),
  saveMealNote: (id: string, fields: { title: string | null; notes: string | null }) => mockSave(id, fields),
}));

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('../../data/catalog', () => ({ findCafe: () => null }));

import { loadMealNote, saveMealNoteFor } from '../mealNoteScreenContract';

describe('the saved meal screen note contract', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSave.mockReset();
  });

  it('loads the stored note for the open meal', async () => {
    mockGet.mockResolvedValue({ title: 'Lunch', notes: 'Short rib' });
    await expect(loadMealNote('m1')).resolves.toEqual({ title: 'Lunch', notes: 'Short rib' });
    expect(mockGet).toHaveBeenCalledWith('m1');
  });

  it('saves the trimmed payload and returns what the web stored', async () => {
    mockSave.mockResolvedValue({ title: 'Lunch', notes: null });
    const saved = await saveMealNoteFor('m1', { title: '  Lunch  ', notes: '   ' });
    expect(mockSave).toHaveBeenCalledWith('m1', { title: 'Lunch', notes: null });
    expect(saved).toEqual({ title: 'Lunch', notes: null });
  });

  it('propagates a refused save so the screen can show the reason', async () => {
    mockSave.mockRejectedValue(new Error('Invalid input'));
    await expect(saveMealNoteFor('m1', { title: 'x', notes: '' })).rejects.toThrow('Invalid input');
  });

  it('propagates a failed load so the screen can offer a retry', async () => {
    mockGet.mockRejectedValue(new Error('Meal not found'));
    await expect(loadMealNote('m1')).rejects.toThrow('Meal not found');
  });
});