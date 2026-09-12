import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { getActiveProfileId, listTrips, deleteTrip, resolveWebImage, type LocalTrip } from '../data';
import { formatDate, firstPayloadImage } from './ui';
import Thumb from './Thumb';

const BLUE = '#0066FF';

type Activity = {
  title?: string;
  time?: string;
  desc?: string;
  tags?: string[];
  trafficLevel?: string;
  image?: unknown;
};

type Period = {
  period?: string;
  activities?: Activity[];
};

type Payload = {
  formData?: { budget?: string; pax?: string; duration?: string } | null;
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

/**
 * TripDetail — read-only itinerary with delete (§8).
 *
 * Web detail skeleton recomposed native: header → info tiles → per-period
 * sections (period pill + activity rows). Web refresh stays server-side
 * (401-gated) — deferred to post-Phase-4 local re-run, so v1 has no
 * refresh control at all (no dead buttons). Delete is a two-step arm
 * (destructive actions need confirmation; no modal dependency).
 */
export default function TripDetail({ navigation, route }: { navigation: any; route: { params?: { id?: string } } }) {
  const [trip, setTrip] = useState<LocalTrip | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [arming, setArming] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
  const periods = payload?.itineraryData?.items ?? [];
  const form = payload?.formData;
  const heroUri = firstPayloadImage(trip.payload);

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

      {periods.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No day-by-day details saved for this trip.</Text>
        </View>
      ) : (
        periods.map((p, i) => (
          <View key={`${p.period ?? 'period'}-${i}`} style={styles.period}>
            <View style={styles.periodPill}>
              <Text style={styles.periodPillText}>{p.period || `Part ${i + 1}`}</Text>
            </View>
            {(p.activities ?? []).map((a, j) => (
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
                <View style={styles.activityFoot}>
                  {(a.tags ?? []).length > 0 ? (
                    <Text style={styles.activityTags}>{(a.tags ?? []).join(' · ')}</Text>
                  ) : null}
                  {a.trafficLevel ? <Text style={styles.traffic}>Traffic: {a.trafficLevel}</Text> : null}
                </View>
              </View>
            ))}
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
  emptyBox: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginTop: 4 },
  emptyText: { fontSize: 13, color: '#6b7280', textAlign: 'center' },
  period: { marginTop: 8, gap: 8 },
  periodPill: { alignSelf: 'flex-start', backgroundColor: '#eff6ff', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
  periodPillText: { color: BLUE, fontSize: 13, fontWeight: '600' },
  activity: { backgroundColor: '#ffffff', borderRadius: 16, padding: 14, gap: 6 },
  activityTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  activityHead: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  activityTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#111827' },
  activityTime: { fontSize: 13, color: BLUE, fontWeight: '600', fontVariant: ['tabular-nums'] },
  activityDesc: { fontSize: 14, color: '#374151', lineHeight: 20 },
  activityFoot: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  activityTags: { flex: 1, fontSize: 12, color: '#6b7280' },
  traffic: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  deleteBtn: { marginTop: 8, borderRadius: 16, borderWidth: 1, borderColor: '#fecaca', paddingVertical: 14, alignItems: 'center' },
  deleteArmed: { backgroundColor: '#fef2f2', borderColor: '#dc2626' },
  deleteText: { color: '#dc2626', fontSize: 15, fontWeight: '600' },
});
