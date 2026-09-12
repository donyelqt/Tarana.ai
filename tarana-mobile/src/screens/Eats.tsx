import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { formatPHP, GradientCTA } from './ui';
import { CAFES, suggestCafes, type Cafe } from '../data/catalog';
import { resolveWebImage } from '../data';
import Thumb from './Thumb';

const BLUE = '#0066FF';

/**
 * Eats — browse Baguio cafes + local suggestions (§8).
 *
 * Web form skeleton recomposed native: budget → cuisine → pax → dietary →
 * CTA → match cards → detail. Two deliberate divergences, both documented:
 * 1. No meal-type filter yet — it is only meaningful with full dish lists
 *    (6 of 20 cafes vendored); it arrives with the full catalog, not as a
 *    half-working filter.
 * 2. Suggestions run on-device (`suggestCafes`: budget ceiling + cuisine +
 *    diet) instead of the 401-gated AI POST. Real filtering, no network.
 * Save lives in CafeDetail (single save path, no duplicates).
 */
const CUISINES = [...new Set(CAFES.flatMap((c) => c.cuisine))].sort();
const DIETS = [...new Set(CAFES.flatMap((c) => c.dietaryOptions))].sort();

export default function Eats({ navigation }: { navigation: any }) {
  const [budget, setBudget] = useState('');
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [pax, setPax] = useState(2);
  const [diets, setDiets] = useState<string[]>([]);
  const [ran, setRan] = useState(false);

  const maxBudget = useMemo(() => {
    const n = parseInt(budget.replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [budget]);

  const results: Cafe[] = useMemo(() => {
    if (!ran) return [];
    return suggestCafes({ maxBudget, cuisine, dietary: diets, limit: 12 });
  }, [ran, maxBudget, cuisine, diets]);

  const toggleDiet = (d: string) => {
    setDiets((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Find your next meal</Text>

      <Text style={styles.label}>Max budget per person (₱)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 250"
        value={budget}
        onChangeText={(t) => {
          setBudget(t);
          setRan(false);
        }}
        keyboardType="number-pad"
        returnKeyType="done"
        placeholderTextColor="#9ca3af"
        accessibilityLabel="Max budget per person in pesos"
      />

      <Text style={styles.label}>Cuisine</Text>
      <View style={styles.pills}>
        {CUISINES.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.pill, cuisine === c && styles.pillActive]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: cuisine === c }}
            accessibilityLabel={`Cuisine ${c}`}
            onPress={() => {
              setCuisine((prev) => (prev === c ? null : c));
              setRan(false);
            }}
          >
            <Text style={[styles.pillText, cuisine === c && styles.pillTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>People</Text>
      <View style={styles.stepper}>
        <TouchableOpacity
          style={styles.stepBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Fewer people"
          onPress={() => setPax((p) => Math.max(1, p - 1))}
        >
          <Text style={styles.stepText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.pax}>{pax}</Text>
        <TouchableOpacity
          style={styles.stepBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="More people"
          onPress={() => setPax((p) => Math.min(20, p + 1))}
        >
          <Text style={styles.stepText}>+</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Dietary</Text>
      <View style={styles.pills}>
        {DIETS.map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.pill, diets.includes(d) && styles.pillActive]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: diets.includes(d) }}
            accessibilityLabel={`Dietary ${d}`}
            onPress={() => {
              toggleDiet(d);
              setRan(false);
            }}
          >
            <Text style={[styles.pillText, diets.includes(d) && styles.pillTextActive]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <GradientCTA
        variant="app"
        title="Find cafes"
        onPress={() => setRan(true)}
        accessibilityLabel="Find cafes"
      />

      {ran ? (
        <View style={styles.results}>
          <Text style={styles.resultsTitle}>
            {results.length === 0 ? 'No matches' : `${results.length} match${results.length === 1 ? '' : 'es'}`}
          </Text>
          {results.length === 0 ? (
            <Text style={styles.muted}>Loosen the budget or clear a filter and try again.</Text>
          ) : (
            results.map((c) => (
              <TouchableOpacity
                key={c.name}
                style={[styles.card, styles.cardRow]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Open ${c.name}`}
                onPress={() => navigation.navigate('CafeDetail', { name: c.name })}
              >
                <Thumb uri={resolveWebImage(c.image)} size={64} />
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>{c.name}</Text>
                  <Text style={styles.cardMeta}>
                    {c.cuisine.join(' · ')}
                  </Text>
                  <Text style={styles.cardPrice}>
                    {formatPHP(c.priceRange.min)}–{formatPHP(c.priceRange.max)}
                    {pax > 1 ? (
                      <Text style={styles.cardEach}> · ≈{formatPHP(c.priceRange.min * pax)} for {pax}</Text>
                    ) : null}
                  </Text>
                  {c.hasMenu ? <Text style={styles.menuBadge}>Full menu inside</Text> : null}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : null}
      <StatusBar style="auto" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { paddingHorizontal: 24, paddingVertical: 24, gap: 10 },
  title: { fontSize: 22, fontWeight: '600', color: '#111827', lineHeight: 28 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#ffffff', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, color: '#111827', fontVariant: ['tabular-nums'] },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#dbeafe' },
  pillActive: { backgroundColor: BLUE, borderColor: BLUE },
  pillText: { color: BLUE, fontSize: 13, fontWeight: '500' },
  pillTextActive: { color: '#ffffff' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 22, color: BLUE, fontWeight: '600' },
  pax: { fontSize: 20, fontWeight: '700', color: '#111827', minWidth: 32, textAlign: 'center', fontVariant: ['tabular-nums'] },
  results: { gap: 8, marginTop: 8 },
  resultsTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  muted: { fontSize: 13, color: '#6b7280' },
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 14, gap: 4 },
  cardRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardText: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  cardMeta: { fontSize: 13, color: '#6b7280' },
  cardPrice: { fontSize: 15, fontWeight: '700', color: BLUE, fontVariant: ['tabular-nums'] },
  cardEach: { fontSize: 12, fontWeight: '400', color: '#6b7280' },
  menuBadge: { fontSize: 12, color: BLUE, fontWeight: '600' },
});
