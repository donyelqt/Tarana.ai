import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SoundProvider, useInterfaceSound } from '../SoundProvider';
import * as manager from '../soundManager';

function Harness() {
  const { enabled, setEnabled } = useInterfaceSound();
  return (
    <button onClick={() => setEnabled(!enabled)}>
      {enabled ? 'on' : 'off'}
    </button>
  );
}

describe('SoundProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  it('toggles, persists, and plays a confirmation blip on enable', () => {
    const playSpy = jest.spyOn(manager, 'playClick').mockImplementation(() => {});
    render(
      <SoundProvider>
        <Harness />
      </SoundProvider>
    );
    const btn = screen.getByRole('button', { name: 'on' });
    fireEvent.click(btn);
    expect(window.localStorage.getItem('tarana-sound-enabled')).toBe('0');
    expect(screen.getByRole('button', { name: 'off' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'off' }));
    expect(playSpy).toHaveBeenCalledTimes(1);
    playSpy.mockRestore();
  });

  it('plays the click chime on pointerdown over a button', () => {
    const oscSpy = jest.fn(() => ({
      type: '',
      frequency: { value: 0 },
      connect: jest.fn().mockReturnThis(),
      start: jest.fn(),
      stop: jest.fn(),
    }));
    const gainSpy = jest.fn(() => ({
      gain: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
      connect: jest.fn().mockReturnThis(),
    }));
    (window as any).AudioContext = jest.fn(() => ({
      state: 'running',
      currentTime: 0,
      destination: {},
      resume: jest.fn(),
      createOscillator: oscSpy,
      createGain: gainSpy,
    }));
    render(
      <SoundProvider>
        <button>real button</button>
      </SoundProvider>
    );
    fireEvent.pointerDown(screen.getByRole('button', { name: 'real button' }));
    expect(oscSpy).toHaveBeenCalledTimes(2); // chime + shimmer partial
  });

  it('throws outside the provider', () => {
    const Bad = () => {
      useInterfaceSound();
      return null;
    };
    expect(() => render(<Bad />)).toThrow();
  });
});