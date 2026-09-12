import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { getActiveProfileId, listTrips, resolveWebImage, type LocalTrip } from '../data';
import Thumb from './Thumb';

/** First real photo in the saved payload (string http URL only). */
function firstImage(payload: string | null): string | null {
  if (!payload) return null;
  try {
    const parsed: unknown = JSON.parse(payload);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const items = (parsed as { itineraryData?: { items?: Array<{ activities?: Array<{ image?: unknown }> }> } })
      .itineraryData?.items;
    if (!Array.isArray(items)) return null;
    for (const period of items) {
      for (const act of period.activities ?? []) {
        if (typeof act.image === 'string') {
          const uri = resolveWebImage(act.image);
          if (uri) return uri;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * SavedTrips — read-only list of the active profile's trips from SQLite.
 *
 * Local-first (§2.1, §7.2): no token, no network. Trips land here via
 * local creation (7.1) or the one-way web import behind the Import tab
 * (7.4). Only plain-text columns render — same display contract as before.
 */
export default function SavedTrips({ navigation }: { navigation: any }) {
  const [trips, setTrips] = useState<LocalTrip[] | null>(null);
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

  if (trips === null) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
        <Text className="mt-2 text-sm text-muted-foreground">Loading saved trips…</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background px-4 pt-4">
      {error ? <Text className="mb-2 text-sm text-destructive">{error}</Text> : null}
      {trips.length === 0 && !error ? (
        <Text className="text-sm text-muted-foreground">No saved trips yet. Create one or import from the web.</Text>
      ) : null}
      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.title ?? 'untitled trip'}`}
            onPress={() => navigation.navigate('TripDetail', { id: item.id })}
            className="mb-3 flex-row gap-3 rounded-lg border border-border bg-card p-3"
          >
            <Thumb uri={firstImage(item.payload)} size={56} />
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground">{item.title ?? 'Untitled trip'}</Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                {[item.date, item.budget].filter(Boolean).join(' · ') || 'No details'}
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
  );
}
