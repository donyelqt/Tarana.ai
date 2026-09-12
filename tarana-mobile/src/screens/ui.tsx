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
import { resolveWebImage } from '../data';

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

/** Web parity: 5 traffic levels matching web TrafficLevel (route-optimization.ts:109).
 * Colors match web TRAFFIC_COLORS (trafficColors.ts:28-64).
 * Labels match web TRAFFIC_LABELS (TrafficBadge.tsx:14-20). */
const BADGE: Record<SpotTraffic, { bg: string; fg: string; label: string }> = {
  VERY_LOW: { bg: '#dcfce7', fg: '#166534', label: 'Very low' },
  LOW: { bg: '#dcfce7', fg: '#166534', label: 'Low' },
  MODERATE: { bg: '#fef9c3', fg: '#854d0e', label: 'Moderate' },
  HIGH: { bg: '#ffedd5', fg: '#9a3412', label: 'Heavy' },
  SEVERE: { bg: '#fef2f2', fg: '#991b1b', label: 'Severe' },
};

/** Web parity: TrafficBadge matches web TrafficBadge.tsx exactly.
 * Shows colored dot + label, rounded-full, white bg with subtle shadow. */
export function TrafficBadge({ level }: { level: SpotTraffic }) {
  // Normalize level to uppercase to handle API casing differences
  const normalizedLevel = (level?.toUpperCase() ?? 'MODERATE') as SpotTraffic;
  const c = BADGE[normalizedLevel] ?? BADGE.MODERATE;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <View style={styles.dot} />
      <Text style={[styles.badgeText, { color: c.fg }]}>{c.label} traffic</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  ctaOuter: { borderRadius: 16, marginTop: 4 },
  cta: { paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  ctaText: { color: '#ffffff', fontSize: 16, fontWeight: '500' },
  ctaTextDisabled: { color: '#6b7280' },
});

/**
 * First real photo in a saved-trip payload (string http URL only).
 * Canonical home (moved from SavedTrips): list thumbs and the detail
 * hero share one extractor, one rule — photo-led depth, Airbnb pattern.
 */
export function firstPayloadImage(payload: string | null): string | null {
  if (!payload) return null;
  try {
    const parsed: unknown = JSON.parse(payload);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const items = (parsed as { itineraryData?: { items?: Array<{ activities?: Array<{ image?: unknown }> }> } })
      .itineraryData?.items;
    if (!Array.isArray(items)) return null;
    for (const period of items) {
      for (const act of period.activities ?? []) {
        if (typeof act.image === 'string') {
          const uri = resolveWebImage(act.image);
          if (uri) return uri;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}