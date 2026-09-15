import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getActiveProfileId, listTrips, type LocalTrip } from '../data';
import { formatDate, firstPayloadImage, GRADIENT } from './ui';
import { ChevronLeftIcon } from './icons';
import Thumb from './Thumb';

/**
 * SavedTrips — read-only list of the active profile's trips from SQLite.
 *
 * Local-first (§2.1, §7.2): no token, no network. Trips land here via
 * local creation (7.1) or the one-way web import behind the Import tab
 * (7.4). Only plain-text columns render — same display contract as before.
 *
 * Web parity (saved-trips/page.tsx): header band + search + rows
 * (title, date · budget, tags) → TripDetail. Delete lives in the detail
 * (two-step arm); the list never deletes. No dead web affordances ported
 * (no refresh control — server-side, 401-gated).
 */
export default function SavedTrips({ navigation }: { navigation: any }) {
  const [trips, setTrips] = useState<LocalTrip[] | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const profileId = await getActiveProfileId();
      if (!profileId) {
        setError('Create a profile first to see saved trips.');
        setTrips([]);
        return;
      }
      const rows = await listTrips(profileId);
      setTrips(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load saved trips.');
      setTrips([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Re-read when returning from TripDetail (delete lands back here).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const visible = useMemo(() => {
    if (trips === null) return [];
    const q = query.trim().toLowerCase();
    if (!q) return trips;
    // Web order: title, then id — plus tags (mobile-only data, same shape).
    return trips.filter(
      (t) =>
        (t.title ?? '').toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        (t.tags ?? []).some((tag) => tag.toLowerCase().includes(q))
    );
  }, [trips, query]);

  if (trips === null) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F2F2F7' }} className="items-center justify-center">
        <ActivityIndicator />
        <Text className="mt-2 text-sm text-muted-foreground">Loading saved trips…</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  const countText = trips.length === 1 ? '1 trip saved' : `${trips.length} trips saved`;

  return (
    // Top inset only (Home precedent): content clears the notch /
    // punch-hole camera and status bar. Bottom stays navigator-owned.
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F2F2F7' }} edges={['top']}>
    <View style={{ flex: 1, backgroundColor: '#F2F2F7' }} className="px-4 pt-4">
      <View style={styles.band}>
        <LinearGradient
          colors={[GRADIENT.auth.pressedFrom, GRADIENT.auth.from]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.bandBody}
        >
          <View style={styles.titleRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Back to home"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => navigation.navigate('Home')}
            >
              <ChevronLeftIcon size={22} color="#ffffff" />
            </TouchableOpacity>
            <View style={styles.titleText}>
              <Text style={styles.bandTitle}>Saved trips</Text>
              <Text style={styles.bandSub}>{countText}</Text>
            </View>
          </View>
          <TextInput
            style={styles.search}
            placeholder="Search itineraries…"
            placeholderTextColor="rgba(255,255,255,0.7)"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            accessibilityLabel="Search saved trips"
            returnKeyType="search"
          />
        </LinearGradient>
        <View style={styles.wave} accessible={false} importantForAccessibility="no-hide-descendants">
          <Svg width="100%" height={30} viewBox="0 0 1440 90" preserveAspectRatio="none">
            <Path
              d="M0,58 C260,88 520,90 780,62 C1040,34 1240,16 1440,38 L1440,90 L0,90 Z"
              fill="#F2F2F7"
            />
          </Svg>
        </View>
      </View>
      {error ? <Text className="mb-2 text-sm text-destructive">{error}</Text> : null}
      {visible.length === 0 && !error ? (
        <View className="items-center px-6 pt-10">
          <Text className="text-base font-semibold text-foreground">
            {query.trim() ? 'No trips match your search' : 'No saved trips yet'}
          </Text>
          <Text className="mt-1 text-center text-sm text-muted-foreground">
            {query.trim()
              ? 'Try a different title, id, or tag.'
              : 'Create one or import from the web.'}
          </Text>
        </View>
      ) : null}
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.title ?? 'untitled trip'}`}
            onPress={() => navigation.navigate('TripDetail', { id: item.id })}
            className="mb-3 flex-row gap-3 rounded-lg bg-card p-3"
          >
            <Thumb uri={firstPayloadImage(item.payload)} size={56} />
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground">{item.title ?? 'Untitled trip'}</Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                {[formatDate(item.date), item.budget].filter(Boolean).join(' · ') || 'No details'}
              </Text>
              {item.tags && item.tags.length > 0 ? (
                <Text className="mt-1 text-xs text-muted-foreground">{item.tags.join(', ')}</Text>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
      />
      <StatusBar style="auto" />
    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  band: { marginHorizontal: -16 },
  bandBody: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 46, gap: 10 },
  wave: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 30 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  titleText: { flex: 1, gap: 2 },
  bandTitle: { fontSize: 22, fontWeight: '700', color: '#ffffff', lineHeight: 28 },
  bandSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  search: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#ffffff',
  },
});
