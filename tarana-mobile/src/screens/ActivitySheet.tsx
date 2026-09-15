import { Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { spotMapsUrl, type SpotTraffic } from '../data';
import { TrafficBadge } from './ui';

/**
 * ActivitySheet — native recomposition of web PlaceDetail
 * (src/components/PlaceDetail.tsx) for one saved-trip activity.
 *
 * Web grammar kept, mobile carriers swapped:
 * - Tabs Description/Map/Reviews → one scrolling sheet: About (= web
 *   Description tab), Location (= web Map tab), Reviews (= web Reviews tab).
 * - TomTom iframe facade → single "Open in Maps" system action. The facade
 *   was a web perf workaround (meaningless on native); SpotCard precedent
 *   uses the same Google-Maps URL, so the action loses zero function and
 *   ships zero map keys in the binary.
 * - Reviews tab on web always renders the "Reviews Unavailable" empty state
 *   for saved itineraries (transformActivityToPlace hardcodes reviews: []),
 *   never real review rows — so the sheet renders that same honest empty
 *   state directly, not a tab that can only ever be empty.
 * - Web traffic pill (green Low / yellow Moderate, TrafficCone icon) →
 *   canonical TrafficBadge (same colors, same icon, same "{label} Traffic"
 *   copy). Web filters low/moderate-traffic out of the tag row; the sheet
 *   does the same and renders the badge separately.
 * - Web Share/Save buttons in the PlaceDetail header have no backing
 *   behavior (no share target, and the trip is already saved) — dropped as
 *   dead buttons, not ported.
 */
export type SheetActivity = {
  title: string;
  time?: string | null;
  desc?: string | null;
  tags: string[];
  trafficLevel?: string | null;
  lat?: number | null;
  lon?: number | null;
  imageUri?: string | null;
};

function trafficBadgeLevel(level: string | null | undefined): SpotTraffic | null {
  const v = (level ?? '').toUpperCase();
  if (v === 'VERY_LOW' || v === 'LOW') return 'LOW';
  if (v === 'MODERATE' || v === 'HIGH' || v === 'SEVERE') return v;
  return null;
}

function visibleTags(tags: string[]): string[] {
  return tags.filter((t) => t !== 'low-traffic' && t !== 'moderate-traffic').slice(0, 4);
}

export default function ActivitySheet({
  activity,
  onClose,
}: {
  activity: SheetActivity | null;
  onClose: () => void;
}) {
  const mapsUrl =
    activity != null ? spotMapsUrl(activity.lat ?? null, activity.lon ?? null) : null;
  const badgeLevel = activity != null ? trafficBadgeLevel(activity.trafficLevel) : null;
  const tags = activity != null ? visibleTags(activity.tags) : [];

  return (
    <Modal
      visible={activity != null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.dismiss}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel="Close activity details"
          onPress={onClose}
        />
        <View style={styles.sheet}>
          <TouchableOpacity
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close activity details"
            onPress={onClose}
            style={styles.handleHit}
          >
            <View style={styles.handle} />
          </TouchableOpacity>
          {activity ? (
            <View style={styles.body}>
              <Text style={styles.title} numberOfLines={2}>{activity.title}</Text>
              {activity.time ? <Text style={styles.time}>{activity.time}</Text> : null}

              <Text style={styles.sectionTitle}>About</Text>
              {activity.desc ? (
                <Text style={styles.desc}>{activity.desc}</Text>
              ) : (
                <Text style={styles.muted}>No description saved for this stop.</Text>
              )}
              {tags.length > 0 ? (
                <Text style={styles.tags}>{tags.join(' · ')}</Text>
              ) : null}
              {badgeLevel ? (
                <View style={styles.badgeRow}>
                  <TrafficBadge level={badgeLevel} />
                </View>
              ) : null}

              <Text style={styles.sectionTitle}>Location</Text>
              {mapsUrl ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${activity.title} in Maps`}
                  onPress={() => Linking.openURL(mapsUrl)}
                  style={styles.mapsBtn}
                >
                  <Text style={styles.mapsText}>Open in Maps</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.muted}>Baguio City, Philippines</Text>
              )}

              <Text style={styles.sectionTitle}>Reviews</Text>
              <View style={styles.reviewsEmpty}>
                <Text style={styles.reviewsTitle}>Reviews Unavailable</Text>
                <Text style={styles.reviewsBody}>
                  We&apos;re working on gathering authentic reviews for this location.
                </Text>
                <View style={styles.comingSoon}>
                  <Text style={styles.comingSoonText}>Coming soon</Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const BLUE = '#0066FF';

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.4)', justifyContent: 'flex-end' },
  dismiss: { flex: 1 },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    maxHeight: '85%',
  },
  handleHit: { alignItems: 'center', paddingVertical: 8 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb' },
  body: { gap: 6 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', lineHeight: 26 },
  time: { fontSize: 13, color: BLUE, fontWeight: '600', fontVariant: ['tabular-nums'] },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 10 },
  desc: { fontSize: 14, color: '#374151', lineHeight: 20 },
  muted: { fontSize: 13, color: '#6b7280' },
  tags: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  badgeRow: { marginTop: 8, flexDirection: 'row' },
  mapsBtn: {
    marginTop: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  mapsText: { color: BLUE, fontSize: 15, fontWeight: '600' },
  reviewsEmpty: {
    marginTop: 4,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    gap: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  reviewsTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  reviewsBody: { fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 18 },
  comingSoon: {
    marginTop: 6,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  comingSoonText: { fontSize: 11, color: '#6b7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
});
