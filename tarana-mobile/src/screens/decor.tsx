import React, { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const DOT_COLOR = '#93c5fd';
const DOT_SIZE = 3;
const DOT_RADIUS = DOT_SIZE / 2;
const GRID_PITCH = 14;

const FADE_X = 0.85; 
const FADE_Y = 1.5; 

function maskAlpha(nx: number, ny: number): number {
  const tx = 1 - nx; 
  const ty = ny; 
  const fx = 1 - Math.pow(tx, FADE_X);
  const fy = 1 - Math.pow(ty, FADE_Y);
  const alpha = fx * fy;
  return alpha < 0 ? 0 : alpha;
}

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

const PULSE_MAX_SCALE = 1.6;
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
    transformOrigin: 'center',
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
