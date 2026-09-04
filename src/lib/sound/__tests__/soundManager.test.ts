import {
  __resetSoundForTests,
  isSoundEnabled,
  playClick,
  playHover,
  setSoundEnabled,
  SOUND_ENABLED_KEY,
} from '../soundManager';

function makeCtx() {
  const gainNode = {
    gain: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
    connect: jest.fn().mockReturnThis(),
  };
  const freqs: number[] = [];
  const oscNode = {
    type: '',
    frequency: {
      get value() {
        return 0;
      },
      set value(v: number) {
        freqs.push(v);
      },
    },
    connect: jest.fn().mockReturnThis(),
    start: jest.fn(),
    stop: jest.fn(),
  };
  const ctx = {
    state: 'running',
    currentTime: 10,
    destination: {},
    resume: jest.fn(),
    createOscillator: jest.fn(() => ({
      type: '',
      frequency: {
        get value() {
          return 0;
        },
        set value(v: number) {
          freqs.push(v);
        },
      },
      connect: jest.fn().mockReturnThis(),
      start: jest.fn(),
      stop: jest.fn(),
    })),
    createGain: jest.fn(() => gainNode),
  };
  return { ctx, oscNode, gainNode, freqs };
}

function withCtx() {
  const built = makeCtx();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).AudioContext = jest.fn(() => built.ctx);
  return built;
}

describe('soundManager', () => {
  beforeEach(() => {
    __resetSoundForTests();
    window.localStorage.clear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).AudioContext = undefined;
  });

  it('defaults to enabled with no stored preference', () => {
    expect(isSoundEnabled()).toBe(true);
  });

  it('persists the toggle round-trip', () => {
    setSoundEnabled(false);
    expect(window.localStorage.getItem(SOUND_ENABLED_KEY)).toBe('0');
    expect(isSoundEnabled()).toBe(false);
    setSoundEnabled(true);
    expect(isSoundEnabled()).toBe(true);
  });

  it('never throws without AudioContext (SSR/old browsers)', () => {
    expect(() => playClick()).not.toThrow();
    expect(() => playHover()).not.toThrow();
  });

  it('plays nothing when disabled', () => {
    const { ctx } = withCtx();
    setSoundEnabled(false);
    playClick();
    playHover();
    expect(ctx.createOscillator).not.toHaveBeenCalled();
  });

  it('click chime uses a lower voice plus shimmer partial', () => {
    const { ctx, freqs } = withCtx();
    setSoundEnabled(true);
    playClick();
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
    expect(freqs).toEqual([1568, 1568 * 1.5]);
  });

  it('hover tick is a distinct higher lighter voice', () => {
    const { ctx, freqs } = withCtx();
    setSoundEnabled(true);
    playHover();
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
    expect(freqs).toEqual([2093]);
  });

  it('hover and click throttle independently', () => {
    const { ctx } = withCtx();
    setSoundEnabled(true);
    playHover();
    playHover();
    playClick();
    playClick();
    // 1 hover osc + 2 click oscs (second of each throttled)
    expect(ctx.createOscillator).toHaveBeenCalledTimes(3);
  });
});