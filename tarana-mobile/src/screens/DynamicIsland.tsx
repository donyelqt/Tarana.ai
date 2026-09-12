import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

/**
 * Native port of web DynamicIsland (tarana-explore/components/DynamicIsland).
 *
 * Same physics: spring m=1, stiffness=210, damping=23 (ζ≈0.794, ≈1.2%
 * overshoot, settle ≈0.26s). framer-motion and Reanimated solve the same
 * m·x'' + c·x' + k·(x−target)=0 ODE, so the constants transfer 1:1.
 * Same silhouette: collapsed pill (radius 9999, h52), expanded 28-radius
 * card; content clipped to the pill ONLY while morphing, then released
 * so suggestion dropdowns escape the rounded clip. No gesture-handler
 * needed — interaction is tap-only.
 */
const DI_SPRING = { stiffness: 210, damping: 23, mass: 1 } as const;
const COMPACT_HEIGHT = 52;
const COMPACT_MIN_WIDTH = 240;

export default function DynamicIsland({
  expanded,
  children,
  compact,
  compactWidth = COMPACT_MIN_WIDTH,
  compactLabel = 'Open search',
  maxWidth = 448,
  onCompactClick,
}: {
  expanded: boolean;
  children: ReactNode;
  compact: ReactNode;
  compactWidth?: number;
  compactLabel?: string;
  maxWidth?: number;
  onCompactClick?: () => void;
}) {
  const { width: viewportWidth } = useWindowDimensions();
  const [contentH, setContentH] = useState(COMPACT_HEIGHT);
  const [clip, setClip] = useState(true);

  const availW = Math.min(maxWidth, Math.max(COMPACT_MIN_WIDTH, viewportWidth - 24));
  const targetW = expanded ? availW : Math.min(compactWidth, availW);
  const targetH = expanded ? Math.max(contentH, COMPACT_HEIGHT) : COMPACT_HEIGHT;

  const w = useSharedValue(targetW);
  const h = useSharedValue(targetH);
  const r = useSharedValue(expanded ? 28 : 9999);

  useEffect(() => {
    w.value = withSpring(targetW, DI_SPRING);
    h.value = withSpring(targetH, DI_SPRING);
    r.value = withSpring(expanded ? 28 : 9999, DI_SPRING);
    // Clip only while morphing (settle ≈0.26s per the verified model).
    setClip(true);
    const t = setTimeout(() => setClip(false), 350);
    return () => clearTimeout(t);
  }, [targetW, targetH, expanded, w, h, r]);

  const animated = useAnimatedStyle(() => ({
    width: w.value,
    height: h.value,
    borderRadius: r.value,
  }));

  return (
    <Animated.View
      style={[
        styles.island,
        animated,
        { overflow: clip ? 'hidden' : 'visible' },
      ]}
    >
      <View
        style={{ width: availW, opacity: expanded ? 1 : 0 }}
        pointerEvents={expanded ? 'auto' : 'none'}
        onLayout={(e) => {
          const next = Math.round(e.nativeEvent.layout.height);
          if (next > 0 && next !== contentH) setContentH(next);
        }}
      >
        {children}
      </View>
      {!expanded ? (
        <TouchableOpacity
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={compactLabel}
          onPress={onCompactClick}
          style={styles.compactHit}
        >
          {typeof compact === 'string' ? <Text style={styles.compactText}>{compact}</Text> : compact}
        </TouchableOpacity>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  island: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    // backdrop blur has no RN equivalent without extra deps — opacity fill stands in.
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  compactHit: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  compactText: { fontSize: 14, fontWeight: '500', color: '#4b5563' },
});
