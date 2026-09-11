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
 *   The web twinkle is ported to RN `Animated` (reanimated is not a dep):
 *   `gemini-pulse` (scale 1→1.6, opacity bump) and `gemini-drift` (translate
 *   path) run per-dot with the web `delay`/`animationDuration` stagger, and a
 *   double halo glow approximates the web `boxShadow`.
 *
 * Render-behind only: pointerEvents="none", non-accessible, no zIndex/elevation.
 */
import React, { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
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
  delay: number;
  duration: number;
};

/** Web `gemini-pulse`: scale 1→1.6 with opacity bump, ease-in-out infinite. */
const PULSE_MAX_SCALE = 1.6;
/** Web `gemini-drift`: translate path that returns to origin, ease-in-out infinite. */
const DRIFT_PATH = [
  { x: 0, y: 0, s: 1 },
  { x: 3, y: -4, s: 1.1 },
  { x: -2, y: -7, s: 0.95 },
  { x: -4, y: -2, s: 1.08 },
  { x: 0, y: 0, s: 1 },
];

export const Sparkles = memo(function Sparkles() {
  const { width: winW, height: winH } = useWindowDimensions();

  const dots = useMemo<SparkleDot[]>(() => {
    // RNG consumes x, y, size, opacity, delay in the same order as the web
    // `GeminiSparkles` so the dot layout matches the web frame exactly.
    const rng = seededRandom(42);
    const arr: SparkleDot[] = [];
    for (let i = 0; i < SPARKLE_COUNT; i++) {
      const x = rng() * 100;
      const y = rng() * 100;
      const size = 2 + rng() * 5;
      const delay = rng() * 6;
      const opacity = 0.18 + rng() * 0.45;
      arr.push({
        key: i,
        cx: (x / 100) * winW,
        cy: (y / 100) * winH,
        radius: size / 2,
        opacity,
        delay,
        duration: 4 + (delay % 4),
      });
    }
    return arr;
  }, [winW, winH]);

  // Per-dot animated values. RN `Animated.timing` has no startDelay, so the
  // web `animationDelay` is reproduced by initializing each dot's phase from
  // its delay and looping a 1-duration cycle — the stagger is preserved.
  const pulseScale = useRef(dots.map(() => new Animated.Value(1)));
  const pulseOpacity = useRef(dots.map(() => new Animated.Value(1)));
  const driftX = useRef(dots.map(() => new Animated.Value(0)));
  const driftY = useRef(dots.map(() => new Animated.Value(0)));
  const driftScale = useRef(dots.map(() => new Animated.Value(1)));

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    dots.forEach((dot, i) => {
      const startAt = dot.delay * 1000;
      const loop = () => {
        // `gemini-drift` path: 5 keyframes (incl. return to origin), X, Y and
        // scale move in parallel per frame, one full cycle per `duration`.
        const driftSeg = (dot.duration * 1000) / (DRIFT_PATH.length - 1);
        const driftSeq = Animated.sequence(
          DRIFT_PATH.slice(1).map((p) =>
            Animated.parallel([
              Animated.timing(driftX.current[i], {
                toValue: p.x,
                duration: driftSeg,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(driftY.current[i], {
                toValue: p.y,
                duration: driftSeg,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(driftScale.current[i], {
                toValue: p.s,
                duration: driftSeg,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
            ])
          )
        );
        // `gemini-pulse`: scale 1→1.6→1 over the same `duration` period.
        const pulseSeg = (dot.duration * 1000) / 2;
        const pulseSeq = Animated.sequence([
          Animated.timing(pulseScale.current[i], {
            toValue: PULSE_MAX_SCALE,
            duration: pulseSeg,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseScale.current[i], {
            toValue: 1,
            duration: pulseSeg,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]);
        // Opacity bumps in lockstep with the scale pulse.
        const pulseOSeq = Animated.sequence([
          Animated.timing(pulseOpacity.current[i], {
            toValue: PULSE_MAX_SCALE,
            duration: pulseSeg,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity.current[i], {
            toValue: 1,
            duration: pulseSeg,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]);

        // Restart each sequence when it completes so the staggered phase is
        // preserved indefinitely (RN has no native startDelay).
        const driftLoop = () => driftSeq.start(driftLoop);
        const pulseLoop = () => pulseSeq.start(pulseLoop);
        const pulseOLoop = () => pulseOSeq.start(pulseOLoop);
        driftLoop();
        pulseLoop();
        pulseOLoop();
      };

      timers.push(setTimeout(loop, startAt));
    });

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dots]);

  return (
    <View
      style={styles.sparklesRoot}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {dots.map((dot, i) => {
        const transform = [
          { translateX: driftX.current[i] },
          { translateY: driftY.current[i] },
          { scale: Animated.multiply(driftScale.current[i], pulseScale.current[i]) },
        ];
        return (
          <Animated.View
            key={dot.key}
            style={[
              styles.sparkleDot,
              {
                left: dot.cx - dot.radius,
                top: dot.cy - dot.radius,
                transform,
                opacity: pulseOpacity.current[i],
              },
            ]}
            pointerEvents="none"
          >
            <View
              style={[
                styles.halo,
                {
                  width: dot.radius * 5,
                  height: dot.radius * 5,
                  backgroundColor: `rgba(96,165,250,${dot.opacity * 0.15})`,
                },
              ]}
            />
            <View
              style={[
                styles.halo,
                {
                  width: dot.radius * 2.5,
                  height: dot.radius * 2.5,
                  backgroundColor: `rgba(96,165,250,${dot.opacity * 0.35})`,
                },
              ]}
            />
            <View
              style={[
                styles.halo,
                {
                  width: dot.radius * 2,
                  height: dot.radius * 2,
                  backgroundColor: `rgba(96,165,250,${dot.opacity})`,
                },
              ]}
            />
          </Animated.View>
        );
      })}
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
  sparkleDot: {
    position: 'absolute',
    // Pivot the scale/translate at the dot centre so the pulse and drift
    // stay centred on the halo stack.
    transformOrigin: 'center',
    // Halos are stacked centred inside the dot's bounding box.
  },
  halo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 9999,
  },
});
