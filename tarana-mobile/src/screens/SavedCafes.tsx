import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getActiveProfileId, listMeals, exportLocalMeals, type ExportSummary, type LocalMeal } from '../data';
import {
  ALL_FILTER,
  BUDGET_OPTIONS,
  CUISINE_FILTER_OPTIONS,
  MEAL_TYPE_OPTIONS,
  filterSavedMeals,
  type FilterOption,
} from './savedMeals';
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
  // Meal type, budget, cuisine — the web list's three other selects
  // (src/app/saved-meals/page.tsx:132-165). Held as plain strings so the
  // predicates in ./savedMeals own the vocabulary, not the screen.
  const [mealType, setMealType] = useState<string>(ALL_FILTER);
  const [budget, setBudget] = useState<string>(ALL_FILTER);
  const [cuisine, setCuisine] = useState<string>(ALL_FILTER);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportSummary, setExportSummary] = useState<ExportSummary | null>(null);

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

  /**
   * Two-way sync's export direction. The screen never touches `fetch` — it
   * calls the seam, which owns the idempotency key, the per-meal failure
   * collection, and the no-delete conflict rule.
   *
   * Only a failure the seam attributes to the whole run (an unusable profile,
   * no linked token) reaches the error line; per-meal reasons arrive inside
   * `exportSummary` and are rendered as the failure list, so one bad meal
   * never masquerades as a broken export.
   */
  const runExport = useCallback(async () => {
    setExporting(true);
    setError(null);
    setExportSummary(null);
    try {
      const profileId = await getActiveProfileId();
      if (!profileId) {
        setError('Create a profile first to export cafes.');
        return;
      }
      setExportSummary(await exportLocalMeals(profileId));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export did not complete.');
    } finally {
      setExporting(false);
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

  const visible = filterSavedMeals(meals ?? [], { query, mealType, budget, cuisine });
  // "No meals match your filters" ≠ "you have no saved meals". With filters
  // active and rows failing them, the rows are still on the device — the copy
  // must say the filter is the reason, or the user reads it as data loss and
  // goes looking for the meals. Only with everything off does an empty list
  // mean an empty list.
  const filtersActive = query.trim() !== '' || mealType !== ALL_FILTER || budget !== ALL_FILTER || cuisine !== ALL_FILTER;
  const emptyTitle = filtersActive && visible.length === 0 ? 'No meals match' : 'No saved cafes yet';
  const emptyBody =
    filtersActive && visible.length === 0
      ? 'Try a different meal type, budget, or cuisine.'
      : 'Browse Baguio cafes and save the ones you love.';

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
          {/* Meal type, budget, cuisine — the web list's three selects,
              recomposed as pill rows so they sit under the search inside the
              gradient band without redesigning the screen. Same vocabulary
              and band edges as web (src/app/saved-meals/page.tsx:132-165);
              the options come from ./savedMeals, not from this screen. */}
          <View style={styles.filters}>
            <FilterRow label="Meal type" options={MEAL_TYPE_OPTIONS} selected={mealType} onSelect={setMealType} />
            <FilterRow label="Budget" options={BUDGET_OPTIONS} selected={budget} onSelect={setBudget} />
            <FilterRow label="Cuisine" options={CUISINE_FILTER_OPTIONS} selected={cuisine} onSelect={setCuisine} />
          </View>
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
          <Text className="text-base font-semibold text-foreground">{emptyTitle}</Text>
          <Text className="mt-1 text-center text-sm text-muted-foreground">{emptyBody}</Text>
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
        // Progress + summary live below the list, matching the card/row
        // language above rather than introducing a modal. Nothing is hidden
        // behind a tap: the counts the seam returns are the whole report.
        // (A `//` comment, not `{/* */}`: this sits inside FlatList's
        // attribute list, where only line comments are legal.)
        ListFooterComponent={
          <View style={styles.exportFooter}>
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={exporting}
              accessibilityRole="button"
              accessibilityLabel="Export cafes to the web"
              onPress={() => void runExport()}
            >
              {/* Gradient while idle, web `disabled:bg-gray-300` while running. */}
              <LinearGradient
                colors={exporting ? [GRADIENT.disabled.from, GRADIENT.disabled.to] : [GRADIENT.app.from, GRADIENT.app.to]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.exportGradient}
              >
                {/* The label never disappears: a spinner with no text reads as
                    a frozen UI, and the action must stay readable mid-run. */}
                <Text style={styles.exportButtonText}>{exporting ? 'Exporting…' : 'Export to web'}</Text>
                {exporting ? <ActivityIndicator size="small" color="#ffffff" style={styles.exportSpinner} /> : null}
              </LinearGradient>
            </TouchableOpacity>

            {exporting ? (
              <Text className="mt-2 text-xs text-muted-foreground">Uploading local cafes…</Text>
            ) : null}

            {exportSummary ? (
              <View className="mt-2 gap-1">
                <Text className="text-xs text-muted-foreground">
                  {exportSummary.exported} exported · {exportSummary.skipped} skipped ·{' '}
                  {exportSummary.failures.length} failed
                </Text>
                {exportSummary.failures.map((reason) => (
                  <Text key={reason} className="text-xs text-destructive">
                    {reason}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        }
      />
      <StatusBar style="auto" />
    </View>
    </SafeAreaView>
  );
}

/**
 * One compact filter row: label + horizontally scrolling pills.
 *
 * Pure StyleSheet (no className) and the active pill takes the app gradient,
 * matching SpotCityPills' language — same pill, same state treatment, so this
 * reads as the screen's existing control rather than a new one. `all` is the
 * first pill of every row and is a normal reset, not a special case.
 *
 * The lane is a horizontal ScrollView inside the gradient band. It carves its
 * own height (`flexGrow: 0`) rather than borrowing the band's: a vertical
 * flex parent that is not bounded would otherwise let the pills inherit the
 * leftover space — the giant-pills bug SpotCityPills calls out. Pills never
 * shrink to fit; the lane scrolls, which is how the cuisine row (16 options
 * from the catalog) stays readable on a narrow phone.
 */
function FilterRow({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: FilterOption[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.filterRow}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterPills}
        style={styles.filterPillsWrap}
      >
        {options.map((option) => {
          const active = option.value === selected;
          const text = (
            <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
              {option.label}
            </Text>
          );
          return (
            <TouchableOpacity
              key={option.value}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${option.label} ${label}`}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              onPress={() => onSelect(option.value)}
            >
              {active ? (
                <LinearGradient
                  colors={[GRADIENT.app.from, GRADIENT.app.to]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.filterPillActive}
                >
                  {text}
                </LinearGradient>
              ) : (
                <View style={styles.filterPill}>{text}</View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
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
  exportFooter: { paddingVertical: 12, gap: 4 },
  exportGradient: {
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  exportButtonText: { fontSize: 16, fontWeight: '600', color: '#ffffff', textAlign: 'center' },
  exportSpinner: { marginLeft: 2 },
  filters: { gap: 8 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.75)', width: 56 },
  filterPillsWrap: { flexGrow: 0, flexShrink: 1 },
  filterPills: { flexDirection: 'row', gap: 6, paddingRight: 12 },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  filterPillActive: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
  },
  filterPillText: { color: '#ffffff', fontSize: 12, fontWeight: '500' },
  filterPillTextActive: { color: '#0066FF' },
});
