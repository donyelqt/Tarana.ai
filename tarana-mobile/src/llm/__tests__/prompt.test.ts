import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { buildDayPrompt, dayWindow, SLOTS } from '../prompt';
import { generateWithLlama } from '../generateWithLlama';
import type { PlanInput } from '../../data';

jest.mock(
  'llama.rn',
  () => ({ initLlama: jest.fn() }),
  { virtual: true }
);

const mockStatus = {
  available: true,
  state: 'not-downloaded' as 'ready' | 'not-downloaded' | 'downloading' | 'downloading-incomplete' | 'unsupported',
  path: '/models/model.gguf' as string | null,
};

jest.mock('../modelManager', () => ({
  isLlamaAvailable: () => mockStatus.available,
  getModelStatus: async () => ({
    state: mockStatus.state,
    bytesDownloaded: 0,
    bytesTotal: 0,
    path: mockStatus.path,
  }),
  getModelPath: () => '/models/model.gguf',
}), { virtual: true });

const baseInput: PlanInput = {
  city: 'baguio',
  budget: 12000,
  pax: 3,
  days: 3,
  startDate: '2026-10-03',
  endDate: '2026-10-05',
  interests: ['Food', 'Nature'],
};

describe('buildDayPrompt', () => {
  it('demands the three periods in render order', () => {
    const prompt = buildDayPrompt(baseInput, 0, []);

    expect(SLOTS).toEqual(['Morning', 'Afternoon', 'Evening']);
    expect(prompt).toContain('Give exactly three periods in order: Morning (8-12), Afternoon (12-18), Evening (18+).');

    const order = ['Morning', 'Afternoon', 'Evening'].map((slot) => prompt.indexOf(slot));
    expect(order[0]).toBeLessThan(order[1]);
    expect(order[1]).toBeLessThan(order[2]);
  });

  it('injects city, budget, pax, and interests', () => {
    const prompt = buildDayPrompt(baseInput, 0, []);

    expect(prompt).toContain('trip to baguio');
    expect(prompt).toContain('Budget PHP 12000 total for 3 people');
    expect(prompt).toContain('Interests: Food, Nature');
  });

  it('advances the date per dayIndex', () => {
    expect(dayWindow('2026-10-03', 0)).toBe('2026-10-03');
    expect(dayWindow('2026-10-03', 1)).toBe('2026-10-04');
    expect(dayWindow('2026-10-03', 2)).toBe('2026-10-05');

    expect(buildDayPrompt(baseInput, 0, [])).toContain('Date: 2026-10-03');
    expect(buildDayPrompt(baseInput, 1, [])).toContain('Date: 2026-10-04');
    expect(buildDayPrompt(baseInput, 2, [])).toContain('Date: 2026-10-05');
  });

  it('crosses month boundaries when advancing', () => {
    expect(dayWindow('2026-01-30', 2)).toBe('2026-02-01');
  });

  it('excludes prior titles so the model revisits nowhere', () => {
    const prompt = buildDayPrompt(baseInput, 1, ['Burnham Park', 'Session Road']);

    expect(prompt).toContain('Do not reuse these previously planned stops: Burnham Park; Session Road.');
    expect(prompt).not.toContain('Do not reuse these previously planned stops: Burnham Park; Session Road..');
  });

  it('omits the do-not-reuse line when nothing has been planned', () => {
    const prompt = buildDayPrompt(baseInput, 0, []);

    expect(prompt).not.toContain('Do not reuse');
  });

  it('caps the reuse list so the period order stays in the tail', () => {
    const many = Array.from({ length: 40 }, (_, i) => `Stop ${i + 1}`);
    const prompt = buildDayPrompt(baseInput, 5, many);

    expect(prompt).toContain('Stop 17');
    expect(prompt).toContain('Stop 40');
    expect(prompt).not.toContain('Stop 16');

    expect(prompt.indexOf('Give exactly three periods in order')).toBeGreaterThan(prompt.lastIndexOf('Do not reuse'));
  });

  it('is deterministic for the same inputs', () => {
    expect(buildDayPrompt(baseInput, 1, ['A', 'B'])).toBe(buildDayPrompt(baseInput, 1, ['A', 'B']));
  });
});

describe('generateWithLlama degradation', () => {
  beforeEach(() => {
    mockStatus.available = true;
    mockStatus.state = 'not-downloaded';
    mockStatus.path = '/models/model.gguf';
  });

  it('throws a user-readable reason when the model is not downloaded', async () => {
    await expect(generateWithLlama(baseInput)).rejects.toThrow(
      'Download the local model before generating a plan.'
    );
  });

  it('throws when an interrupted download left an incomplete file', async () => {
    mockStatus.state = 'downloading-incomplete';

    await expect(generateWithLlama(baseInput)).rejects.toThrow(
      'Download the local model before generating a plan.'
    );
  });

  it('throws when the engine is unavailable in this build', async () => {
    mockStatus.available = false;
    mockStatus.state = 'unsupported';
    mockStatus.path = null;

    await expect(generateWithLlama(baseInput)).rejects.toThrow(
      'The local model engine is unavailable in this build.'
    );
  });

  it('reports the same reason twice, so a retry stays honest', async () => {
    await expect(generateWithLlama(baseInput)).rejects.toThrow(
      'Download the local model before generating a plan.'
    );
    await expect(generateWithLlama(baseInput)).rejects.toThrow(
      'Download the local model before generating a plan.'
    );
  });

  it('throws an Error, so callers can read .message without a type check', async () => {
    const error = await generateWithLlama(baseInput).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    if (error instanceof Error) {
      expect(error.message.length).toBeGreaterThan(0);
    }
  });
});
