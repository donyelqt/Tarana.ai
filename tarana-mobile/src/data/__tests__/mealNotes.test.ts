import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockFetch = jest.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
globalThis.fetch = mockFetch as unknown as typeof fetch;

jest.mock('../../config', () => ({
  config: { webBaseUrl: 'http://localhost:3000' },
  requireConfig: (key: string) => {
    throw new Error(`Missing config: ${key}`);
  },
}));

jest.mock('../../auth', () => ({
  withMobileAuth: jest.fn(async (headers: Record<string, string> = {}) => ({
    ...headers,
    Authorization: 'Bearer test-token',
  })),
}));

import { getMealNote, saveMealNote } from '../notes';

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('meal note sync against the web saved_meal_notes contract', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('reads the notes object the web GET returns', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: { id: 'm1' }, notes: { title: 'Lunch', notes: 'Short rib' } }));
    const row = await getMealNote('m1');
    expect(row?.title).toBe('Lunch');
    expect(row?.notes).toBe('Short rib');
  });

  it('returns null when the web has no notes row for the meal', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: { id: 'm1' }, notes: null }));
    await expect(getMealNote('m1')).resolves.toBeNull();
  });

  it('sends the web PATCH shape and reports the saved notes', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, data: { title: 'Lunch', notes: 'Short rib' } }));
    const saved = await saveMealNote('m1', { title: 'Lunch', notes: 'Short rib' });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/api/saved-meals/m1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ title: 'Lunch', notes: 'Short rib' });
    expect(saved?.title).toBe('Lunch');
  });

  it('sends null, not an empty string, for a cleared field', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true, data: { title: null, notes: null } }));
    await saveMealNote('m1', { title: '   ', notes: '' });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ title: null, notes: null });
  });

  it('surfaces a rejected write instead of reporting success', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: 'Invalid input' }, 400));
    await expect(saveMealNote('m1', { title: 'x'.repeat(201), notes: null })).rejects.toThrow(
      'Invalid input'
    );
  });

  it('surfaces a missing meal instead of reporting success', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: 'Meal not found' }, 404));
    await expect(saveMealNote('m1', { title: 'Lunch', notes: null })).rejects.toThrow(
      'Meal not found'
    );
  });
});