/**
 * Prompt contract + generator degradation.
 *
 * The prompt is the one part of the on-device pipeline that is pure, so it
 * is the part worth pinning. A 1.7B model obeys the tail of its prompt, so
 * the assertions below are ordered assertions: a fix that moves the period
 * list to the top of the prompt reads as a pass here and a worse plan on
 * device.
 *
 * The generator test only pins the failure paths — the model itself is not
 * loaded. It degrades honestly (a thrown, user-readable Error) rather than
 * returning a half-built trip, and that ladder is the contract callers
 * render into their pending card.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { buildDayPrompt, dayWindow, SLOTS } from '../prompt';
import { generateWithLlama } from '../generateWithLlama';
import type { PlanInput } from '../../data';

/**
 * llama.rn is a native module: on a developer machine the package is present
 * and `require` resolves to it, but in CI on Linux the native artifact is
 * absent and the same `require` throws. Resolving it to a stub here pins the
 * answer on every platform, so the suite's engine-available state does not
 * depend on whether the native build landed in `node_modules`.
 *
 * `virtual: true` is what makes that work when the package is genuinely
 * missing -- without it Jest refuses to register a mock for an unresolvable
 * module and the require falls through to the real, throwing one.
 *
 * The stub deliberately provides only `initLlama`, because that is the one
 * export the availability guard inspects (`'initLlama' in Llama` plus a
 * function check) and the one the generator then destructures. Nothing here
 * runs the model: the generator tests assert on the failure paths that fire
 * before it is ever called.
 */
jest.mock(
  'llama.rn',
  () => ({ initLlama: jest.fn() }),
  { virtual: true }
);

/**
 * The model manager is a native boundary (llama.rn + FileSystem), so it is
 * replaced with a switchable double. The defaults force the state every
 * generation gate must reject: engine present, model absent on disk.
 *
 * `virtual: true` is required, not optional: it registers the factory against
 * the resolved specifier so the double is the module that executes. Without
 * it this registration can be silently skipped while the suite still passes
 * on a developer machine (where the real module happens to reach the same
 * honest rejection for a different reason), and only fails on CI. This is the
 * same flag `sync`/`mealsSync`/`mealTypeMapping` use for their relative
 * boundary mocks, so the whole suite now registers the same way.
 */
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

    // Order is asserted on the string, not just presence: the model reads
    // this line as the schema, so its order is the output order.
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

    // The cap must not swallow the schema line: it is what the model obeys.
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
    // The message is rendered into the Plan screen's pending card verbatim,
    // so it must name the action the user can actually take.
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
    // Plan.tsx does `e instanceof Error ? e.message : fallback`; if the gate
    // ever rejects with a string or a plain object, that branch silently
    // shows the fallback and the real reason is lost.
    const error = await generateWithLlama(baseInput).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    if (error instanceof Error) {
      expect(error.message.length).toBeGreaterThan(0);
    }
  });
});
