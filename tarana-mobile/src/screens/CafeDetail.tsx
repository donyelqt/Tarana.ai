import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GradientCTA } from './ui';
import { getActiveProfileId, listMeals, createMeal, deleteMeal, resolveWebImage, toWebMealType, spotMapsUrl } from '../data';
import { formatPHP } from './ui';
import { findCafe, menuDishCount, type Cafe } from '../data/catalog';
import {
  parseSavedItems,
  selectedDishMealType,
  selectedDishTotal,
  snapshotSelection,
  type DishSelection,
  type SavedDish,
} from './savedMeals';
import {
  cafeCoordinates,
  mealCardDishCount,
  mealCardItems,
  mealCardTotal,
  mealCardValidUntil,
  type MealCardItem,
} from './savedMealDetail';
import type { MenuItem } from '../data/catalog/types';

const BLUE = '#0066FF';

const MEAL_TABS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Drinks'] as const;
type MealTab = (typeof MEAL_TABS)[number];

/**
 * CafeDetail — one detail for catalog browsing AND saved records (§8).
 *
 * Keyed by cafe name: catalog info (real vendored data) + "Your saved
 * dishes" for web-imported menu_items + menu tabs where dishes exist
 * (section hidden otherwise — no dead buttons) + Save/Unsave against the
 * active profile. Saved state derives from SQLite, so list and detail
 * never disagree.
 *
 * Web parity: the web detail (`src/app/saved-meals/[id]/page.tsx`) carries
 * two actions this screen was missing — "View on Map" and "show this card to
 * cafe staff" (the MealCardPopup). Both land here, in the platform's idiom:
 * the map action is one system handoff, and the card is a native sheet rather
 * than a web overlay.
 */
export default function CafeDetail({ navigation, route }: { navigation: any; route: { params?: { name?: string } } }) {
  const [cafe, setCafe] = useState<Cafe | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedDishes, setSavedDishes] = useState<SavedDish[]>([]);
  // The opaque `items` snapshot as stored, kept verbatim so the meal card
  // can read quantities that `parseSavedItems` deliberately drops. Both
  // views render from the same column, so they can never disagree.
  const [savedItemsRaw, setSavedItemsRaw] = useState<string | null>(null);
  const [tab, setTab] = useState<MealTab>('Breakfast');
  // Dishes picked for the next save. Empty means "nothing picked", which the
  // save CTA refuses rather than writing an empty meal. A loaded saved row
  // pre-checks the dishes it already holds, so editing an existing meal
  // starts from what is on disk rather than a blank slate.
  const [selected, setSelected] = useState<DishSelection[]>([]);
  // Meal card shown to cafe staff. Only a saved row can open one, so the
  // gating is `savedId` rather than this flag — the flag is the sheet's own
  // open/closed state, nothing more.
  const [cardOpen, setCardOpen] = useState(false);
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
        setSavedDishes(parseSavedItems(saved?.items ?? null));
        setSavedItemsRaw(saved?.items ?? null);
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

  const toggleDish = useCallback((dish: MenuItem) => {
    setSelected((prev) => {
      const exists = prev.some((d) => d.name === dish.name);
      return exists ? prev.filter((d) => d.name !== dish.name) : [...prev, { name: dish.name, price: dish.price, tab }];
    });
  }, [tab]);

  const onSave = async () => {
    if (!cafe) return;
    if (selected.length === 0) {
      setError('Pick at least one dish to save.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const profileId = await getActiveProfileId();
      if (!profileId) throw new Error('Create a profile first.');
      // Web parity (useTaranaEatsService.saveToMeals): the row price is the
      // sum of the picked dishes and the snapshot is the whole selection, so
      // a meal saved here shows every dish on web instead of the first one.
      const items = snapshotSelection(selected);
      const saved = await createMeal({
        profileId,
        cafeName: cafe.name,
        // The tab labels are mobile UI; `meal_type` is the web-visible column.
        // Map through the web union before persisting so a row saved under
        // Snacks or Drinks carries 'Snack' and matches the web filter
        // (src/app/saved-meals/page.tsx:77) instead of silently vanishing
        // there. A multi-tab selection maps its dominant tab, so the row is
        // filed under where the meal actually sits.
        mealType: selectedDishMealType(selected, toWebMealType),
        price: selectedDishTotal(selected),
        goodFor: cafe.popularFor.slice(0, 3),
        location: cafe.location,
        items,
      });
      setSavedId(saved.id);
      setSavedDishes(parseSavedItems(saved.items));
      setSavedItemsRaw(saved.items);
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
      setSavedDishes([]);
      setSavedItemsRaw(null);
      // A card left open on a row that no longer exists would show staff a
      // meal that was just deleted.
      setCardOpen(false);
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
  // Null for the 10 catalogued cafes with no pinned coordinate — the action
  // is then not rendered at all, rather than opening a maps search for a
  // place we cannot name. `spotMapsUrl` returns null if the coords are absent.
  const coords = cafeCoordinates(cafe.name);
  const mapsUrl = coords ? spotMapsUrl(coords.lat, coords.lon) : null;
  // Card rows come from the stored snapshot, which is where the saved dishes
  // live; `savedDishes` above only carries name + price and no quantity.
  const cardItems = mealCardItems(savedItemsRaw);

  return (
    // Fragment, not a wrapper View: the sheet must sit beside the scroll
    // content, not inside it, so it can overlay and not scroll away.
    <>
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

        {savedDishes.length > 0 ? (
          <View style={styles.menu}>
            <Text style={styles.sectionTitle}>Your saved dishes</Text>
            {savedDishes.map((d, i) => (
              <View key={`${d.name}-${i}`} style={styles.dish}>
                <View style={styles.dishText}>
                  <Text style={styles.dishName}>{d.name}</Text>
                </View>
                {d.price != null ? <Text style={styles.dishPrice}>{formatPHP(d.price)}</Text> : null}
              </View>
            ))}
            {mapsUrl ? (
              /* Same system handoff as ActivitySheet's Location action — one
                 Linking.openURL on the shared Google-Maps URL, no map SDK and
                 no webview, exactly as the existing pattern does it. */
              <TouchableOpacity
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Open ${cafe.name} in Maps`}
                onPress={() => Linking.openURL(mapsUrl)}
                style={styles.mapsBtn}
              >
                <Text style={styles.mapsText}>Open in Maps</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Show the meal card to cafe staff"
              onPress={() => setCardOpen(true)}
              style={styles.cardBtn}
            >
              <Text style={styles.cardText}>Show this card to cafe staff</Text>
            </TouchableOpacity>
          </View>
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
              dishes.map((d, i) => {
                const picked = selected.some((s) => s.name === d.name);
                return (
                  <TouchableOpacity
                    key={`${d.name}-${i}`}
                    style={[styles.dish, picked && styles.dishPicked]}
                    activeOpacity={0.85}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: picked }}
                    accessibilityLabel={`${d.name}, ${formatPHP(d.price)}`}
                    onPress={() => toggleDish(d)}
                  >
                    <View style={[styles.checkbox, picked && styles.checkboxPicked]}>
                      {picked ? <Text style={styles.checkboxTick}>✓</Text> : null}
                    </View>
                    <View style={styles.dishText}>
                      <Text style={styles.dishName}>{d.name}</Text>
                      {d.description && d.description !== 'No description available — yet.' ? (
                        <Text style={styles.dishDesc} numberOfLines={2}>{d.description}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.dishPrice}>{formatPHP(d.price)}</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        ) : null}

        {selected.length > 0 ? (
          <Text style={styles.selectionTotal}>
            {selected.length} {selected.length === 1 ? 'dish' : 'dishes'} · {formatPHP(selectedDishTotal(selected))}
          </Text>
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
            title={selected.length > 0 ? `Save ${selected.length} ${selected.length === 1 ? 'dish' : 'dishes'}` : 'Save cafe'}
            loadingTitle="Saving…"
            loading={busy}
            onPress={onSave}
            accessibilityLabel="Save selected dishes"
          />
        )}
        <StatusBar style="auto" />
      </ScrollView>

      <MealCard
        visible={cardOpen}
        restaurantName={cafe.name}
        restaurantLocation={cafe.location}
        items={cardItems}
        onClose={() => setCardOpen(false)}
      />
    </>
  );
}

/**
 * MealCard — native sheet for the card shown to cafe staff.
 *
 * Web parity: `src/app/saved-meals/components/MealCardPopup.tsx` renders the
 * blue header ("Tarana Eats" + "Show this card to cafe staff for
 * confirmation."), the cafe name and location, one row per dish with
 * "₱price x quantity" beside a blue line total, and a footer with
 * "Selected Items (n)", "Total: ₱N" and the valid-until date. The web card
 * also closes on "Mark as Used" — that writes nothing on mobile (no server
 * call behind it) and the row stays saved, so the sheet simply closes; the
 * action would be a lie without a write.
 *
 * Sheet grammar copied from ActivitySheet: transparent backdrop, slide-up
 * animation, drag handle, and a dismiss target covering the whole backdrop,
 * so a tap anywhere outside closes. Same primitives, same look.
 */
function MealCard({
  visible,
  restaurantName,
  restaurantLocation,
  items,
  onClose,
}: {
  visible: boolean;
  restaurantName: string;
  restaurantLocation: string;
  items: MealCardItem[];
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.dismiss}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel="Close meal card"
          onPress={onClose}
        />
        <View style={styles.card}>
          {/* ActivitySheet's drag handle, so this sheet announces itself as
              the same kind of surface. It sits on white above the blue
              header, which is what makes the sheet read as a sheet. */}
          <View style={styles.cardHandleHit}>
            <View style={styles.cardHandle} />
          </View>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardBrand}>Tarana Eats</Text>
              <Text style={styles.cardBrandSub}>Show this card to cafe staff for confirmation.</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close meal card"
              onPress={onClose}
              style={styles.cardCloseHit}
            >
              <Text style={styles.cardClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.cardCafe}>{restaurantName}</Text>
            <Text style={styles.cardLocation}>{restaurantLocation}</Text>

            {items.length === 0 ? (
              <Text style={styles.cardEmpty}>No dishes saved on this meal yet.</Text>
            ) : (
              items.map((item, i) => (
                <View key={`${item.name}-${i}`} style={styles.cardRow}>
                  <View style={styles.cardRowText}>
                    <Text style={styles.cardDishName}>{item.name}</Text>
                    <Text style={styles.cardDishMeta}>
                      {formatPHP(item.price) ?? '—'} x {item.quantity}
                    </Text>
                  </View>
                  <Text style={styles.cardLineTotal}>{formatPHP(item.lineTotal) ?? '—'}</Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.cardFooterRow}>
              <Text style={styles.cardFooterTotal}>
                Selected Items ({mealCardDishCount(items)}) · Total: {formatPHP(mealCardTotal(items)) ?? '₱0'}
              </Text>
              <Text style={styles.cardFooterValid}>Valid until {mealCardValidUntil()}</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
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
  dishPicked: { borderColor: BLUE, borderWidth: 1, backgroundColor: '#eff6ff' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxPicked: { borderColor: BLUE, backgroundColor: BLUE },
  checkboxTick: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  selectionTotal: { marginTop: 10, fontSize: 14, fontWeight: '600', color: '#374151', fontVariant: ['tabular-nums'] },
  unsaveBtn: { marginTop: 8, borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', paddingVertical: 14, alignItems: 'center' },
  unsaveArmed: { backgroundColor: '#fef2f2', borderColor: '#dc2626' },
  unsaveText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  // "Open in Maps" — the one red-bordered action, same treatment as
  // ActivitySheet's Location button so the two are recognizable as siblings.
  mapsBtn: {
    marginTop: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  mapsText: { color: BLUE, fontSize: 15, fontWeight: '600' },
  // Meal-card action — the blue filled CTA, one step below the primary
  // save CTA in weight so the two are never confused for each other.
  cardBtn: {
    marginTop: 4,
    borderRadius: 16,
    backgroundColor: BLUE,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cardText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  // Meal card sheet — ActivitySheet's backdrop/handle grammar with this
  // sheet's own inner card (blue header, dish rows, totals footer).
  backdrop: { flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.4)', justifyContent: 'flex-end' },
  dismiss: { flex: 1 },
  card: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
    maxHeight: '85%',
  },
  cardHandleHit: { alignItems: 'center', paddingVertical: 8 },
  cardHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb' },
  cardHeader: {
    backgroundColor: BLUE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardHeaderText: { flex: 1, gap: 2 },
  cardBrand: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  cardBrandSub: { color: 'rgba(255, 255, 255, 0.9)', fontSize: 13 },
  cardCloseHit: { padding: 4 },
  cardClose: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  cardBody: { paddingHorizontal: 16, paddingTop: 16, gap: 8 },
  cardCafe: { fontSize: 22, fontWeight: '700', color: '#111827' },
  cardLocation: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  cardEmpty: { fontSize: 13, color: '#6b7280' },
  // One row per dish, matching the detail's own dish row (white card, 12
  // radius, 12 pad) so the sheet reads as the same surface, not a new one.
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
  },
  cardRowText: { flex: 1, gap: 2 },
  cardDishName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  cardDishMeta: { fontSize: 13, color: '#6b7280', fontVariant: ['tabular-nums'] },
  cardLineTotal: { fontSize: 18, fontWeight: '700', color: BLUE, fontVariant: ['tabular-nums'] },
  cardFooter: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 4,
  },
  cardFooterRow: { gap: 2 },
  cardFooterTotal: { fontSize: 14, fontWeight: '700', color: '#111827', fontVariant: ['tabular-nums'] },
  cardFooterValid: { fontSize: 13, color: '#6b7280' },
});
