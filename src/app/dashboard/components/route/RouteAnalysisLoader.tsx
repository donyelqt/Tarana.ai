'use client';

import React from 'react';

interface RouteAnalysisLoaderProps {
  /** Show/hide the helper text below the animation */
  showText?: boolean;
  /** Custom text below animation */
  text?: string;
  /** Size preset: 'sm' for compact, 'md' for overlay, 'lg' for prominent */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class names */
  className?: string;
}

const sizeScales: Record<string, string> = {
  sm: 'scale-[0.57]',
  md: 'scale-100',
  lg: 'scale-[1.43]',
};

/**
 * Neural constellation loader.
 *
 * Three satellites orbit the center on elliptical paths at different speeds,
 * each leaving a faint ghost trail. A rotating dashed arc ring and a
 * counter-rotating dotted arc add depth. The center core "breathes" with an
 * irregular heartbeat pattern — not a smooth sine — so it feels alive.
 */
export default function RouteAnalysisLoader({
  showText = true,
  text = 'Analyzing routes...',
  size = 'md',
  className = '',
}: RouteAnalysisLoaderProps) {
  const satellites = [
    {
      /** outer, bright, fast */
      orbitClass: 'orbit-alpha',
      duration: '2.5s',
      ghostDelay: 0.18,
      dot: {
        main: 'w-[6px] h-[6px] bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]',
        ghost: 'w-[7px] h-[7px] bg-blue-400/25 blur-[2px]',
        offsetMain: -3,
        offsetGhost: -3.5,
      },
    },
    {
      /** inner, deep, medium */
      orbitClass: 'orbit-beta',
      duration: '3.5s',
      ghostDelay: 0.22,
      dot: {
        main: 'w-[5px] h-[5px] bg-blue-700 shadow-[0_0_8px_rgba(30,64,175,0.7)]',
        ghost: 'w-[6px] h-[6px] bg-blue-700/25 blur-[2px]',
        offsetMain: -2.5,
        offsetGhost: -3,
      },
    },
    {
      /** wide, mid-blue, slow */
      orbitClass: 'orbit-gamma',
      duration: '4.2s',
      ghostDelay: 0.28,
      dot: {
        main: 'w-[4px] h-[4px] bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.9)]',
        ghost: 'w-[5px] h-[5px] bg-blue-400/20 blur-[2px]',
        offsetMain: -2,
        offsetGhost: -2.5,
      },
    },
  ] as const;

  return (
    <div
      className={`flex flex-col items-center justify-center ${className}`}
      role="status"
      aria-live="polite"
      aria-label={text}
    >
      <div
        className={`relative origin-center ${sizeScales[size] ?? 'scale-100'}`}
        style={{ width: 56, height: 56 }}
      >
        {/* Breathing radial glow */}
        <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl animate-glow-breathe" />

        {/* Rotating dashed arc (clockwise) */}
        <div
          className="absolute rounded-full border-2 border-dashed border-blue-400/25 animate-arc-cw"
          style={{ inset: -6, animationDuration: '8s', willChange: 'transform' }}
        />

        {/* Rotating dotted arc (counter-clockwise) */}
        <div
          className="absolute rounded-full border border-dotted border-blue-300/15 animate-arc-ccw"
          style={{ inset: -2, animationDuration: '12s', willChange: 'transform' }}
        />

        {/* Twinkling micro-particles near core */}
        <div
          className="absolute rounded-full bg-blue-300/70 animate-twinkle"
          style={{ top: '34%', left: '42%', width: 2, height: 2 }}
        />
        <div
          className="absolute rounded-full bg-blue-200/60 animate-twinkle"
          style={{ top: '60%', left: '56%', width: 1.5, height: 1.5, animationDelay: '-0.8s' }}
        />
        <div
          className="absolute rounded-full bg-blue-400/50 animate-twinkle"
          style={{ top: '44%', left: '66%', width: 1.5, height: 1.5, animationDelay: '-1.5s' }}
        />

        {/* Orbiting satellite clusters — each with main dot + ghost trail */}
        {satellites.map((sat) =>
          [0, 1].map((i) => (
            <div
              key={`${sat.orbitClass}-${i}`}
              className="absolute"
              style={{
                top: '50%',
                left: '50%',
                width: 0,
                height: 0,
                animation: `${sat.orbitClass} ${sat.duration} linear infinite`,
                animationDelay: i === 1 ? `${sat.ghostDelay}s` : '0s',
                willChange: 'transform',
              }}
            >
              <div
                className={`absolute rounded-full ${
                  i === 0 ? sat.dot.main : sat.dot.ghost
                }`}
                style={{
                  top: i === 0 ? sat.dot.offsetMain : sat.dot.offsetGhost,
                  left: i === 0 ? sat.dot.offsetMain : sat.dot.offsetGhost,
                }}
              />
            </div>
          ))
        )}

        {/* Center core — irregular heartbeat breathing */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="rounded-full bg-gradient-to-br from-blue-500 to-blue-700 animate-core-breathe"
            style={{
              width: 14,
              height: 14,
              boxShadow:
                '0 0 20px rgba(0,102,255,0.5), 0 0 40px rgba(0,102,255,0.15)',
              willChange: 'transform',
            }}
          />
        </div>
      </div>

      {showText && (
        <p className="mt-3 text-sm font-medium text-gray-700 tracking-wide animate-text-breathe">
          {text}
        </p>
      )}
    </div>
  );
}
