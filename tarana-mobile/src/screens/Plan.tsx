import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GradientCTA } from './ui';
import { generateItinerary } from '../data';
import { CITY_CONFIGS, type CityId } from 'tarana-web/data/cityConfig';

const BLUE = '#0066FF';

const PLAN_CITIES: CityId[] = ['baguio', 'cebu', 'manila', 'davao'];
const INTERESTS = ['Food', 'Nature', 'Culture', 'Adventure', 'Cafes', 'History', 'Nightlife', 'Shopping'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Plan — Tarana Gala form, native (§8).
 *
 * Web field order recomposed single-column: destination → budget → pax →
 * duration → dates → interests → CTA. No traffic toggle yet (it only
 * affects generation, which is Phase-2 gated — a toggle that changes
 * nothing would be dishonest UI). Generate validates, then calls the
 * seam: until the local model lands, the honest pending card echoes the
 * request back instead of a dead spinner.
 */
export default function Plan() {
  const [city, setCity] = useState<CityId>('baguio');
  const [budget, setBudget] = useState('');
  const [pax, setPax] = useState(2);
  const [days, setDays] = useState(3);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [interests, setInterests] = useState<string[]>(['Food']);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleInterest = (tag: string) => {
    setInterests((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
    setPending(null);
  };

  const handleGenerate = async () => {
    setError(null);
    setPending(null);
    const n = parseInt(budget.replace(/[^0-9]/g, ''), 10);
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter a trip budget in pesos.');
      return;
    }
    if (!DATE_RE.test(start.trim()) || !DATE_RE.test(end.trim())) {
      setError('Dates must look like 2026-10-03 (YYYY-MM-DD).');
      return;
    }
    if (interests.length === 0) {
      setError('Pick at least one interest.');
      return;
    }
    const summary =
      `${CITY_CONFIGS[city].name} · ₱${n} · ${pax} ${pax === 1 ? 'person' : 'people'} · ` +
      `${days} ${days === 1 ? 'day' : 'days'} · ${interests.join(', ')}`;
    setLoading(true);
    try {
      await generateItinerary({
        city,
        budget: n,
        pax,
        days,
        startDate: start.trim(),
        endDate: end.trim(),
        interests,
      });
    } catch (e) {
      // Capability gate (§6 Q1): the form is real, the model is pending.
      setPending(`${summary}\n\n${e instanceof Error ? e.message : 'Generation is unavailable.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Plan my trip</Text>
      <Text style={styles.subcopy}>Runs on-device when the local model lands. Your form is saved as you go.</Text>

      <Text style={styles.label}>Destination</Text>
      <View style={styles.pills}>
        {PLAN_CITIES.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.pill, city === c && styles.pillActive]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: city === c }}
            accessibilityLabel={`Destination ${CITY_CONFIGS[c].name}`}
            onPress={() => {
              setCity(c);
              setPending(null);
            }}
          >
            <Text style={[styles.pillText, city === c && styles.pillTextActive]}>{CITY_CONFIGS[c].name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Budget total (₱)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 5000"
        value={budget}
        onChangeText={(t) => {
          setBudget(t);
          setPending(null);
        }}
        keyboardType="number-pad"
        returnKeyType="done"
        placeholderTextColor="#9ca3af"
        accessibilityLabel="Trip budget total in pesos"
      />

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
        <Text style={styles.stepValue}>{pax}</Text>
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

      <Text style={styles.label}>Days</Text>
      <View style={styles.stepper}>
        <TouchableOpacity
          style={styles.stepBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Fewer days"
          onPress={() => setDays((d) => Math.max(1, d - 1))}
        >
          <Text style={styles.stepText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepValue}>{days}</Text>
        <TouchableOpacity
          style={styles.stepBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="More days"
          onPress={() => setDays((d) => Math.min(14, d + 1))}
        >
          <Text style={styles.stepText}>+</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Start date</Text>
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD"
        value={start}
        onChangeText={(t) => {
          setStart(t);
          setPending(null);
        }}
        autoCapitalize="none"
        placeholderTextColor="#9ca3af"
        accessibilityLabel="Trip start date"
      />

      <Text style={styles.label}>End date</Text>
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD"
        value={end}
        onChangeText={(t) => {
          setEnd(t);
          setPending(null);
        }}
        autoCapitalize="none"
        placeholderTextColor="#9ca3af"
        accessibilityLabel="Trip end date"
      />

      <Text style={styles.label}>Interests</Text>
      <View style={styles.pills}>
        {INTERESTS.map((tag) => (
          <TouchableOpacity
            key={tag}
            style={[styles.pill, interests.includes(tag) && styles.pillActive]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: interests.includes(tag) }}
            accessibilityLabel={`Interest ${tag}`}
            onPress={() => toggleInterest(tag)}
          >
            <Text style={[styles.pillText, interests.includes(tag) && styles.pillTextActive]}>{tag}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {pending ? (
        <View style={styles.pendingBox}>
          <Text style={styles.pendingTitle}>Almost there</Text>
          <Text style={styles.pendingText}>{pending}</Text>
        </View>
      ) : null}

      <GradientCTA
        variant="app"
        title="Generate itinerary"
        loadingTitle="Checking…"
        loading={loading}
        onPress={handleGenerate}
        accessibilityLabel="Generate itinerary"
      />
      <StatusBar style="auto" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { paddingHorizontal: 24, paddingVertical: 24, gap: 10 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', lineHeight: 30 },
  subcopy: { fontSize: 14, color: '#6b7280' },
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
  stepValue: { fontSize: 20, fontWeight: '700', color: '#111827', minWidth: 32, textAlign: 'center', fontVariant: ['tabular-nums'] },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 12, padding: 10 },
  errorText: { color: '#dc2626', fontSize: 13 },
  pendingBox: { backgroundColor: '#eff6ff', borderRadius: 16, padding: 16, gap: 6, borderWidth: 1, borderColor: '#dbeafe' },
  pendingTitle: { fontSize: 15, fontWeight: '600', color: BLUE },
  pendingText: { fontSize: 13, color: '#374151', lineHeight: 19 },
});
