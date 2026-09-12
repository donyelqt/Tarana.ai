import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GradientCTA } from './ui';
import { getActiveProfileId, listMeals, createMeal, deleteMeal, resolveWebImage } from '../data';
import { formatPHP } from './ui';
import Thumb from './Thumb';
import { findCafe, menuDishCount, type Cafe, type FullMenu } from '../data/catalog';
import type { MenuItem } from '../data/catalog/types';

const BLUE = '#0066FF';

const MEAL_TABS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Drinks'] as const;
type MealTab = (typeof MEAL_TABS)[number];

/**
 * CafeDetail — one detail for catalog browsing AND saved records (§8).
 *
 * Keyed by cafe name: catalog info (real vendored data) + menu tabs where
 * dishes exist (section hidden otherwise — no dead buttons) + Save/Unsave
 * against the active profile. Saved state derives from SQLite, so list
 * and detail never disagree.
 */
export default function CafeDetail({ navigation, route }: { navigation: any; route: { params?: { name?: string } } }) {
  const [cafe, setCafe] = useState<Cafe | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [tab, setTab] = useState<MealTab>('Breakfast');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [arming, setArming] = useState(false);

  const name = route?.params?.name ?? '';

  const load = useCallback(async () => {
    try {
      if (!name) throw new Error('Cafe not found.');
      const found = findCafe(name);
      if (!found) throw new Error('Cafe not found.');
      setCafe(found);
      const profileId = await getActiveProfileId();
      if (profileId) {
        const saved = (await listMeals(profileId)).find((m) => m.cafe_name === found.name) ?? null;
        setSavedId(saved ? saved.id : null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cafe.');
    } finally {
      setLoaded(true);
    }
  }, [name]);

  useEffect(() => {
    load();
  }, [load]);

  const onSave = async () => {
    if (!cafe) return;
    setBusy(true);
    setError(null);
    try {
      const profileId = await getActiveProfileId();
      if (!profileId) throw new Error('Create a profile first.');
      const first = firstDish(cafe.fullMenu);
      const saved = await createMeal({
        profileId,
        cafeName: cafe.name,
        mealType: first ? tab : null,
        price: first ? first.price : null,
        goodFor: cafe.popularFor.slice(0, 3),
        location: cafe.location,
      });
      setSavedId(saved.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save cafe.');
    } finally {
      setBusy(false);
    }
  };

  const onUnsave = async () => {
    if (!savedId) return;
    if (!arming) {
      setArming(true);
      return;
    }
    setBusy(true);
    try {
      const profileId = await getActiveProfileId();
      if (profileId) await deleteMeal(savedId, profileId);
      setSavedId(null);
      setArming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove cafe.');
      setArming(false);
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={BLUE} />
        <Text style={styles.muted}>Loading…</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  if (error || !cafe) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Cafe not found.'}</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  const dishes: MenuItem[] = cafe.fullMenu[tab] ?? [];
  const dishCount = menuDishCount(cafe.fullMenu);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>{cafe.cuisine.join(' · ')}</Text>
      <Text style={styles.title}>{cafe.name}</Text>
      <CafeHero uri={resolveWebImage(cafe.image)} name={cafe.name} />
      <Text style={styles.price}>
        {formatPHP(cafe.priceRange.min)} – {formatPHP(cafe.priceRange.max)}
      </Text>
      <Text style={styles.meta}>{cafe.location}{cafe.hours ? ` · ${cafe.hours}` : ''}</Text>
      <Text style={styles.about}>{cafe.about}</Text>
      {cafe.popularFor.length > 0 ? (
        <Text style={styles.tags}>Known for: {cafe.popularFor.join(', ')}</Text>
      ) : null}

      {cafe.hasMenu && dishCount > 0 ? (
        <View style={styles.menu}>
          <Text style={styles.sectionTitle}>Menu</Text>
          <View style={styles.tabs}>
            {MEAL_TABS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tab, tab === t && styles.tabActive]}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: tab === t }}
                accessibilityLabel={`${t} menu`}
                onPress={() => setTab(t)}
              >
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {dishes.length === 0 ? (
            <Text style={styles.muted}>Nothing listed under {tab}.</Text>
          ) : (
            dishes.map((d, i) => (
              <View key={`${d.name}-${i}`} style={styles.dish}>
                <View style={styles.dishText}>
                  <Text style={styles.dishName}>{d.name}</Text>
                  {d.description && d.description !== 'No description available — yet.' ? (
                    <Text style={styles.dishDesc} numberOfLines={2}>{d.description}</Text>
                  ) : null}
                </View>
                <Text style={styles.dishPrice}>{formatPHP(d.price)}</Text>
              </View>
            ))
          )}
        </View>
      ) : null}

      {savedId ? (
        <TouchableOpacity
          style={[styles.unsaveBtn, arming && styles.unsaveArmed]}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={arming ? 'Confirm remove cafe' : 'Remove saved cafe'}
          onPress={onUnsave}
          disabled={busy}
        >
            <Text style={styles.unsaveText}>
              {busy ? 'Removing…' : arming ? 'Tap again to remove' : 'Saved — tap to remove'}
            </Text>
        </TouchableOpacity>
      ) : (
        <GradientCTA
          variant="app"
          title="Save cafe"
          loadingTitle="Saving…"
          loading={busy}
          onPress={onSave}
          accessibilityLabel="Save cafe"
        />
      )}
      <StatusBar style="auto" />
    </ScrollView>
  );
}

function firstDish(menu: FullMenu): MenuItem | null {
  for (const t of MEAL_TABS) {
    const dish = menu[t]?.[0];
    if (dish) return dish;
  }
  return null;
}

/**
 * Full-width hero for the 3 cafes with real photos. Null uri (17 cafes)
 * or any load failure (offline included) renders nothing — the detail
 * below stands on its own.
 */
function CafeHero({ uri, name }: { uri: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) return null;
  return (
    <View style={styles.heroWrap}>
      <Image
        source={{ uri }}
        style={styles.hero}
        onError={() => setFailed(true)}
        accessibilityLabel={`${name} photo`}
        accessibilityRole="image"
      />
    </View>
  );
}

const styles = StyleSheet.create({  root: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { paddingHorizontal: 24, paddingVertical: 24, gap: 8 },
  center: { flex: 1, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  muted: { fontSize: 13, color: '#6b7280' },
  errorText: { fontSize: 14, color: '#dc2626', textAlign: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', color: BLUE },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', lineHeight: 30 },
  heroWrap: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#ffffff', marginTop: 8 },
  hero: { width: '100%', height: 180 },
  price: { fontSize: 20, fontWeight: '700', color: BLUE, fontVariant: ['tabular-nums'] },
  meta: { fontSize: 13, color: '#6b7280' },
  about: { fontSize: 14, color: '#374151', lineHeight: 20 },
  tags: { fontSize: 12, color: '#6b7280' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginTop: 8 },
  menu: { gap: 8, marginTop: 4 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#dbeafe' },
  tabActive: { backgroundColor: BLUE, borderColor: BLUE },
  tabText: { color: BLUE, fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: '#ffffff' },
  dish: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, backgroundColor: '#ffffff', borderRadius: 12, padding: 12 },
  dishText: { flex: 1, gap: 2 },
  dishName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  dishDesc: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
  dishPrice: { fontSize: 15, fontWeight: '700', color: BLUE, fontVariant: ['tabular-nums'] },
  unsaveBtn: { marginTop: 8, borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', paddingVertical: 14, alignItems: 'center' },
  unsaveArmed: { backgroundColor: '#fef2f2', borderColor: '#dc2626' },
  unsaveText: { color: '#374151', fontSize: 15, fontWeight: '600' },
});
