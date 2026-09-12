import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import {
  getActiveProfile,
  getActiveProfileId,
  listTrips,
  listMeals,
  fetchSpotCards,
  fetchWeather,
  type LocalProfile,
  type SpotView,
  type Weather,
} from '../data';
import { CITY_CONFIGS, type CityId } from 'tarana-web/data/cityConfig';
import Thumb from './Thumb';
import { manilaDaypart, TrafficBadge, GRADIENT } from './ui';
import { resolveWebImage } from '../data';

const CITIES: CityId[] = ['baguio', 'cebu', 'manila', 'davao'];

type HomeNav = {
  navigate: (route: string, params?: Record<string, unknown>) => void;
};

/**
 * Home — hub: 2 count cards (Trips, Cafes) + Suggested spots.
 *
 * Spots section mirrors the Spots tab contract: city pills, top 3 only,
 * same shaped cards (photo, distance · time, traffic badge). Full
 * browsing lives one tap away in the Spots tab (See all). Trips and
 * cafes are counts here, lists in their tabs — no duplicated lists.
 */
export default function Home({ navigation }: { navigation: HomeNav }) {
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [tripCount, setTripCount] = useState<number | null>(null);
  const [cafeCount, setCafeCount] = useState<number | null>(null);
  const [city, setCity] = useState<CityId>('baguio');
  const [spots, setSpots] = useState<SpotView[] | null>(null);
  const [spotsLoading, setSpotsLoading] = useState(true);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCounts = useCallback(async () => {
    try {
      const [p, id] = await Promise.all([getActiveProfile(), getActiveProfileId()]);
      setProfile(p);
      if (!id) {
        setTripCount(0);
        setCafeCount(0);
        return;
      }
      const [trips, meals] = await Promise.all([listTrips(id), listMeals(id)]);
      setTripCount(trips.length);
      setCafeCount(meals.length);
      // Baguio weather is best-effort enrichment (web dashboard pattern):
      // failure omits the card instead of blocking the hub.
      fetchWeather(16.4023, 120.596)
        .then((w) => {
          if (w.temperature != null || w.condition) setWeather(w);
        })
        .catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your hub.');
    }
  }, []);

  const loadSpots = useCallback(async (cityId: CityId) => {
    setSpotsLoading(true);
    setError(null);
    try {
      setSpots((await fetchSpotCards(cityId)).slice(0, 3));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load spots.');
      setSpots([]);
    } finally {
      setSpotsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    loadSpots(city);
  }, [city, loadSpots]);

  useFocusEffect(
    useCallback(() => {
      loadCounts();
    }, [loadCounts])
  );

  const firstName = profile?.display_name.split(' ')[0] ?? 'Traveller';
  const countsReady = tripCount !== null && cafeCount !== null;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Image
        source={require('../../assets/taranaai2.png')}
        accessibilityRole="image"
        accessibilityLabel="Tarana.ai logo"
        style={styles.logo}
        resizeMode="contain"
      />
      <View style={styles.greetWrap}>
        <LinearGradient
          colors={['#0066FF', '#1E90FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.greetCard}
        >
          <Text style={styles.greeting}>Good {manilaDaypart()}, {firstName}</Text>
          <Text style={styles.greetSub}>Everything stays on this device.</Text>
        </LinearGradient>
      </View>

      {weather ? (
        <View style={styles.weatherCard}>
          <Thumb uri={weather.iconUrl} size={48} />
          <View style={styles.weatherText}>
            <Text style={styles.weatherTemp}>
              {weather.temperature != null ? `${Math.round(weather.temperature)}°C` : '—'}
            </Text>
            <Text style={styles.weatherCond}>
              {[weather.condition, 'Baguio now'].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!countsReady && !error ? (
        <View style={styles.cardsLoading}>
          <ActivityIndicator color="#0066FF" />
        </View>
      ) : (
        <View style={styles.cards}>
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Open saved trips, ${tripCount ?? 0} saved`}
            onPress={() => navigation.navigate('SavedTrips')}
          >
            <Text style={styles.cardCount}>{tripCount ?? 0}</Text>
            <Text style={styles.cardLabel}>Saved trips</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Open saved cafes, ${cafeCount ?? 0} saved`}
            onPress={() => navigation.navigate('SavedCafes')}
          >
            <Text style={styles.cardCount}>{cafeCount ?? 0}</Text>
            <Text style={styles.cardLabel}>Saved cafes</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Suggested spots</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="See all spots"
            onPress={() => navigation.navigate('Spots')}
          >
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.pills}>
          {CITIES.map((c) => {
            const active = c === city;
            const label = (
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {CITY_CONFIGS[c].name}
              </Text>
            );
            return active ? (
              <TouchableOpacity
                key={c}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: true }}
                accessibilityLabel={`${CITY_CONFIGS[c].name} spots, selected`}
                onPress={() => setCity(c)}
              >
                <LinearGradient
                  colors={[GRADIENT.auth.from, GRADIENT.auth.to]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.pillActive}
                >
                  {label}
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                key={c}
                style={styles.pill}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: false }}
                accessibilityLabel={`${CITY_CONFIGS[c].name} spots`}
                onPress={() => setCity(c)}
              >
                {label}
              </TouchableOpacity>
            );
          })}
        </View>
        {spotsLoading ? (
          <View style={styles.listSkeleton}>
            <ActivityIndicator color="#0066FF" />
            <Text style={styles.skeletonText}>Finding spots…</Text>
          </View>
        ) : (
          spots?.map((s) => (
            <TouchableOpacity
              key={s.name}
              style={styles.row}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Open ${s.name} in Spots`}
              onPress={() => navigation.navigate('Spots')}
            >
              <Thumb uri={resolveWebImage(s.image)} size={52} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{s.name}</Text>
                <Text style={styles.rowSub}>
                  {[s.distance, s.time].filter(Boolean).join(' · ')}
                </Text>
                {s.traffic ? <TrafficBadge level={s.traffic} /> : null}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
      <StatusBar style="auto" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { paddingHorizontal: 24, paddingVertical: 24, gap: 12 },
  logo: { width: 168, height: 28, marginBottom: 4 },
  greetWrap: {
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  greetCard: { paddingHorizontal: 20, paddingVertical: 18 },
  greeting: { fontSize: 24, fontWeight: '700', color: '#ffffff', lineHeight: 30 },
  greetSub: { fontSize: 14, color: '#ffffff', opacity: 0.9, marginTop: 2 },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 12, padding: 10 },
  errorText: { color: '#dc2626', fontSize: 13 },
  weatherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  weatherText: { flex: 1, gap: 2 },
  weatherTemp: { fontSize: 28, fontWeight: '700', color: '#111827', fontVariant: ['tabular-nums'] },
  weatherCond: { fontSize: 13, color: '#6b7280', textTransform: 'capitalize' },
  cardsLoading: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    paddingVertical: 24,
    alignItems: 'center',
  },
  cards: { flexDirection: 'row', gap: 12 },
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 2,
  },
  cardCount: { fontSize: 32, fontWeight: '700', color: '#111827', fontVariant: ['tabular-nums'] },
  cardLabel: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  section: { gap: 8, marginTop: 4 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  seeAll: { fontSize: 14, color: '#0066FF', fontWeight: '600' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#ffffff' },
  pillActive: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
  pillText: { color: '#0066FF', fontSize: 13, fontWeight: '500' },
  pillTextActive: { color: '#ffffff' },
  listSkeleton: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  skeletonText: { fontSize: 13, color: '#6b7280' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  rowSub: { fontSize: 13, color: '#6b7280', fontVariant: ['tabular-nums'] },
});
