import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getActiveProfile,
  getActiveProfileId,
  listTrips,
  listMeals,
  fetchSpots,
  fetchWeather,
  signOut,
  type LocalProfile,
  type LocalMeal,
  type Spot,
  type Weather,
} from '../data';
import Thumb from './Thumb';

const BLUE = '#0066FF';
const BLUE_LIGHT = '#1E90FF';

type HomeNav = {
  replace: (route: string) => void;
  navigate: (route: string, params?: Record<string, unknown>) => void;
};

/**
 * Home — native dashboard hub (web dashboard skeleton, funnel removed).
 *
 * Pattern: greeting → hero stat → live preview sections → destination
 * rows. Credits, referrals, tiers, invites, and ads are cut (ADR-002:
 * meaningless in a paid offline app). Preview sections render only when
 * their data exists — offline or empty means the section is omitted,
 * never a dead card. Plan/Eats rows arrive with their own slices (§8);
 * this file grows one row per slice, nothing speculative.
 */
export default function Home({ navigation }: { navigation: HomeNav }) {
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [tripCount, setTripCount] = useState<number | null>(null);
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [meals, setMeals] = useState<LocalMeal[] | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, id] = await Promise.all([getActiveProfile(), getActiveProfileId()]);
      setProfile(p);
      if (!id) {
        setTripCount(0);
        setMeals([]);
        setSpots(null);
        return;
      }
      const [trips, savedMeals] = await Promise.all([listTrips(id), listMeals(id)]);
      setTripCount(trips.length);
      setMeals(savedMeals.slice(0, 3));
      try {
        setSpots((await fetchSpots('baguio')).slice(0, 3));
      } catch {
        setSpots(null);
      }
      try {
        // Baguio defaults match the route's own fallback (16.4023, 120.5960).
        const w = await fetchWeather(16.4023, 120.596);
        setWeather(w.temperature != null || w.condition ? w : null);
      } catch {
        setWeather(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your hub.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSignOut = async () => {
    await signOut();
    navigation.replace('Landing');
  };

  const firstName = profile?.display_name.split(' ')[0] ?? 'Traveller';
  const loading = tripCount === null && !error;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>Tarana.ai</Text>
      <Text style={styles.greeting}>Hi, {firstName}</Text>
      <Text style={styles.subcopy}>Everything stays on this device.</Text>

      {weather ? (
        <View style={styles.weatherStrip}>
          <Thumb uri={weather.iconUrl} size={36} radius={18} />
          <Text style={styles.weatherText}>
            {weather.temperature != null ? `${Math.round(weather.temperature)}°C` : '—'}
            {weather.condition ? ` · ${weather.condition}` : ''} in Baguio
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.heroSkeleton}>
          <ActivityIndicator color={BLUE} />
          <Text style={styles.skeletonText}>Loading…</Text>
        </View>
      ) : (
        <View style={styles.heroWrapper}>
          <LinearGradient
            colors={[BLUE, BLUE_LIGHT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.hero}
          >
            <Text style={styles.heroCount}>{tripCount ?? 0}</Text>
            <Text style={styles.heroLabel}>
              {(tripCount ?? 0) === 1 ? 'saved trip' : 'saved trips'}
            </Text>
            <TouchableOpacity
              style={styles.heroCta}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="View trips"
              onPress={() => navigation.navigate('SavedTrips')}
            >
              <Text style={styles.heroCtaText}>View trips</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      )}

      {spots && spots.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Nearby spots</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="See all spots"
              onPress={() => navigation.navigate('Spots')}
            >
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {spots.map((s) => (
            <TouchableOpacity
              key={s.name}
              style={styles.miniRow}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Open spots in ${s.name}`}
              onPress={() => navigation.navigate('Spots')}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{s.name}</Text>
                {s.traffic ? <Text style={styles.rowSub}>Traffic: {s.traffic}</Text> : null}
              </View>
              <Text style={styles.rowChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {meals && meals.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Saved cafes</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="See all saved cafes"
              onPress={() => navigation.navigate('SavedCafes')}
            >
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {meals.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={styles.miniRow}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Open ${m.cafe_name}`}
              onPress={() => navigation.navigate('CafeDetail', { name: m.cafe_name })}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{m.cafe_name}</Text>
                {m.price != null ? <Text style={styles.rowSub}>₱{m.price}</Text> : null}
              </View>
              <Text style={styles.rowChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Plan a trip"
        onPress={() => navigation.navigate('Plan')}
      >
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>Plan a trip</Text>
          <Text style={styles.rowSub}>Baguio, Cebu, Manila, Davao</Text>
        </View>
        <Text style={styles.rowChevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Explore routes"
        onPress={() => navigation.navigate('Explore')}
      >
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>Explore routes</Text>
          <Text style={styles.rowSub}>Live directions with traffic</Text>
        </View>
        <Text style={styles.rowChevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Find a meal"
        onPress={() => navigation.navigate('Eats')}
      >
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>Find a meal</Text>
          <Text style={styles.rowSub}>20 Baguio cafes, filtered on-device</Text>
        </View>
        <Text style={styles.rowChevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Open settings"
        onPress={() => navigation.navigate('Settings')}
      >
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>Settings</Text>
          <Text style={styles.rowSub}>Profile, about, link account</Text>
        </View>
        <Text style={styles.rowChevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={onSignOut}
        style={styles.signOut}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
      <StatusBar style="auto" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  content: { paddingHorizontal: 24, paddingVertical: 24, gap: 12 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: BLUE,
  },
  greeting: { fontSize: 28, fontWeight: '600', color: '#111827', lineHeight: 34 },
  subcopy: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  weatherStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  weatherText: { fontSize: 14, color: '#374151', fontWeight: '500', fontVariant: ['tabular-nums'] },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 12, padding: 10 },
  errorText: { color: '#dc2626', fontSize: 13 },
  heroSkeleton: {
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
  },
  skeletonText: { fontSize: 13, color: '#6b7280' },
  heroWrapper: {
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  hero: { paddingHorizontal: 20, paddingVertical: 20 },
  heroCount: {
    fontSize: 40,
    fontWeight: '700',
    color: '#ffffff',
    fontVariant: ['tabular-nums'],
  },
  heroLabel: { fontSize: 14, color: '#ffffff', opacity: 0.9, marginTop: 2 },
  heroCta: {
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  heroCtaText: { color: BLUE, fontSize: 15, fontWeight: '600' },
  section: { gap: 8, marginTop: 4 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  seeAll: { fontSize: 14, color: BLUE, fontWeight: '600' },
  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  rowSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  rowChevron: { fontSize: 22, color: '#9ca3af', fontWeight: '400' },
  signOut: { alignItems: 'center', paddingVertical: 12 },
  signOutText: { fontSize: 14, color: '#6b7280' },
});
