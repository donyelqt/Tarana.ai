import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientCTA, GRADIENT } from './ui';
import { fetchSpotCards, resolveWebImage, spotMapsUrl, type SpotView } from '../data';
import { CITY_CONFIGS, type CityId } from 'tarana-web/data/cityConfig';
import Thumb from './Thumb';
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

  const head = (cards ?? []).slice(0, TOP_PICKS);
  const rest = (cards ?? []).slice(TOP_PICKS);

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F7' }} className="px-4 pt-4">
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
      <View className="mb-3 flex-row flex-wrap gap-2">
        {SPOT_CITIES.map((c) => {
          const active = c === city;
          const label = (
            <Text style={[styles.pillText, active && styles.pillTextActive]}>{CITY_CONFIGS[c].name}</Text>
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
      {error ? <Text className="mb-2 text-sm text-destructive">{error}</Text> : null}
      {cards === null ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
          <Text className="mt-2 text-sm text-muted-foreground">Finding spots…</Text>
        </View>
      ) : head.length === 0 && !error ? (
        <Text className="px-1 text-sm text-muted-foreground">No spots found yet — try Baguio.</Text>
      ) : (
        <FlatList
          data={showAll ? [...head, ...rest] : head}
          keyExtractor={(item, index) => `${item.name}-${index}`}
          ListFooterComponent={
            rest.length > 0 ? (
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
            ) : null
          }
          renderItem={({ item, index }) =>
            showAll && index >= TOP_PICKS ? (
              <SpotRow card={item} />
            ) : (
              <SpotCard card={item} />
            )
          }
        />
      )}
      <StatusBar style="auto" />
    </View>
  );
}

/**
 * Spot card — web `SpotlightCard` recomposed native: photo, name,
 * distance · time (city-center estimates, same formula), traffic badge,
 * peak hours, and one "Open in Maps" action (the iframe facade + external
 * link collapse into the system Maps app — zero function lost).
 */
function SpotCard({ card: item }: { card: SpotView }) {
  const url = spotMapsUrl(item.lat, item.lon);
  return (
    <View className="mb-3 rounded-lg bg-card p-3">
      <View className="flex-row gap-3">
        <Thumb uri={resolveWebImage(item.image)} size={64} />
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground">{item.name}</Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            {[item.distance, item.time, item.peakHours ? `Peak: ${item.peakHours}` : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {item.traffic ? <TrafficBadge level={item.traffic} /> : null}
        </View>
      </View>
      {url ? (
        <GradientCTA
          variant="app"
          title="Open in Maps"
          onPress={() => Linking.openURL(url)}
          accessibilityLabel={`Open ${item.name} in Maps`}
        />
      ) : null}
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
  heroWrap: {
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    marginBottom: 12,
  },
  hero: { paddingHorizontal: 20, paddingVertical: 18 },
  heroTitle: { fontSize: 22, fontWeight: '700', color: '#ffffff', lineHeight: 28 },
  heroSub: { fontSize: 13, color: '#ffffff', opacity: 0.9, marginTop: 2 },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pillActive: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 18 },
  pillText: { color: '#0066FF', fontSize: 14, fontWeight: '500' },
  pillTextActive: { color: '#ffffff' },
});
