import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { findCafe } from '../data/catalog';
import { getActiveProfileId, listMeals, spotMapsUrl, type LocalMeal } from '../data';
import { cafeCoordinates, mealCardDishCount, mealCardItems, mealCardTotal, mealCardValidUntil, type MealCardItem } from './savedMealDetail';
import { MapPinIcon } from './icons';
import { formatPHP } from './ui';

const BLUE = '#0066FF';

/**
 * SavedMealScreen — one saved meal, read-only (§8).
 *
 * (Named `SavedMealScreen` rather than `SavedMealDetail`: `savedMealDetail.ts`
 * is the pure helper module next to it, and on a case-insensitive filesystem
 * the two names would collide.)
 *
 * Web parity: `src/app/saved-meals/[id]/page.tsx` shows the saved row (cafe,
 * meal type, price, location, good-for) with the dish snapshot on it, a
 * "View on Map" action, and the staff card. SavedCafes rows push HERE now
 * rather than CafeDetail: a saved row is a RECORD the user keeps, not a
 * catalog entry to re-pick from, so the screen's job is to say what was
 * saved and let the user act on it — re-picking is CafeDetail's job.
 *
 * What is deliberately absent, because writing it would be a lie:
 * "Mark as Used" exists on web but is a toast that persists nothing (no
 * PATCH in mealService.ts, no is_used column in saved_meals), so this
 * screen offers no such control.
 *
 * Maps differs from web on purpose: web geocodes the prose `location`
 * string, mobile has no address service, so it resolves the cafe NAME
 * against the shared Baguio database (see savedMealDetail.ts:76-79) and
 * hides the action entirely when no pinned coordinate exists.
 */
export default function SavedMealDetail({
  route,
}: {
  route: { params?: { id?: string } };
}) {
  const id = route?.params?.id ?? '';
  const [meal, setMeal] = useState<LocalMeal | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const profileId = await getActiveProfileId();
      if (!profileId) throw new Error('Create a profile first to view saved meals.');
      const rows = await listMeals(profileId);
      // No by-id read exists; the established pattern is filtering the
      // profile's list (CafeDetail.tsx:78, SavedCafes.tsx:48).
      setMeal(rows.find((m) => m.id === id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load this meal.');
    } finally {
      setLoaded(true);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!loaded) {
    return (
      <View style={styles.center}>
        <StatusBar style="auto" />
        <ActivityIndicator color={BLUE} />
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <StatusBar style="auto" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!meal) {
    return (
      <View style={styles.center}>
        <StatusBar style="auto" />
        <Text style={styles.errorText}>This saved meal is no longer available.</Text>
      </View>
    );
  }

  const items: MealCardItem[] = mealCardItems(meal.items);
  const cafe = findCafe(meal.cafe_name);
  const coords = cafeCoordinates(cafe);
  const mapsUrl = coords ? spotMapsUrl(coords.lat, coords.lon) : null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <StatusBar style="auto" />
      {cafe ? <Text style={styles.eyebrow}>{cafe.cuisine}</Text> : null}
      <Text style={styles.title}>{meal.cafe_name}</Text>

      <Text style={styles.meta}>
        {[meal.meal_type, formatPHP(meal.price)].filter(Boolean).join(' · ') || 'Saved'}
      </Text>

      <TouchableOpacity
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`View ${meal.cafe_name} on the map`}
        onPress={() => {
          if (mapsUrl) void Linking.openURL(mapsUrl);
        }}
        style={styles.mapBtn}
      >
        <View style={styles.mapRow}>
          <MapPinIcon size={18} color={BLUE} />
          {meal.location ? <Text style={styles.mapText}>{meal.location}</Text> : null}
        </View>
      </TouchableOpacity>

      {meal.good_for.length > 0 ? (
        <Text style={styles.goodFor}>Good for {meal.good_for.join(' · ')}</Text>
      ) : null}

      {items.length > 0 ? (
        <View style={styles.card}>
          {items.map((item, i) => (
            <View key={`${item.name}-${i}`} style={styles.cardRow}>
              <View style={styles.cardRowText}>
                <Text style={styles.cardDishName}>{item.name}</Text>
                <Text style={styles.cardDishMeta}>
                  {formatPHP(item.price) ?? '—'} x {item.quantity}
                </Text>
              </View>
              <Text style={styles.cardLineTotal}>{formatPHP(item.lineTotal) ?? '—'}</Text>
            </View>
          ))}
          <Text style={styles.cardTotal}>
            Selected Items ({mealCardDishCount(items)}) · Total: {formatPHP(mealCardTotal(items)) ?? '₱0'}
          </Text>
          <Text style={styles.cardValid}>Valid until {mealCardValidUntil()}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { paddingHorizontal: 24, paddingVertical: 24, gap: 8 },
  center: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  muted: { fontSize: 13, color: '#6b7280' },
  errorText: { fontSize: 14, color: '#dc2626', textAlign: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', color: BLUE },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', lineHeight: 30 },
  meta: { fontSize: 13, color: '#6b7280' },
  mapBtn: { marginTop: 4, borderRadius: 12, backgroundColor: '#ffffff', padding: 12 },
  mapRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mapText: { flex: 1, fontSize: 13, color: '#374151' },
  goodFor: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    gap: 8,
    marginTop: 8,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cardRowText: { flex: 1, gap: 2 },
  cardDishName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  cardDishMeta: { fontSize: 13, color: '#6b7280', fontVariant: ['tabular-nums'] },
  cardLineTotal: { fontSize: 16, fontWeight: '700', color: BLUE, fontVariant: ['tabular-nums'] },
  cardTotal: { fontSize: 14, fontWeight: '700', color: '#111827', fontVariant: ['tabular-nums'], marginTop: 4 },
  cardValid: { fontSize: 13, color: '#6b7280' },
});
