import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TrafficConeIcon } from './icons';
import type { SpotTraffic } from '../data';
import { resolveWebImage } from '../data';

export const GRADIENT = {
  auth: { from: '#0066FF', to: '#1E90FF', pressedFrom: '#0052CC', pressedTo: '#3388FF' },
  app: { from: '#1D4ED8', to: '#3B82F6', pressedFrom: '#1D4ED8', pressedTo: '#1D4ED8' },
  disabled: { from: '#d1d5db', to: '#d1d5db' },
} as const;

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
export function formatDateRange(start: string, end: string): string | null {
  const s = formatDate(start);
  const e = formatDate(end);
  if (!s || !e) return null;
  return s + ' - ' + e;
}

let phpFormatter: Intl.NumberFormat | null = null;

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

const BADGE: Record<SpotTraffic, { bg: string; border: string; fg: string; label: string }> = {
  VERY_LOW: { bg: '#f0fdf4', border: '#86efac', fg: '#16a34a', label: 'Low' },
  LOW: { bg: '#f0fdf4', border: '#86efac', fg: '#16a34a', label: 'Low' },
  MODERATE: { bg: '#fefce8', border: '#fde047', fg: '#ca8a04', label: 'Moderate' },
  HIGH: { bg: '#fffbeb', border: '#fde047', fg: '#ca8a04', label: 'Heavy' },
  SEVERE: { bg: '#fef2f2', border: '#fca5a5', fg: '#dc2626', label: 'Severe' },
};

export function TrafficBadge({ level }: { level: SpotTraffic }) {
  const normalizedLevel = (level?.toUpperCase() ?? 'MODERATE') as SpotTraffic;
  const c = BADGE[normalizedLevel] ?? BADGE.MODERATE;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <TrafficConeIcon size={14} color={c.fg} strokeWidth={2} />
      <Text style={[styles.badgeText, { color: c.fg }]}>{c.label} Traffic</Text>
    </View>
  );
}

export function SpotPhoto({
  uri,
  name,
  height,
  radius = 12,
}: {
  uri: string | null;
  name: string;
  height: number;
  radius?: number;
}) {
  const [failed, setFailed] = useState(false);
  const showPhoto = !!uri && !failed;
  return (
    <View style={[styles.photoSlot, { height, borderRadius: radius }]} accessible={false}>
      <Image
        source={require('../../assets/taranaai-mark.png')}
        style={styles.photoMark}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel="Tarana.ai"
      />
      {showPhoto ? (
        <Image
          source={{ uri: uri as string }}
          style={StyleSheet.absoluteFill}
          onError={() => setFailed(true)}
          accessibilityRole="image"
          accessibilityLabel={`${name} photo`}
        />
      ) : null}
    </View>
  );
}

export const spotCardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  body: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, gap: 3 },
  title: { fontSize: 16, fontWeight: '700', color: '#111827', letterSpacing: -0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { flex: 1, fontSize: 12, color: '#6b7280', fontVariant: ['tabular-nums'] },
});

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  badgeText: { fontSize: 12, fontWeight: '600', marginLeft: 6 },
  photoSlot: {
    width: '100%',
    backgroundColor: '#eff6ff',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoMark: { width: 96, height: 96 },
  ctaOuter: { borderRadius: 16, marginTop: 4 },
  cta: { paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  ctaText: { color: '#ffffff', fontSize: 16, fontWeight: '500' },
  ctaTextDisabled: { color: '#6b7280' },
});

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