import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { createMobileSupabaseClient } from '../supabase';
import { loadAuthState } from '../auth';

/**
 * SavedTrips — read-only list of the user's saved itineraries.
 *
 * Mirrors the web query in `src/lib/data/savedItineraries.ts`
 * (`itineraries` table, scoped to user_id, newest first) but does NOT
 * import that module: it value-imports `next/image` (StaticImageData) plus
 * web-only services, so it is Metro-blocked per the probe. The query shape
 * is re-expressed here against the shared anon Supabase factory, and only
 * plain-text columns are displayed (no image catalog imports).
 */
type SavedTripRow = {
  id: string;
  title: string | null;
  date: string | null;
  budget: string | null;
  tags: string[] | null;
  created_at: string;
};

export default function SavedTrips() {
  const [trips, setTrips] = useState<SavedTripRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { payload } = await loadAuthState();
      const userId = payload?.id ?? payload?.sub;
      if (!userId) {
        setError('Sign in first to see saved trips.');
        setTrips([]);
        return;
      }
      const client = await createMobileSupabaseClient();
      const { data, error: qError } = await client
        .from('itineraries')
        .select('id,title,date,budget,tags,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (qError) throw new Error(qError.message);
      setTrips((data ?? []) as SavedTripRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load saved trips.');
      setTrips([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
        <Text className="text-sm text-muted-foreground">No saved trips yet. Plan one on the web app.</Text>
      ) : null}
      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="mb-3 rounded-lg border border-border bg-card p-3">
            <Text className="text-base font-semibold text-foreground">{item.title ?? 'Untitled trip'}</Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              {[item.date, item.budget].filter(Boolean).join(' · ') || 'No details'}
            </Text>
            {item.tags && item.tags.length > 0 ? (
              <Text className="mt-1 text-xs text-muted-foreground">{item.tags.join(', ')}</Text>
            ) : null}
          </View>
        )}
      />
      <StatusBar style="auto" />
    </View>
  );
}
