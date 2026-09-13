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
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { manilaDaypart, SpotPhoto, spotCardStyles, TrafficBadge, GRADIENT } from './ui';
import { MapPinIcon, SearchIcon, ChevronRightIcon, UtensilsIcon } from './icons';
import Thumb from './Thumb';

const CITIES: CityId[] = ['baguio', 'cebu', 'manila', 'davao'];

/**
 * City pills share one vector signifier (MapPin, system stroke 2.0) instead
 * of per-city emoji: emoji renders inconsistently across Android/iOS OEM
 * fonts and can't follow tint tokens. City identity comes from the label.
 */

type HomeNav = {
  navigate: (route: string, params?: Record<string, unknown>) => void;
};

/**
 * Home — reference-composed hub (travel-app pattern, our voice).
 *
 * Pattern borrowed (never pixels): brand-blue header band (greeting +
 * search on gradient, wave divider into the grouped canvas) → counts →
 * weather → city pills → horizontal photo cards → see-all. Nothing
 * removed: greeting, subcopy (also in Settings), counts, weather, pills,
 * preview rows all survive recomposed. Heart toggles stay out — they need
 * a favorites system that does not exist yet (explicit follow-up, not a
 * silent gap). The blue logo stays on the canvas above the band: blue on
 * blue would be illegible, so it is not forced inside.
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
    // Top inset only (AuthEntry precedent): the logo clears the notch /
    // punch-hole camera and status bar on every device. Bottom is owned
    // by the navigator's tab bar, so it is deliberately not inset here.
    <SafeAreaView style={styles.root} edges={['top']}>
    <ScrollView
      style={styles.scroll}
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

      <View style={styles.band}>
        <LinearGradient
          colors={[GRADIENT.auth.pressedFrom, GRADIENT.auth.from]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.bandBody}
        >
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.daypart}>Good {manilaDaypart()},</Text>
              <Text style={styles.name}>{firstName}</Text>
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
            <View accessible={false} importantForAccessibility="no-hide-descendants">
              <SearchIcon size={18} color="#6b7280" />
            </View>
            <Text style={styles.searchText}>Search destinations…</Text>
          </TouchableOpacity>
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
        <View style={styles.cardsLoading} accessibilityLiveRegion="polite">
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
            <View style={styles.cardTop}>
              <View style={styles.cardIcon} accessible={false} importantForAccessibility="no-hide-descendants">
                <MapPinIcon size={20} color="#0066FF" />
              </View>
              <View accessible={false} importantForAccessibility="no-hide-descendants">
                <ChevronRightIcon size={18} color="#6b7280" />
              </View>
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
            <View style={styles.cardTop}>
              <View style={styles.cardIcon} accessible={false} importantForAccessibility="no-hide-descendants">
                <UtensilsIcon size={20} color="#0066FF" />
              </View>
              <View accessible={false} importantForAccessibility="no-hide-descendants">
                <ChevronRightIcon size={18} color="#6b7280" />
              </View>
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
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
            const pillLabel = (
              <View style={styles.pillContent}>
                <View accessible={false} importantForAccessibility="no-hide-descendants">
                  <MapPinIcon size={14} color={active ? '#ffffff' : '#0066FF'} />
                </View>
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {CITY_CONFIGS[c].name}
                </Text>
              </View>
            );
            return active ? (
              <TouchableOpacity
                key={c}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: true }}
                accessibilityLabel={`${CITY_CONFIGS[c].name} spots, selected`}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                onPress={() => setCity(c)}
              >
                <LinearGradient
                  colors={[GRADIENT.app.from, GRADIENT.app.to]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.pillActive}
                >
                  {pillLabel}
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
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                onPress={() => setCity(c)}
              >
                {pillLabel}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {spotsLoading ? (
          <View style={styles.listSkeleton} accessibilityLiveRegion="polite">
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
    </SafeAreaView>
  );
}

/**
 * Home preview card — Spots card composition, preview role: shared
 * SpotPhoto (logo fallback), name, pin meta, badge. Tap goes to the full
 * Spots screen; the "Open in Maps" action lives there only (preview never
 * duplicates actions). Meta matches Spots (distance · time · peak).
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
  const uri = resolveWebImage(item.image);
  const meta = [item.distance, item.time, item.peakHours ? `Peak: ${item.peakHours}` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.name} in Spots`}
      onPress={() => navigation.navigate('Spots')}
      style={[spotCardStyles.card, { width }]}
    >
      <SpotPhoto uri={uri} name={item.name} height={168} radius={0} />
      <View style={spotCardStyles.body}>
        <Text style={spotCardStyles.title} numberOfLines={1}>{item.name}</Text>
        {meta ? (
          <View style={spotCardStyles.metaRow}>
            <View accessible={false} importantForAccessibility="no-hide-descendants">
              <MapPinIcon size={12} color="#0066FF" />
            </View>
            <Text style={spotCardStyles.meta} numberOfLines={1}>
              {meta}
            </Text>
          </View>
        ) : null}
        {item.traffic ? <TrafficBadge level={item.traffic} /> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingVertical: 24, gap: 16 },
  logo: { width: 152, height: 26, marginBottom: 2, opacity: 0.95 },
  band: { marginHorizontal: -20 },
  bandBody: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 46, gap: 16 },
  wave: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 30 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerText: { flex: 1, gap: 2 },
  daypart: { fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: '400' },
  name: { fontSize: 28, fontWeight: '800', color: '#ffffff', lineHeight: 34, letterSpacing: -0.5 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#ffffff' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  searchText: { fontSize: 15, color: '#6b7280' },
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
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardCount: { fontSize: 30, fontWeight: '800', color: '#111827', fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
  cardLabel: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { gap: 12, marginTop: 4 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { fontSize: 19, fontWeight: '700', color: '#111827', letterSpacing: -0.2 },
  seeAll: { fontSize: 14, color: '#0066FF', fontWeight: '600' },
  pillsWrap: { marginHorizontal: -20, paddingHorizontal: 20 },
  pills: { flexDirection: 'row', gap: 8, paddingRight: 20 },
  pill: { paddingVertical: 11, paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#E5E7EB' },
  pillActive: { borderRadius: 999, paddingVertical: 11, paddingHorizontal: 16 },
  pillContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
});
