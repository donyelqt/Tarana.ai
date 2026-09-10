import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Button, FlatList, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { config } from '../config';
import { withMobileAuth } from '../auth';
import { CITY_CONFIGS, type CityId } from 'tarana-web/data/cityConfig';

/**
 * Spots — suggested spots per city, fetched from the WEB API over HTTP.
 *
 * HARD RULE (Metro probe): never import web search/traffic modules here.
 * `intelligentSearch` imports Node `crypto`, `itineraryData` value-imports
 * ~40 images from `public/` plus web-only icons, and `agenticTrafficAgent`
 * is orphaned — all quarantined. Traffic badges render API-returned values
 * only (`traffic` field below, measured server-side).
 *
 * The one shared import is `tarana-web/data/cityConfig` (zero Node/Next
 * imports — probe-verified portable), used for city display names only.
 */
const SPOT_CITIES: CityId[] = ['baguio', 'cebu', 'manila', 'davao'];

type SpotItem = {
  name: string;
  image: string | null;
  lat: number | null;
  lon: number | null;
  peakHours: string | null;
  traffic?: 'Low' | 'Moderate' | 'High';
};

export default function Spots() {
  const [city, setCity] = useState<CityId>('baguio');
  const [spots, setSpots] = useState<SpotItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cityId: CityId) => {
    setSpots(null);
    setError(null);
    try {
      const headers = await withMobileAuth({ 'Content-Type': 'application/json' });
      const res = await fetch(`${config.webBaseUrl}/api/spots?city=${cityId}`, { headers });
      if (!res.ok) throw new Error(`Spots request failed (${res.status}).`);
      const json = (await res.json()) as { success?: boolean; spots?: SpotItem[]; error?: string };
      if (!json.success || !Array.isArray(json.spots)) {
        throw new Error(json.error ?? 'Spots response was not successful.');
      }
      setSpots(json.spots);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load spots.');
      setSpots([]);
    }
  }, []);

  useEffect(() => {
    load(city);
  }, [city, load]);

  return (
    <View className="flex-1 bg-background px-4 pt-4">
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
      {spots === null ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
          <Text className="mt-2 text-sm text-muted-foreground">Loading spots…</Text>
        </View>
      ) : (
        <FlatList
          data={spots}
          keyExtractor={(item, index) => `${item.name}-${index}`}
          renderItem={({ item }) => (
            <View className="mb-3 rounded-lg border border-border bg-card p-3">
              <Text className="text-base font-semibold text-foreground">{item.name}</Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                {[item.traffic ? `Traffic: ${item.traffic}` : null, item.peakHours ? `Peak: ${item.peakHours}` : null]
                  .filter(Boolean)
                  .join(' · ') || 'Details unavailable'}
              </Text>
            </View>
          )}
        />
      )}
      <StatusBar style="auto" />
    </View>
  );
}
