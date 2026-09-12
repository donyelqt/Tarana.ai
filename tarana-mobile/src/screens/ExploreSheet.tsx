import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  TRAFFIC_DOTS,
  TRAFFIC_LABELS,
  type RouteSummary,
} from '../data';

const BLUE = '#0066FF';

/**
 * BottomRouteSheet parity (native recomposition, no map).
 *
 * Same grammar as web: drag handle → traffic dot + label + close →
 * big duration · distance · arrival · delay → alternatives pill bar
 * (Best + tappable) → Show/Hide details (why-this-route + savings,
 * congestion/delay/incidents grid, updated stamp). Turn steps render
 * below — they have no web-sheet equivalent (web shows them on the
 * map); they are the native compensation for no polylines, kept from
 * the previous mobile sheet. Selecting an alternative promotes it to
 * primary and keeps traffic as-is — mirrors useRouteCalculation
 * selectAlternative. No silent 5-min refresh (traffic-analysis/[id]
 * contract unverified session-free) — the stamp shows update time only.
 */
export default function ExploreSheet({
  route,
  selectedId,
  onSelectAlternative,
  onClose,
}: {
  route: RouteSummary;
  selectedId: string;
  onSelectAlternative: (id: string) => void;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const current =
    selectedId === 'primary'
      ? { id: 'primary', minutes: route.minutes, km: route.km, delayMinutes: route.delayMinutes, steps: route.steps }
      : (route.alternatives.find((a) => a.id === selectedId) ?? {
          id: 'primary',
          minutes: route.minutes,
          km: route.km,
          delayMinutes: route.delayMinutes,
          steps: route.steps,
        });

  const arrival = formatArrival(route.arrival, route.minutes);
  const trafficLabel = route.traffic ? `${TRAFFIC_LABELS[route.traffic.level]} traffic` : 'Traffic unknown';
  const trafficDot = route.traffic ? TRAFFIC_DOTS[route.traffic.level] : '#d1d5db';

  return (
    <View style={styles.sheet}>
      <TouchableOpacity
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Collapse details' : 'Expand details'}
        onPress={() => setExpanded((v) => !v)}
        style={styles.handleHit}
      >
        <View style={styles.handle} />
      </TouchableOpacity>

      <View style={styles.topRow}>
        <View style={styles.trafficRow}>
          <View style={[styles.dot, { backgroundColor: trafficDot }]} />
          <Text style={styles.trafficText}>{trafficLabel}</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Close route"
          onPress={onClose}
          style={styles.closeHit}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sheetTitle}>
        {current.minutes} min · {current.km} km
      </Text>
      <Text style={styles.sheetSub}>
        {arrival ? `arrive ${arrival}` : 'arrival unknown'}
        {current.delayMinutes > 0 ? ` · +${current.delayMinutes} min delay` : ''}
      </Text>

      {route.alternatives.length > 0 ? (
        <View style={styles.altBar}>
          <TouchableOpacity
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Best route, selected"
            onPress={() => onSelectAlternative('primary')}
            style={[styles.altPill, selectedId === 'primary' && styles.altPillBest]}
          >
            <Text style={[styles.altText, selectedId === 'primary' && styles.altTextBest]}>Best</Text>
          </TouchableOpacity>
          {route.alternatives.map((alt) => {
            const active = alt.id === selectedId;
            return (
              <TouchableOpacity
                key={alt.id}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Use alternative route, ${alt.minutes} minutes, ${alt.km} kilometers`}
                onPress={() => onSelectAlternative(alt.id)}
                style={[styles.altPill, active && styles.altPillBest]}
              >
                <Text style={[styles.altText, active && styles.altTextBest]}>
                  {alt.minutes} min · {alt.km} km
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Hide details' : 'Show details'}
        onPress={() => setExpanded((v) => !v)}
        style={styles.detailsToggle}
      >
        <Text style={styles.detailsToggleText}>{expanded ? 'Hide details' : 'Show details'}</Text>
        <Text style={styles.detailsToggleText}>{expanded ? '▾' : '▴'}</Text>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.details}>
          {route.recommendation ? (
            <View>
              <Text style={styles.whyTitle}>Why this route</Text>
              <Text style={styles.whyBody}>{route.recommendation.message}</Text>
              {route.recommendation.timeSavingsMinutes != null && route.recommendation.timeSavingsMinutes > 0 ? (
                <Text style={styles.savings}>
                  Saves {route.recommendation.timeSavingsMinutes} min vs alternatives
                </Text>
              ) : null}
            </View>
          ) : null}
          {route.traffic ? (
            <View style={styles.statGrid}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Congestion</Text>
                <Text style={styles.statValue}>{route.traffic.congestion}%</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Delay</Text>
                <Text style={styles.statValue}>{route.traffic.delayMinutes} min</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Incidents</Text>
                <Text style={styles.statValue}>{route.traffic.incidents}</Text>
              </View>
            </View>
          ) : null}
          <Text style={styles.updated}>Updated {formatTime(route.updatedAt)}</Text>
        </View>
      ) : null}

      {current.steps.map((s, i) => (
        <View key={i} style={styles.step}>
          <Text style={styles.stepText}>{s.text}</Text>
          <Text style={styles.stepMeta}>
            {s.meters >= 1000 ? `${(s.meters / 1000).toFixed(1)} km` : `${Math.round(s.meters)} m`}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Arrival is an opaque server string (usually ISO) — format defensively, else now+minutes. */
function formatArrival(value: string | null, fallbackMinutes: number): string | null {
  if (value) {
    try {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      }
    } catch {
      /* fall through to computed */
    }
  }
  try {
    return new Date(Date.now() + fallbackMinutes * 60000).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

function formatTime(value: string): string {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleTimeString();
  } catch {
    return value;
  }
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, gap: 6, borderWidth: 1, borderColor: '#E5E7EB' },
  handleHit: { alignItems: 'center', paddingVertical: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trafficRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  trafficText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  closeHit: { padding: 6 },
  closeText: { fontSize: 14, color: '#9ca3af', fontWeight: '700' },
  sheetTitle: { fontSize: 24, fontWeight: '800', color: '#111827', fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
  sheetSub: { fontSize: 13, color: '#6b7280' },
  altBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  altPill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#E5E7EB' },
  altPillBest: { backgroundColor: BLUE, borderColor: BLUE },
  altText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  altTextBest: { color: '#ffffff' },
  detailsToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingVertical: 4 },
  detailsToggleText: { fontSize: 12, fontWeight: '600', color: '#4b5563' },
  details: { gap: 10, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginTop: 2 },
  whyTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  whyBody: { fontSize: 12, color: '#4b5563', marginTop: 2, lineHeight: 17 },
  savings: { fontSize: 12, color: '#15803d', fontWeight: '600', marginTop: 4 },
  statGrid: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: '#ffffff', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#F3F4F6' },
  statLabel: { fontSize: 10, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 14, fontWeight: '800', color: '#111827', marginTop: 2, fontVariant: ['tabular-nums'] },
  updated: { fontSize: 10, color: '#9ca3af', textAlign: 'center' },
  step: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  stepText: { flex: 1, fontSize: 14, color: '#111827', lineHeight: 19 },
  stepMeta: { fontSize: 13, color: '#6b7280', fontVariant: ['tabular-nums'] },
});
