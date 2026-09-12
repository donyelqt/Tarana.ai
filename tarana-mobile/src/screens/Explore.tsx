import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { searchPlaces, calculateRoute, type Place, type RouteSummary } from '../data';

const BLUE = '#0066FF';
const BLUE_LIGHT = '#1E90FF';

/** Arrival is an opaque server string (usually ISO) — format defensively. */
function formatArrival(value: string | null): string | null {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return value;
  }
}

/**
 * Explore — web `ExploreMapView` mobile composition, native (§8).
 *
 * Same grammar: top search card (From/To + swap + Get directions) with
 * autocomplete lists, result as a bottom-sheet-style card (summary +
 * steps). No map SDK on device (`react-native-maps` deferred with the
 * screen's offline story), so legs render as a readable list instead of
 * polylines. Every control is live: search hits the session-free API,
 * directions require both ends picked from results.
 */
export default function Explore() {
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [fromList, setFromList] = useState<Place[]>([]);
  const [toList, setToList] = useState<Place[]>([]);
  const [from, setFrom] = useState<Place | null>(null);
  const [to, setTo] = useState<Place | null>(null);
  const [searching, setSearching] = useState<'from' | 'to' | null>(null);
  const [routing, setRouting] = useState(false);
  const [route, setRoute] = useState<RouteSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const suggest = async (which: 'from' | 'to', text: string) => {
    if (which === 'from') {
      setFromText(text);
      setFrom(null);
    } else {
      setToText(text);
      setTo(null);
    }
    setRoute(null);
    setError(null);
    if (text.trim().length < 2) {
      if (which === 'from') setFromList([]);
      else setToList([]);
      return;
    }
    setSearching(which);
    try {
      const places = await searchPlaces(text);
      if (which === 'from') setFromList(places.slice(0, 5));
      else setToList(places.slice(0, 5));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Place search failed.');
    } finally {
      setSearching(null);
    }
  };

  const swap = () => {
    setFromText(toText);
    setToText(fromText);
    setFrom(to);
    setTo(from);
    setFromList([]);
    setToList([]);
    setRoute(null);
    setError(null);
  };

  const go = async () => {
    if (!from || !to) return;
    setRouting(true);
    setError(null);
    setRoute(null);
    try {
      setRoute(await calculateRoute(from, to));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Route request failed.');
    } finally {
      setRouting(false);
    }
  };

  const pick = (which: 'from' | 'to', place: Place) => {
    if (which === 'from') {
      setFrom(place);
      setFromText(place.name);
      setFromList([]);
    } else {
      setTo(place);
      setToText(place.name);
      setToList([]);
    }
  };

  const renderField = (
    which: 'from' | 'to',
    label: string,
    value: string,
    list: Place[],
    picked: Place | null
  ) => (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={which === 'from' ? 'Start point…' : 'Where to?…'}
        value={value}
        onChangeText={(t) => suggest(which, t)}
        returnKeyType="search"
        accessibilityLabel={`${label} location`}
      />
      {searching === which ? <ActivityIndicator color={BLUE} style={styles.inlineLoader} /> : null}
      {list.map((p) => (
        <TouchableOpacity
          key={p.id}
          style={styles.suggestion}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Use ${p.name}`}
          onPress={() => pick(which, p)}
        >
          <Text style={styles.suggestionName}>{p.name}</Text>
          <Text style={styles.suggestionAddr} numberOfLines={1}>{p.address}</Text>
        </TouchableOpacity>
      ))}
      {picked ? <Text style={styles.picked}>✓ {picked.name}</Text> : null}
    </View>
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>Tarana Explore</Text>
      <Text style={styles.title}>Get directions</Text>
      <Text style={styles.subcopy}>Live routing with traffic. Needs a connection.</Text>

      <View style={styles.card}>
        {renderField('from', 'From', fromText, fromList, from)}
        <TouchableOpacity
          style={styles.swap}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Swap origin and destination"
          onPress={swap}
        >
          <Text style={styles.swapText}>⇅ Swap</Text>
        </TouchableOpacity>
        {renderField('to', 'To', toText, toList, to)}

        <TouchableOpacity
          onPress={go}
          disabled={!from || !to || routing}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Get directions"
          style={[styles.ctaOuter, (!from || !to) && styles.ctaDisabled]}
        >
          <LinearGradient
            colors={from && to ? [BLUE, BLUE_LIGHT] : ['#9ca3af', '#9ca3af']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>{routing ? 'Finding best route…' : 'Get directions'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {route ? (
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>
            {route.minutes} min · {route.km} km
          </Text>
          <Text style={styles.sheetSub}>
            {route.delayMinutes > 0 ? `+${route.delayMinutes} min traffic` : 'Traffic flowing'}
            {formatArrival(route.arrival) ? ` · arrives ${formatArrival(route.arrival)}` : ''}
            {route.alternativeCount > 0 ? ` · ${route.alternativeCount} alternative${route.alternativeCount === 1 ? '' : 's'}` : ''}
          </Text>
          {route.note ? <Text style={styles.sheetNote}>{route.note}</Text> : null}
          {route.steps.map((s, i) => (
            <View key={i} style={styles.step}>
              <Text style={styles.stepText}>{s.text}</Text>
              <Text style={styles.stepMeta}>
                {s.meters >= 1000 ? `${(s.meters / 1000).toFixed(1)} km` : `${Math.round(s.meters)} m`}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      <StatusBar style="auto" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  content: { paddingHorizontal: 24, paddingVertical: 24, gap: 10 },
  eyebrow: { fontSize: 11, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', color: BLUE },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', lineHeight: 30 },
  subcopy: { fontSize: 14, color: '#6b7280' },
  card: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 16, padding: 16, gap: 10 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#ffffff', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, color: '#111827' },
  inlineLoader: { marginTop: 8 },
  suggestion: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  suggestionName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  suggestionAddr: { fontSize: 12, color: '#6b7280' },
  picked: { fontSize: 13, color: BLUE, fontWeight: '600', marginTop: 4 },
  swap: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 12 },
  swapText: { color: BLUE, fontSize: 14, fontWeight: '600' },
  ctaOuter: { borderRadius: 16, marginTop: 4 },
  ctaDisabled: { opacity: 0.9 },
  cta: { paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  ctaText: { color: '#ffffff', fontSize: 16, fontWeight: '500' },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 12, padding: 10 },
  errorText: { color: '#dc2626', fontSize: 13 },
  sheet: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 16, padding: 16, gap: 6 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', marginBottom: 4 },
  sheetTitle: { fontSize: 22, fontWeight: '700', color: '#111827', fontVariant: ['tabular-nums'] },
  sheetSub: { fontSize: 13, color: '#6b7280' },
  sheetNote: { fontSize: 13, color: BLUE, lineHeight: 18 },
  step: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  stepText: { flex: 1, fontSize: 14, color: '#111827', lineHeight: 19 },
  stepMeta: { fontSize: 13, color: '#6b7280', fontVariant: ['tabular-nums'] },
});
