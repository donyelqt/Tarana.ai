import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getActiveProfileId, listMeals, type LocalMeal } from '../data';
import { formatPHP, GRADIENT } from './ui';
import { ChevronLeftIcon } from './icons';

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

  const countText = meals.length === 1 ? '1 cafe saved' : `${meals.length} cafes saved`;

  return (
    // Top inset only (Home precedent): content clears the notch /
    // punch-hole camera and status bar.
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F2F2F7' }} edges={['top']}>
    <View style={{ flex: 1, backgroundColor: '#F2F2F7' }} className="px-4 pt-4">
      <View style={styles.band}>
        <LinearGradient
          colors={[GRADIENT.auth.pressedFrom, GRADIENT.auth.from]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.bandBody}
        >
          <View style={styles.titleRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => navigation.goBack()}
            >
              <ChevronLeftIcon size={22} color="#ffffff" />
            </TouchableOpacity>
            <View style={styles.titleText}>
              <Text style={styles.bandTitle}>Saved cafes</Text>
              <Text style={styles.bandSub}>{countText}</Text>
            </View>
          </View>
          <TextInput
            className="rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground"
            placeholder="Search saved cafes…"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            placeholderTextColor="#9ca3af"
            accessibilityLabel="Search saved cafes"
          />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  band: { marginHorizontal: -16 },
  bandBody: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 46, gap: 14 },
  wave: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 30 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  titleText: { flex: 1, gap: 2 },
  bandTitle: { fontSize: 22, fontWeight: '700', color: '#ffffff', lineHeight: 28 },
  bandSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
});
