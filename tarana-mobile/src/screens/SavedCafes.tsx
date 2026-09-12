import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { getActiveProfileId, listMeals, type LocalMeal } from '../data';
import { formatPHP } from './ui';

/**
 * SavedCafes — the active profile's saved meals from SQLite (§8).
 *
 * Web list skeleton recomposed native: header + search + rows
 * (name, price, location, View). No credits, no tiers, no invites.
 * Empty state points at Eats (built §8 order).
 */
export default function SavedCafes({ navigation }: { navigation: any }) {
  const [meals, setMeals] = useState<LocalMeal[] | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const profileId = await getActiveProfileId();
      if (!profileId) {
        setError('Create a profile first to see saved cafes.');
        setMeals([]);
        return;
      }
      setMeals(await listMeals(profileId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load saved cafes.');
      setMeals([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const q = query.trim().toLowerCase();
  const visible = (meals ?? []).filter(
    (m) => !q || m.cafe_name.toLowerCase().includes(q) || (m.meal_type ?? '').toLowerCase().includes(q)
  );

  if (meals === null) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F2F2F7' }} className="items-center justify-center">
        <ActivityIndicator />
        <Text className="mt-2 text-sm text-muted-foreground">Loading saved cafes…</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F7' }} className="px-4 pt-4">
      <TextInput
        className="mb-3 rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground"
        placeholder="Search saved cafes…"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        placeholderTextColor="#9ca3af"
        accessibilityLabel="Search saved cafes"
      />
      {error ? <Text className="mb-2 text-sm text-destructive">{error}</Text> : null}
      {visible.length === 0 && !error ? (
        <View className="items-center px-6 pt-10">
          <Text className="text-base font-semibold text-foreground">No saved cafes yet</Text>
          <Text className="mt-1 text-center text-sm text-muted-foreground">
            Browse Baguio cafes and save the ones you love.
          </Text>
          <TouchableOpacity
            className="mt-4 rounded-full bg-primary px-6 py-3"
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Browse cafes"
            onPress={() => navigation.navigate('Eats')}
          >
            <Text className="text-sm font-semibold text-white">Browse cafes</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.cafe_name}`}
            onPress={() => navigation.navigate('CafeDetail', { name: item.cafe_name })}
            className="mb-3 rounded-lg bg-card p-3"
          >
            <Text className="text-base font-semibold text-foreground">{item.cafe_name}</Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              {[item.meal_type, item.price != null ? formatPHP(item.price) : null].filter(Boolean).join(' · ') || 'Saved'}
            </Text>
            {item.location ? (
              <Text className="mt-1 text-xs text-muted-foreground">{item.location}</Text>
            ) : null}
          </TouchableOpacity>
        )}
      />
      <StatusBar style="auto" />
    </View>
  );
}
