"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { isSoundEnabled, playClick, playHover, setSoundEnabled } from './soundManager';

interface SoundContextValue {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  play: () => void;
}

const SoundContext = createContext<SoundContextValue | null>(null);

/** Interactive elements that earn hover + click sounds. */
const CLICK_SELECTOR = 'button, a[href], [role="button"]';

export function SoundProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState<boolean>(() => isSoundEnabled());

  const setEnabled = useCallback((on: boolean) => {
    setSoundEnabled(on);
    setEnabledState(on);
    if (on) playClick();
  }, []);

  const play = useCallback(() => playClick(), []);

  useEffect(() => {
    if (!enabled) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest?.(CLICK_SELECTOR)) playClick();
    };
    const onMouseOver = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest?.(CLICK_SELECTOR)) playHover();
    };
    document.addEventListener('pointerdown', onPointerDown, { capture: true });
    document.addEventListener('mouseover', onMouseOver);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, { capture: true });
      document.removeEventListener('mouseover', onMouseOver);
    };
  }, [enabled]);

  const value = useMemo(
    () => ({ enabled, setEnabled, play }),
    [enabled, setEnabled, play]
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useInterfaceSound(): SoundContextValue {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error('useInterfaceSound must be used within SoundProvider');
  return ctx;
}