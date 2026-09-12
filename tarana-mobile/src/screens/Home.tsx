import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import {
  getActiveProfile,
  getActiveProfileId,
  listTrips,
  listMeals,
  fetchSpotCards,
  fetchWeather,
  resolveWebImage,
  type LocalProfile,
  type SpotView,
  type Weather,
} from '../data';
import { CITY_CONFIGS, type CityId } from 'tarana-web/data/cityConfig';
import { manilaDaypart, TrafficBadge } from './ui';
import { MapPinIcon, UtensilsIcon } from './icons';

const CITIES: CityId[] = ['baguio', 'cebu', 'manila', 'davao'];

/**
 * Reference-mapped pill icons (travel-app pattern, our cities).
 * Emoji here is intentional: the reference uses Beach ⛱ / Mountain ⛰ /
 * Camping 🏕 glyphs as the pill signifier. We keep our city logic and
 * only add the signifier — Baguio highlands, Cebu coast, Manila city,
 * Davao gulf. No new behavior, no removed content.
 */
const CITY_ICONS: Partial<Record<CityId, string>> = {
  baguio: '⛰️',
  cebu: '🏖️',
  manila: '🏙️',
  davao: '🌊',
};

type HomeNav = {
  navigate: (route: string, params?: Record<string, unknown>) => void;
};

/**
 * Home — reference-composed hub (travel-app pattern, our voice).
 *
 * Pattern borrowed (never pixels): identity header (muted daypart +
 * statement name + avatar) → search entry → counts → weather → city
 * pills → horizontal photo cards → see-all. Nothing removed: greeting,
 * subcopy (also in Settings), counts, weather, pills, preview rows all
 * survive recomposed. Heart toggles stay out — they need a favorites
 * system that does not exist yet (explicit follow-up, not a silent gap).
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
  const { width: viewportWidth } = useWindowDimensions();

  // 1.15 cards peek so the next card advertises the swipe.
  // 20px page padding (40) + 72px peek reserve; gap 12 matches list.
  const cardWidth = Math.round(viewportWidth - 40 - 72);
  const snapInterval = cardWidth + 12;

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
  const initial = (firstName[0] ?? 'T').toUpperCase();
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

      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.daypart}>Good {manilaDaypart()},</Text>
          <Text style={styles.name}>{firstName}?</Text>
        </View>
        <View style={styles.avatar} accessibilityRole="image" accessibilityLabel={`${firstName} profile`}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.search}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Search destinations"
        onPress={() => navigation.navigate('Explore')}
      >
        <Text style={styles.searchIcon}>⌕</Text>
        <Text style={styles.searchText}>Search destinations…</Text>
      </TouchableOpacity>

      {weather ? (
        <View style={styles.weatherCard}>
          <Text style={styles.weatherTemp}>
            {weather.temperature != null ? `${Math.round(weather.temperature)}°C` : '—'}
          </Text>
          <Text style={styles.weatherCond}>
            {[weather.condition, 'Baguio now'].filter(Boolean).join(' · ')}
          </Text>
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
            <View style={styles.cardIcon} accessible={false} importantForAccessibility="no-hide-descendants">
              <MapPinIcon size={30} color="#0066FF" />
            </View>
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
            <View style={styles.cardIcon} accessible={false} importantForAccessibility="no-hide-descendants">
              <UtensilsIcon size={30} color="#0066FF" />
            </View>
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pills}
          style={styles.pillsWrap}
        >
          {CITIES.map((c) => {
            const active = c === city;
            const icon = CITY_ICONS[c] ?? '📍';
            const label = (
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {icon}  {CITY_CONFIGS[c].name}
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
                <View style={styles.pillActive}>{label}</View>
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
        </ScrollView>
        {spotsLoading ? (
          <View style={styles.listSkeleton}>
            <ActivityIndicator color="#0066FF" />
            <Text style={styles.skeletonText}>Finding spots…</Text>
          </View>
        ) : (
          <FlatList
            data={spots ?? []}
            keyExtractor={(item) => item.name}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={snapInterval}
            decelerationRate="fast"
            contentContainerStyle={{ gap: 12, paddingRight: 24 }}
            renderItem={({ item }) => <HomeSpotCard card={item} width={cardWidth} navigation={navigation} />}
          />
        )}
      </View>
      <StatusBar style="auto" />
    </ScrollView>
  );
}

/**
 * Reference-polished photo card: image-led top (taller, 168), name,
 * blue-pin meta, badge. Tap goes to the full Spots screen (preview
 * never duplicates actions). Nothing removed — distance · time +
 * traffic all survive, recomposed to the Popular Destination pattern.
 */
function HomeSpotCard({
  card: item,
  width,
  navigation,
}: {
  card: SpotView;
  width: number;
  navigation: HomeNav;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const uri = resolveWebImage(item.image);
  const meta = [item.distance, item.time].filter(Boolean).join(' · ');
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.name} in Spots`}
      onPress={() => navigation.navigate('Spots')}
      style={[styles.photoCard, { width }]}
    >
      {uri && !imgFailed ? (
        <Image
          source={{ uri }}
          style={styles.photo}
          onError={() => setImgFailed(true)}
          accessibilityRole="image"
          accessibilityLabel={`${item.name} photo`}
        />
      ) : (
        <View style={[styles.photo, styles.photoEmpty]}>
          <Text style={styles.photoEmptyText}>{item.name[0] ?? '·'}</Text>
        </View>
      )}
      <View style={styles.photoBody}>
        <Text style={styles.photoTitle} numberOfLines={1}>{item.name}</Text>
        {meta ? (
          <Text style={styles.photoMeta} numberOfLines={1}>
            <Text style={styles.photoPin}>◉ </Text>
            {meta}
          </Text>
        ) : null}
        {item.traffic ? <TrafficBadge level={item.traffic} /> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { paddingHorizontal: 20, paddingVertical: 24, gap: 16 },
  logo: { width: 152, height: 26, marginBottom: 2, opacity: 0.95 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerText: { flex: 1, gap: 2 },
  daypart: { fontSize: 14, color: '#6b7280', fontWeight: '400' },
  name: { fontSize: 28, fontWeight: '800', color: '#111827', lineHeight: 34, letterSpacing: -0.5 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#0066FF' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: { fontSize: 18, color: '#9ca3af' },
  searchText: { fontSize: 15, color: '#9ca3af' },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FECACA' },
  errorText: { color: '#dc2626', fontSize: 13 },
  weatherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  weatherText: { flex: 1, gap: 2 },
  weatherTemp: { fontSize: 26, fontWeight: '800', color: '#111827', fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
  weatherCond: { fontSize: 13, color: '#6b7280', textTransform: 'capitalize' },
  cardsLoading: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    paddingVertical: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cards: { flexDirection: 'row', gap: 12 },
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardCount: { fontSize: 30, fontWeight: '800', color: '#111827', fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
  cardLabel: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  cardIcon: { position: 'absolute', top: 12, right: 12, opacity: 0.28 },
  section: { gap: 12, marginTop: 4 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { fontSize: 19, fontWeight: '700', color: '#111827', letterSpacing: -0.2 },
  seeAll: { fontSize: 14, color: '#0066FF', fontWeight: '600' },
  pillsWrap: { marginHorizontal: -20, paddingHorizontal: 20 },
  pills: { flexDirection: 'row', gap: 8, paddingRight: 20 },
  pill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#ffffff' },
  pillActive: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#0066FF' },
  pillText: { color: '#0066FF', fontSize: 13, fontWeight: '500' },
  pillTextActive: { color: '#ffffff' },
  listSkeleton: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  skeletonText: { fontSize: 13, color: '#6b7280' },
  photoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 0,
    gap: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  photo: { width: '100%', height: 168, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  photoEmpty: { backgroundColor: '#EFF6FF' },
  photoBody: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, gap: 3 },
  photoEmptyText: { fontSize: 40, fontWeight: '700', color: '#0066FF', opacity: 0.5 },
  photoTitle: { fontSize: 16, fontWeight: '700', color: '#111827', letterSpacing: -0.2 },
  photoMeta: { fontSize: 12, color: '#6b7280', fontVariant: ['tabular-nums'] },
  photoPin: { color: '#0066FF', fontSize: 12 },
});
