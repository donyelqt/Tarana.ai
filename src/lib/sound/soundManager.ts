/**
 * Interface sounds — two glass voices, zero-dependency WebAudio synth.
 *
 * Why no library: Howler (~7KB + async fetch) and use-sound (needs mp3
 * assets we do not ship) are overkill for UI blips. A lazily created
 * AudioContext inside the user gesture satisfies autoplay policies; the
 * sidebar toggle satisfies the user-control requirement.
 *
 * Glass recipe: high sine partials with fast exponential decay. Hover is
 * a light high tick; click adds a lower shimmer partial — distinct voices.
 *
 * First-gesture race: resume() is async while osc scheduling is sync, so a
 * brand-new context can still be suspended when the first blip is due. Two
 * guards: (1) unlockAudio() runs on the first pointerdown/keydown anywhere
 * to warm the context early; (2) partials start 10ms in the future so the
 * resume always wins the race.
 */

export const SOUND_ENABLED_KEY = 'tarana-sound-enabled';

// Hover tick: C8, breath-short, whisper gain.
const HOVER_HZ = 2093;
const HOVER_SECONDS = 0.05;
const HOVER_GAIN = 0.02;
// Click chime: G6 + detuned shimmer partial (x1.5), slightly fuller.
const CLICK_HZ = 1568;
const CLICK_SHIMMER_RATIO = 1.5;
const CLICK_SECONDS = 0.09;
const CLICK_GAIN = 0.045;
const CLICK_SHIMMER_GAIN = 0.015;
/** Schedule offset so an in-flight resume() wins before the first sample. */
const START_OFFSET_SECONDS = 0.01;
/** Separate throttle buckets — hover must never eat the click. */
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

/**
 * Warm + resume the context without playing anything. Idempotent — call on
 * the first user gesture anywhere so the first real blip is never swallowed.
 */
export function unlockAudio(): void {
  getContext();
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(SOUND_ENABLED_KEY);
    return raw === null ? true : raw === '1';
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SOUND_ENABLED_KEY, on ? '1' : '0');
  } catch {
    // Private mode etc. — sounds simply do not persist.
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

/** Light glass tick on hover. Never throws, never plays when disabled. */
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
    // Audio is decoration — it must never break interaction.
  }
}

/** Fuller glass chime on click. Never throws, never plays when disabled. */
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
    // Audio is decoration — it must never break interaction.
  }
}

/** Test-only: reset module state between tests. */
export function __resetSoundForTests(): void {
  context = null;
  lastHoverAt = 0;
  lastClickAt = 0;
}