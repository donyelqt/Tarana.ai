import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Button, FlatList, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchSpotCards, resolveWebImage, spotMapsUrl, type SpotTraffic, type SpotView } from '../data';
import { CITY_CONFIGS, type CityId } from 'tarana-web/data/cityConfig';
import Thumb from './Thumb';

const BLUE = '#0066FF';
const BLUE_LIGHT = '#1E90FF';
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
    <View className="flex-1 bg-background px-4 pt-4">
      <View className="mb-1 flex-row items-baseline justify-between px-1">
        <Text className="text-xl font-medium text-foreground">Suggested Spots</Text>
        <Text className="text-sm text-muted-foreground">Top picks in {CITY_CONFIGS[city].name}</Text>
      </View>
      <View className="mb-3 flex-row flex-wrap gap-2">
        {SPOT_CITIES.map((c) => (
          <View key={c} className={`rounded-full px-1 ${c === city ? 'bg-primary' : 'bg-secondary'}`}>
            <Button
              title={CITY_CONFIGS[c].name}
              color={c === city ? '#ffffff' : '#0f172a'}
              onPress={() => setCity(c)}
            />
          </View>
        ))}
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
    <View className="mb-3 rounded-lg border border-border bg-card p-3">
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
        <TouchableOpacity
          onPress={() => Linking.openURL(url)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Open ${item.name} in Maps`}
          style={styles.mapCtaOuter}
        >
          <LinearGradient
            colors={[BLUE, BLUE_LIGHT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.mapCta}
          >
            <Text style={styles.mapCtaText}>Open in Maps</Text>
          </LinearGradient>
        </TouchableOpacity>
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
      className="mb-2 flex-row items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
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
/**
 * Traffic badge — web semantics (SpotlightCard green/yellow/red):
 * Low = green tint, Moderate = amber tint, High = red tint.
 * Color never stands alone: the level word is always present as text.
 */
const BADGE: Record<SpotTraffic, { bg: string; fg: string }> = {
  Low: { bg: '#dcfce7', fg: '#15803d' },
  Moderate: { bg: '#fef9c3', fg: '#a16207' },
  High: { bg: '#fee2e2', fg: '#b91c1c' },
};

function TrafficBadge({ level }: { level: SpotTraffic }) {
  const c = BADGE[level];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{level} traffic</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, marginTop: 6 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  mapCtaOuter: { borderRadius: 12, marginTop: 10 },
  mapCta: { paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  mapCtaText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
});
