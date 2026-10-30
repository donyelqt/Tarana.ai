
export const SOUND_ENABLED_KEY = 'tarana-sound-enabled';

const HOVER_HZ = 2093;
const HOVER_SECONDS = 0.05;
const HOVER_GAIN = 0.02;
const CLICK_HZ = 1568;
const CLICK_SHIMMER_RATIO = 1.5;
const CLICK_SECONDS = 0.09;
const CLICK_GAIN = 0.045;
const CLICK_SHIMMER_GAIN = 0.015;
const START_OFFSET_SECONDS = 0.01;
const HOVER_GAP_MS = 80;
const CLICK_GAP_MS = 35;

let context: AudioContext | null = null;
let lastHoverAt = 0;
let lastClickAt = 0;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    if (!context) context = new Ctor();
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

export function unlockAudio(): void {
  getContext();
}

function systemPrefersQuiet(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  } catch {
    return false;
  }
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(SOUND_ENABLED_KEY);
    if (raw !== null) return raw === '1';
    return !systemPrefersQuiet();
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SOUND_ENABLED_KEY, on ? '1' : '0');
  } catch {
  }
}

function partial(
  ctx: AudioContext,
  hz: number,
  seconds: number,
  gainValue: number
): void {
  const startAt = ctx.currentTime + START_OFFSET_SECONDS;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = hz;
  gain.gain.setValueAtTime(gainValue, startAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + seconds);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + seconds);
}

function fire(getLast: () => number, setLast: (t: number) => void, gap: number): AudioContext | null {
  if (!isSoundEnabled()) return null;
  const now = Date.now();
  if (now - getLast() < gap) return null;
  setLast(now);
  return getContext();
}

export function playHover(): void {
  const ctx = fire(
    () => lastHoverAt,
    (t) => {
      lastHoverAt = t;
    },
    HOVER_GAP_MS
  );
  if (!ctx) return;
  try {
    partial(ctx, HOVER_HZ, HOVER_SECONDS, HOVER_GAIN);
  } catch {
  }
}

export function playClick(): void {
  const ctx = fire(
    () => lastClickAt,
    (t) => {
      lastClickAt = t;
    },
    CLICK_GAP_MS
  );
  if (!ctx) return;
  try {
    partial(ctx, CLICK_HZ, CLICK_SECONDS, CLICK_GAIN);
    partial(ctx, CLICK_HZ * CLICK_SHIMMER_RATIO, CLICK_SECONDS, CLICK_SHIMMER_GAIN);
  } catch {
  }
}

export function __resetSoundForTests(): void {
  context = null;
  lastHoverAt = 0;
  lastClickAt = 0;
}