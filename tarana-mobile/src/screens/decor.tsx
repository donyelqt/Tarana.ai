/**
 * Mobile auth background decorations — formula-level replication of the web
 * formulas in `src/components/auth/GeminiSparkles.tsx` (implement, don't
 * reinterpret).
 *
 * - `DotsGrid` mirrors web `FadingDotGrid` defaults: dot #93c5fd, 3px
 *   diameter, 14px pitch, region 55% × 60% anchored top-right. The web mask
 *   `radial-gradient(ellipse 70% 70% at 70% 20%, black 0%, 40% at 55%,
 *   transparent 100%)` is replicated as a pure function of normalized coords.
 * - `Sparkles` mirrors web `GeminiSparkles` (blue variant): seeded LCG,
 *   count 35, size 2+r()*5, opacity 0.18+r()*0.45, color rgba(96,165,250,·).
 *   Static frame — the web twinkle animation is deliberately out of scope.
 *   Glow approximated with two halo circles (RN has no box-shadow).
 *
 * Render-behind only: pointerEvents="none", non-accessible, no zIndex/elevation.
 */
import React, { memo, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const DOT_COLOR = '#93c5fd';
const DOT_SIZE = 3;
const DOT_RADIUS = DOT_SIZE / 2;
const GRID_PITCH = 14;

// Web mask: ellipse 70% 70% at 70% 20%, black 0%, 40% at 55%, transparent 100%.
const MASK_CX = 0.7;
const MASK_CY = 0.2;
const MASK_RX = 0.7;
const MASK_RY = 0.7;
const MASK_MID_STOP = 0.55;
const MASK_MID_ALPHA = 0.4;

function maskAlpha(nx: number, ny: number): number {
  const dx = (nx - MASK_CX) / MASK_RX;
  const dy = (ny - MASK_CY) / MASK_RY;
  const d = Math.sqrt(dx * dx + dy * dy);
  let alpha: number;
  if (d <= 0) {
    alpha = 1;
  } else if (d < MASK_MID_STOP) {
    alpha = 1 - 0.6 * (d / MASK_MID_STOP);
  } else {
    alpha = MASK_MID_ALPHA * (1 - (d - MASK_MID_STOP) / (1 - MASK_MID_STOP));
  }
  return alpha < 0 ? 0 : alpha;
}

/** Deterministic pseudo-random — exact LCG copy from web `GeminiSparkles`. */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export const DotsGrid = memo(function DotsGrid() {
  const { width: winW, height: winH } = useWindowDimensions();
  const regionW = winW * 0.55;
  const regionH = winH * 0.6;

  const dots = useMemo(() => {
    const arr: { key: string; cx: number; cy: number; alpha: number }[] = [];
    let key = 0;
    for (let gy = 0; gy < regionH; gy += GRID_PITCH) {
      for (let gx = 0; gx < regionW; gx += GRID_PITCH) {
        const nx = (gx + DOT_RADIUS) / regionW;
        const ny = (gy + DOT_RADIUS) / regionH;
        const alpha = maskAlpha(nx, ny);
        if (alpha <= 0) continue;
        arr.push({ key: `dot-${key++}`, cx: gx + DOT_RADIUS, cy: gy + DOT_RADIUS, alpha });
      }
    }
    return arr;
  }, [regionW, regionH]);

  return (
    <View
      style={[styles.dotsRoot, { width: regionW, height: regionH }]}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={regionW} height={regionH}>
        {dots.map((dot) => (
          <Circle
            key={dot.key}
            cx={dot.cx}
            cy={dot.cy}
            r={DOT_RADIUS}
            fill={DOT_COLOR}
            fillOpacity={dot.alpha}
          />
        ))}
      </Svg>
    </View>
  );
});

const SPARKLE_COUNT = 35;

type SparkleDot = {
  key: number;
  cx: number;
  cy: number;
  radius: number;
  opacity: number;
};

export const Sparkles = memo(function Sparkles() {
  const { width: winW, height: winH } = useWindowDimensions();

  const dots = useMemo<SparkleDot[]>(() => {
    // Static frame: web `delay`/`animationDuration` (twinkle) deliberately out
    // of scope, so RNG consumes x, y, size, opacity in order per dot.
    const rng = seededRandom(42);
    const arr: SparkleDot[] = [];
    for (let i = 0; i < SPARKLE_COUNT; i++) {
      const x = rng() * 100;
      const y = rng() * 100;
      const size = 2 + rng() * 5;
      const opacity = 0.18 + rng() * 0.45;
      arr.push({
        key: i,
        cx: (x / 100) * winW,
        cy: (y / 100) * winH,
        radius: size / 2,
        opacity,
      });
    }
    return arr;
  }, [winW, winH]);

  return (
    <View
      style={styles.sparklesRoot}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={winW} height={winH}>
        {dots.map((dot) => (
          <React.Fragment key={dot.key}>
            <Circle
              cx={dot.cx}
              cy={dot.cy}
              r={dot.radius * 2.5}
              fill={`rgba(96,165,250,${dot.opacity * 0.15})`}
            />
            <Circle
              cx={dot.cx}
              cy={dot.cy}
              r={dot.radius * 1.25}
              fill={`rgba(96,165,250,${dot.opacity * 0.35})`}
            />
            <Circle
              cx={dot.cx}
              cy={dot.cy}
              r={dot.radius}
              fill={`rgba(96,165,250,${dot.opacity})`}
            />
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  dotsRoot: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  sparklesRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
