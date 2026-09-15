import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { getActiveProfileId, listTrips, deleteTrip, resolveWebImage, type LocalTrip } from '../data';
import { formatDate, firstPayloadImage, TrafficBadge } from './ui';
import type { SpotTraffic } from '../data';
import Thumb from './Thumb';
import ActivitySheet, { type SheetActivity } from './ActivitySheet';

const BLUE = '#0066FF';

type Activity = {
  title?: string;
  time?: string;
  desc?: string;
  tags?: string[];
  trafficLevel?: string;
  image?: unknown;
  lat?: number;
  lon?: number;
};

type Period = {
  period?: string;
  activities?: Activity[];
};

type Payload = {
  formData?: { budget?: string; pax?: string; duration?: string; dates?: { start?: string; end?: string }; selectedInterests?: string[] } | null;
  itineraryData?: { title?: string; subtitle?: string; items?: Period[] } | null;
};

function parsePayload(raw: string | null): Payload | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as Payload;
  } catch {
    return null;
  }
}

function badgeLevel(level: string | undefined): SpotTraffic | null {
  const v = (level ?? '').toUpperCase();
  if (v === 'VERY_LOW' || v === 'LOW') return 'LOW';
  if (v === 'MODERATE' || v === 'HIGH' || v === 'SEVERE') return v;
  return null;
}

function isTrafficTag(tag: string): boolean {
  return tag === 'low-traffic' || tag === 'moderate-traffic';
}

/**
 * TripDetail — read-only itinerary with delete (§8).
 *
 * Web detail skeleton recomposed native: header → info tiles → day
 * sections (Day N + date header, web parity) → activity cards with
 * Reviews/Maps actions opening the ActivitySheet (= web PlaceDetail
 * modal: About/Location/Reviews recomposed native, one system Maps
 * action, honest Reviews-Coming-Soon empty state). Web Smart Refresh
 * stays server-side (session-cookie, no mobile token path) — no dead
 * refresh button. Delete is a two-step arm (no modal dependency).
 */
export default function TripDetail({ navigation, route }: { navigation: any; route: { params?: { id?: string } } }) {
  const [trip, setTrip] = useState<LocalTrip | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [arming, setArming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<SheetActivity | null>(null);

  const load = useCallback(async () => {
    try {
      const id = route?.params?.id;
      if (!id) throw new Error('Trip not found.');
      const profileId = await getActiveProfileId();
      if (!profileId) throw new Error('Create a profile first.');
      const found = (await listTrips(profileId)).find((t) => t.id === id) ?? null;
      if (!found) throw new Error('Trip not found.');
      setTrip(found);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load trip.');
    } finally {
      setLoaded(true);
    }
  }, [route]);

  useEffect(() => {
    load();
  }, [load]);

  const onDelete = async () => {
    if (!trip) return;
    if (!arming) {
      setArming(true);
      return;
    }
    setDeleting(true);
    try {
      const profileId = await getActiveProfileId();
      if (profileId) await deleteTrip(trip.id, profileId);
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete trip.');
      setArming(false);
    } finally {
      setDeleting(false);
    }
  };

  if (!loaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={BLUE} />
        <Text style={styles.muted}>Loading…</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  if (error || !trip) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Trip not found.'}</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  const payload = parsePayload(trip.payload);
  const items = payload?.itineraryData?.items ?? [];
  const form = payload?.formData;
  const heroUri = firstPayloadImage(trip.payload);

  // Web parity (saved-trips/[id]:393-410): a new day starts at "Morning".
  // Flat period list → day groups so Day N + date headers render.
  const days: Period[][] = [];
  for (const period of items) {
    if ((period.period ?? '').toLowerCase().includes('morning') && days.length > 0) {
      days.push([period]);
    } else if (days.length === 0) {
      days.push([period]);
    } else {
      days[days.length - 1]?.push(period);
    }
  }
  const startDate = form?.dates?.start ?? null;
  const dayDate = (dayIdx: number): string | null => {
    if (!startDate) return null;
    const d = new Date(startDate);
    if (Number.isNaN(d.getTime())) return null;
    d.setDate(d.getDate() + dayIdx);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const openSheet = (a: Activity) => {
    const rawImage = typeof a.image === 'string' ? a.image : null;
    setSelected({
      title: a.title || 'Untitled stop',
      time: a.time ?? null,
      desc: a.desc ?? null,
      tags: Array.isArray(a.tags) ? a.tags.filter((t): t is string => typeof t === 'string') : [],
      trafficLevel: a.trafficLevel ?? null,
      lat: typeof a.lat === 'number' ? a.lat : null,
      lon: typeof a.lon === 'number' ? a.lon : null,
      imageUri: rawImage ? resolveWebImage(rawImage) : null,
    });
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{trip.title ?? 'Untitled trip'}</Text>
      {heroUri ? <TripHero uri={heroUri} title={trip.title ?? 'Trip photo'} /> : null}
      <Text style={styles.meta}>{[formatDate(trip.date), trip.budget].filter(Boolean).join(' · ') || 'No details'}</Text>
      {trip.tags.length > 0 ? <Text style={styles.tags}>{trip.tags.join(', ')}</Text> : null}

      {form ? (
        <View style={styles.tiles}>
          {[
            ['Budget', form.budget],
            ['Pax', form.pax],
            ['Duration', form.duration],
          ].map(([label, value]) => (
            <View key={label} style={styles.tile}>
              <Text style={styles.tileLabel}>{label}</Text>
              <Text style={styles.tileValue}>{value || '—'}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {form?.selectedInterests && form.selectedInterests.length > 0 ? (
        <Text style={styles.interests}>{form.selectedInterests.join(' · ')}</Text>
      ) : null}

      {days.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No day-by-day details saved for this trip.</Text>
        </View>
      ) : (
        days.map((day, dayIdx) => (
          <View key={`day-${dayIdx}`} style={styles.day}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>Day {dayIdx + 1}</Text>
              {dayDate(dayIdx) ? <Text style={styles.dayDate}>{dayDate(dayIdx)}</Text> : null}
            </View>
            {day.flatMap((p) => p.activities ?? []).map((a, j) => {
              const badge = badgeLevel(a.trafficLevel);
              const tags = (a.tags ?? []).filter((t) => !isTrafficTag(t)).slice(0, 4);
              return (
                <View key={`${a.title ?? 'activity'}-${j}`} style={styles.activity}>
                  <View style={styles.activityTop}>
                    <Thumb
                      uri={typeof a.image === 'string' ? resolveWebImage(a.image) : null}
                      size={52}
                    />
                    <View style={styles.activityHead}>
                      <Text style={styles.activityTitle}>{a.title || 'Untitled stop'}</Text>
                      {a.time ? <Text style={styles.activityTime}>{a.time}</Text> : null}
                    </View>
                  </View>
                  {a.desc ? <Text style={styles.activityDesc}>{a.desc}</Text> : null}
                  {tags.length > 0 ? (
                    <Text style={styles.activityTags}>{tags.join(' · ')}</Text>
                  ) : null}
                  {badge ? (
                    <View style={styles.badgeRow}>
                      <TrafficBadge level={badge} />
                    </View>
                  ) : null}
                  <View style={styles.actions}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`Reviews for ${a.title || 'this stop'}`}
                      onPress={() => openSheet(a)}
                      style={styles.reviewsBtn}
                    >
                      <Text style={styles.reviewsText}>Reviews</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`Map for ${a.title || 'this stop'}`}
                      onPress={() => openSheet(a)}
                      style={styles.mapsBtn}
                    >
                      <Text style={styles.mapsText}>Map</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        ))
      )}

      <TouchableOpacity
        style={[styles.deleteBtn, arming && styles.deleteArmed]}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={arming ? 'Confirm delete trip' : 'Delete trip'}
        onPress={onDelete}
        disabled={deleting}
      >
        <Text style={styles.deleteText}>
          {deleting ? 'Deleting…' : arming ? 'Tap again to delete' : 'Delete trip'}
        </Text>
      </TouchableOpacity>
      <ActivitySheet activity={selected} onClose={() => setSelected(null)} />
      <StatusBar style="auto" />
    </ScrollView>
  );
}

/**
 * Photo hero (Airbnb pattern: photography carries the card). Renders only
 * when a real photo exists; the title block below stands alone otherwise.
 */
function TripHero({ uri, title }: { uri: string; title: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <View style={styles.heroWrap}>
      <Image
        source={{ uri }}
        style={styles.hero}
        onError={() => setFailed(true)}
        accessibilityRole="image"
        accessibilityLabel={title}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { paddingHorizontal: 24, paddingVertical: 24, gap: 12 },
  center: { flex: 1, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  muted: { fontSize: 13, color: '#6b7280' },
  errorText: { fontSize: 14, color: '#dc2626', textAlign: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', lineHeight: 30 },
  heroWrap: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#ffffff', marginTop: 8 },
  hero: { width: '100%', height: 200 },
  meta: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  tags: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  tiles: { flexDirection: 'row', gap: 8, marginTop: 4 },
  tile: { flex: 1, backgroundColor: '#ffffff', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  tileLabel: { fontSize: 11, color: '#6b7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  tileValue: { fontSize: 14, color: '#111827', fontWeight: '600', marginTop: 2 },
  interests: { fontSize: 12, color: '#6b7280' },
  emptyBox: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginTop: 4 },
  emptyText: { fontSize: 13, color: '#6b7280', textAlign: 'center' },
  day: { marginTop: 8, gap: 8 },
  dayHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  dayTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  dayDate: { fontSize: 13, color: '#6b7280' },
  activity: { backgroundColor: '#ffffff', borderRadius: 16, padding: 14, gap: 6 },
  activityTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  activityHead: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  activityTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#111827' },
  activityTime: { fontSize: 13, color: BLUE, fontWeight: '600', fontVariant: ['tabular-nums'] },
  activityDesc: { fontSize: 14, color: '#374151', lineHeight: 20 },
  activityTags: { fontSize: 12, color: '#6b7280' },
  badgeRow: { flexDirection: 'row' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  reviewsBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde047',
    backgroundColor: '#fefce8',
    paddingVertical: 10,
    alignItems: 'center',
  },
  reviewsText: { color: '#ca8a04', fontSize: 13, fontWeight: '600' },
  mapsBtn: { flex: 1, borderRadius: 12, backgroundColor: BLUE, paddingVertical: 10, alignItems: 'center' },
  mapsText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  deleteBtn: { marginTop: 8, borderRadius: 16, borderWidth: 1, borderColor: '#fecaca', paddingVertical: 14, alignItems: 'center' },
  deleteArmed: { backgroundColor: '#fef2f2', borderColor: '#dc2626' },
  deleteText: { color: '#dc2626', fontSize: 15, fontWeight: '600' },
});
