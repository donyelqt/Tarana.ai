/**
 * Shared presentation helpers (canonical — use these, don't duplicate).
 *
 * Shape lock (plan §9): actions are pills, cards 16, inputs 12.
 * Canvas is iOS-grouped (#F2F2F7); cards are flat white, borders off —
 * elevation would fight the grouped language, so there is no shadow
 * system. NOT here: brand colors/gradients (live with their screens).
 */
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { SpotTraffic } from '../data';

/** Web gradient truth (verified in src/, not from memory). */
export const GRADIENT = {
  /** Auth/form CTAs: horizontal #0066FF → #1E90FF; pressed #0052CC → #3388FF. */
  auth: { from: '#0066FF', to: '#1E90FF', pressedFrom: '#0052CC', pressedTo: '#3388FF' },
  /** In-app CTAs: vertical #1D4ED8 → #3B82F6; pressed collapses to #1D4ED8. */
  app: { from: '#1D4ED8', to: '#3B82F6', pressedFrom: '#1D4ED8', pressedTo: '#1D4ED8' },
  disabled: { from: '#d1d5db', to: '#d1d5db' },
} as const;

/**
 * Canonical CTA — the ONLY gradient button in the app.
 *
 * `auth` (horizontal brand) for auth-flow screens mirrors
 * `auth/signin:253` + `signup:245`; `app` (vertical blue-700→500) for
 * in-app screens mirrors SpotlightCard/MealCard/saved-pages CTAs.
 * Pressed state = the web `:hover` gradient swap (press-in, ~100ms,
 * native); disabled = web `disabled:bg-gray-300` + grey label.
 */
export function GradientCTA({
  variant,
  title,
  loadingTitle,
  loading = false,
  disabled = false,
  onPress,
  accessibilityLabel,
}: {
  variant: 'auth' | 'app';
  title: string;
  loadingTitle?: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const [pressed, setPressed] = useState(false);
  const g = GRADIENT[variant];
  const off = disabled || loading;
  const colors: [string, string] = off
    ? [GRADIENT.disabled.from, GRADIENT.disabled.to]
    : pressed
      ? [g.pressedFrom, g.pressedTo]
      : [g.from, g.to];
  const vertical = variant === 'app';
  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={off}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={styles.ctaOuter}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={vertical ? { x: 0, y: 1 } : { x: 1, y: 0 }}
        style={styles.cta}
      >
        <Text style={[styles.ctaText, off && styles.ctaTextDisabled]}>
          {loading ? (loadingTitle ?? title) : title}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

/** "Good morning/afternoon/evening" by Manila clock. Greeting only. */
export function manilaDaypart(now: Date = new Date()): 'morning' | 'afternoon' | 'evening' {
  let h = 12;
  try {
    h = parseInt(
      new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', hour12: false }).format(now),
      10
    );
  } catch {
    h = now.getHours();
  }
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

/**
 * Defensive date display: valid inputs render "Mar 4, 2026" (Intl);
 * anything unparseable passes through untouched (never blank, never crash).
 */
export function formatDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  try {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return raw;
  }
}

let phpFormatter: Intl.NumberFormat | null = null;

/**
 * Peso rendering: Intl en-PH, zero fractions ("₱250"). Falls back to a
 * plain ₱-prefix if Intl is unavailable. Tabular numerals stay the
 * caller's job (fontVariant on the Text).
 */
export function formatPHP(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  try {
    phpFormatter ??= new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 0,
    });
    return phpFormatter.format(value);
  } catch {
    return `₱${Math.round(value)}`;
  }
}

/**
 * Traffic badge — web semantics (SpotlightCard green/yellow/red):
 * Low = green tint, Moderate = amber tint, High = red tint.
 * Color never stands alone: the level word is always present as text.
 * Canonical home (moved from Spots): every surface uses this.
 */
const BADGE: Record<SpotTraffic, { bg: string; fg: string }> = {
  Low: { bg: '#dcfce7', fg: '#15803d' },
  Moderate: { bg: '#fef9c3', fg: '#a16207' },
  High: { bg: '#fee2e2', fg: '#b91c1c' },
};

export function TrafficBadge({ level }: { level: SpotTraffic }) {
  const c = BADGE[level];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{level} traffic</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, marginTop: 6 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  ctaOuter: { borderRadius: 16, marginTop: 4 },
  cta: { paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  ctaText: { color: '#ffffff', fontSize: 16, fontWeight: '500' },
  ctaTextDisabled: { color: '#6b7280' },
});
