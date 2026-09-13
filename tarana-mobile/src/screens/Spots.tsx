import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientCTA, GRADIENT, SpotPhoto, spotCardStyles } from './ui';
import { MapPinIcon } from './icons';
import { fetchSpotCards, resolveWebImage, spotMapsUrl, type SpotView } from '../data';
import { CITY_CONFIGS, type CityId } from 'tarana-web/data/cityConfig';
import Thumb from './Thumb';
import SpotCityPills from './SpotCityPills';
import { TrafficBadge } from './ui';

const TOP_PICKS = 3;

/**
 * Spots — suggested spots per city, via the data seam.
 *
 * HARD RULE (Metro probe): never import web search/traffic modules here.
 * `intelligentSearch` imports Node `crypto`, `itineraryData` value-imports
 * ~40 images from `public/` plus web-only icons, and `agenticTrafficAgent`
 * is orphaned — all quarantined. Traffic badges render API-returned values
 * only (`traffic` field below, measured server-side).
 *
 * The one shared import is `tarana-web/data/cityConfig` (zero Node/Next
 * imports — probe-verified portable), used for city display names only.
 * Data comes from `../data` (session-free proxy, validated at boundary);
 * offline throws → error state below, never a login wall.
 */
/**
 * Spots — web `SuggestedSpots` composition, native (§8 + user call).
 *
 * Same shaping, same order: header + "Top picks in {city}" subtitle +
 * city pills + top-3 cards, then a "Show all" disclosure with compact
 * rows (browse preserved). Null-coord entries never reach the list
 * (dropped in the seam, like `toSpotCard` → null → filtered).
 */
const SPOT_CITIES: CityId[] = ['baguio', 'cebu', 'manila', 'davao'];

export default function Spots() {
  const [city, setCity] = useState<CityId>('baguio');
  const [cards, setCards] = useState<SpotView[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cityId: CityId) => {
    setCards(null);
    setShowAll(false);
    setError(null);
    try {
      setCards(await fetchSpotCards(cityId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load spots.');
      setCards([]);
    }
  }, []);

  useEffect(() => {
    load(city);
  }, [city, load]);

  const { width: viewportWidth } = useWindowDimensions();
  // 1.15 cards peek: card fills the guttered width minus a peek strip,
  // so the next card advertises the swipe. Snap interval = card + gap.
  const cardWidth = Math.round(viewportWidth - 32 - 56);
  const snapInterval = cardWidth + 12;

  const head = (cards ?? []).slice(0, TOP_PICKS);
  const rest = (cards ?? []).slice(TOP_PICKS);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroWrap}>
        <LinearGradient
          colors={[GRADIENT.auth.from, GRADIENT.auth.to]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.hero}
        >
          <Text style={styles.heroTitle}>Suggested Spots</Text>
          <Text style={styles.heroSub}>Top picks in {CITY_CONFIGS[city].name}</Text>
        </LinearGradient>
      </View>
      <SpotCityPills cities={SPOT_CITIES} city={city} onSelect={setCity} />
      {error ? <Text className="mb-2 text-sm text-destructive">{error}</Text> : null}
      {cards === null ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator />
          <Text className="mt-2 text-sm text-muted-foreground">Finding spots…</Text>
        </View>
      ) : head.length === 0 && !error ? (
        <View style={styles.emptyContainer}>
          <Text className="px-1 text-sm text-muted-foreground">No spots found yet — try Baguio.</Text>
        </View>
      ) : (
        <View>
          <FlatList
            data={head}
            keyExtractor={(item, index) => `${item.name}-${index}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={snapInterval}
            decelerationRate="fast"
            contentContainerStyle={{ gap: 12, paddingRight: 24 }}
            renderItem={({ item }) => <SpotCard card={item} width={cardWidth} />}
          />
          {rest.length > 0 ? (
            <TouchableOpacity
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={showAll ? 'Show fewer spots' : `Show all ${cards?.length} spots`}
              onPress={() => setShowAll((v) => !v)}
              className="items-center py-3"
            >
              <Text className="text-sm font-semibold text-primary">
                {showAll ? 'Show less' : `Show all ${cards?.length} spots`}
              </Text>
            </TouchableOpacity>
          ) : null}
          {showAll
            ? rest.map((item, index) => <SpotRow key={`${item.name}-${index}`} card={item} />)
            : null}
        </View>
      )}
      <StatusBar style="auto" />
    </ScrollView>
  );
}

/**
 * Spot card — Home card language via shared `spotCardStyles`: photo-led
 * full-bleed top, name, pin meta, traffic badge. Spots-only additions kept:
 * the "Open in Maps" action (this screen's purpose) and peak-hours in meta.
 * Fixed width comes from the caller (viewport-derived).
 */
function SpotCard({ card: item, width }: { card: SpotView; width: number }) {
  const url = spotMapsUrl(item.lat, item.lon);
  const uri = resolveWebImage(item.image);
  const meta = [item.distance, item.time, item.peakHours ? `Peak: ${item.peakHours}` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={[spotCardStyles.card, { width }]}>
      <SpotPhoto uri={uri} name={item.name} height={168} radius={0} />
      <View style={spotCardStyles.body}>
        <Text style={spotCardStyles.title} numberOfLines={1}>{item.name}</Text>
        {meta ? (
          <View style={spotCardStyles.metaRow}>
            <View accessible={false} importantForAccessibility="no-hide-descendants">
              <MapPinIcon size={12} color="#0066FF" />
            </View>
            <Text style={spotCardStyles.meta} numberOfLines={1}>{meta}</Text>
          </View>
        ) : null}
        {item.traffic ? <TrafficBadge level={item.traffic} /> : null}
        {url ? (
          <View style={styles.ctaWrap}>
            <GradientCTA
              variant="app"
              title="Open in Maps"
              onPress={() => Linking.openURL(url)}
              accessibilityLabel={`Open ${item.name} in Maps`}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}
/**
 * Compact row for the "show all" disclosure: name + distance · time +
 * badge, tap opens Maps. Same data as the card, denser composition.
 */
function SpotRow({ card: item }: { card: SpotView }) {
  const url = spotMapsUrl(item.lat, item.lon);
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={url ? `Open ${item.name} in Maps` : item.name}
      disabled={!url}
      onPress={() => url && Linking.openURL(url)}
      className="mb-2 flex-row items-center gap-3 rounded-lg bg-card px-3 py-2"
    >
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground">{item.name}</Text>
        <Text className="text-xs text-muted-foreground">
          {[item.distance, item.time].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {item.traffic ? <TrafficBadge level={item.traffic} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroWrap: {
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    marginBottom: 12,
  },
  hero: { paddingHorizontal: 20, paddingVertical: 18 },
  heroTitle: { fontSize: 22, fontWeight: '700', color: '#ffffff', lineHeight: 28 },
  heroSub: { fontSize: 13, color: '#ffffff', opacity: 0.9, marginTop: 2 },
  ctaWrap: { marginTop: 8 },
});
