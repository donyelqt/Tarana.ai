import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GradientCTA } from './ui';
import {
  calculateRoute,
  DEFAULT_EXPLORE_PREFS,
  POPULAR_LOCATIONS,
  searchPlaces,
  type ExplorePreferences,
  type ExploreRouteType,
  type ExploreVehicleType,
  type Place,
  type RouteSummary,
} from '../data';

const BLUE = '#0066FF';

/** Web parity: FloatingSearchCard MIN_QUERY + SEARCH_DEBOUNCE_MS. */
const MIN_QUERY = 2;
const SEARCH_DEBOUNCE_MS = 220;
const MAX_SUGGESTIONS = 8;

/** Web parity: VEHICLE_OPTIONS values (text pills — mobile pill language, no icon lib). */
const VEHICLE_OPTIONS: Array<{ value: ExploreVehicleType; label: string }> = [
  { value: 'car', label: 'Drive' },
  { value: 'walk', label: 'Walk' },
  { value: 'bicycle', label: 'Bike' },
  { value: 'motorcycle', label: 'Ride' },
  { value: 'truck', label: 'Truck' },
];

/** Web parity: ROUTE_TYPE_OPTIONS values (Scenic sends 'thrilling'). */
const ROUTE_TYPE_OPTIONS: Array<{ value: ExploreRouteType; label: string }> = [
  { value: 'fastest', label: 'Fastest' },
  { value: 'shortest', label: 'Shortest' },
  { value: 'thrilling', label: 'Scenic' },
];

/** Web parity: options-drawer avoid pills. Departure datetime omitted — it needs
 * a native picker dep; the web default is unset so defaults stay at parity. */
const AVOID_OPTIONS: Array<{ key: 'avoidTolls' | 'avoidFerries' | 'avoidTrafficJams' | 'avoidHighways'; label: string }> = [
  { key: 'avoidTolls', label: 'Tolls' },
  { key: 'avoidFerries', label: 'Ferries' },
  { key: 'avoidTrafficJams', label: 'Traffic' },
  { key: 'avoidHighways', label: 'Highways' },
];

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
 *
 * Search parity with FloatingSearchCard: 220ms debounce, sequence guard
 * against out-of-order responses, popular Baguio places when not typing,
 * auto-advance focus on pick. Preferences mirror the web segmented
 * controls (vehicle + route type + avoid toggles) and ride the same
 * session-free calculate contract.
 */
export default function Explore() {
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [fromList, setFromList] = useState<Place[]>([]);
  const [toList, setToList] = useState<Place[]>([]);
  const [from, setFrom] = useState<Place | null>(null);
  const [to, setTo] = useState<Place | null>(null);
  const [openWhich, setOpenWhich] = useState<'from' | 'to' | null>(null);
  const [prefs, setPrefs] = useState<ExplorePreferences>(DEFAULT_EXPLORE_PREFS);
  const [showOptions, setShowOptions] = useState(false);
  const [searching, setSearching] = useState<'from' | 'to' | null>(null);
  const [routing, setRouting] = useState(false);
  const [route, setRoute] = useState<RouteSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fromRef = useRef<TextInput | null>(null);
  const toRef = useRef<TextInput | null>(null);
  // Sequence guard: a slow response can never overwrite a later one
  // (web useLocationSearch pattern, minus AbortController).
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const suggest = async (which: 'from' | 'to', text: string) => {
    if (which === 'from') {
      setFromText(text);
      if (from && text !== from.name) setFrom(null);
    } else {
      setToText(text);
      if (to && text !== to.name) setTo(null);
    }
    setRoute(null);
    setError(null);
    seq.current += 1;
    if (timer.current) clearTimeout(timer.current);
    if (text.trim().length < MIN_QUERY) {
      if (which === 'from') setFromList([]);
      else setToList([]);
      setSearching((s) => (s === which ? null : s));
      return;
    }
    setSearching(which);
    const id = seq.current;
    const q = text.trim();
    timer.current = setTimeout(async () => {
      try {
        const places = await searchPlaces(q);
        if (id !== seq.current) return;
        if (which === 'from') setFromList(places.slice(0, MAX_SUGGESTIONS));
        else setToList(places.slice(0, MAX_SUGGESTIONS));
      } catch (e) {
        if (id !== seq.current) return;
        setError(e instanceof Error ? e.message : 'Place search failed.');
      } finally {
        if (id === seq.current) setSearching((s) => (s === which ? null : s));
      }
    }, SEARCH_DEBOUNCE_MS);
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
    setOpenWhich(null);
    try {
      setRoute(await calculateRoute(from, to, prefs));
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
      // Auto-advance (web handleOriginCommit): land on the unfilled end.
      if (!to) toRef.current?.focus();
    } else {
      setTo(place);
      setToText(place.name);
      setToList([]);
      if (!from) fromRef.current?.focus();
    }
    setOpenWhich(null);
  };

  const canSubmit = !!from && !!to && !routing;

  const renderField = (
    which: 'from' | 'to',
    label: string,
    value: string,
    list: Place[],
    picked: Place | null,
    inputRef: React.RefObject<TextInput | null>
  ) => {
    // Web parity (LocationField isTyping): typing = text no longer matches
    // the committed place. A focused field holding a place offers popular.
    const typing = value.trim().length >= MIN_QUERY && value !== (picked?.name ?? '');
    const items = typing ? list : POPULAR_LOCATIONS;
    const showList = openWhich === which && (items.length > 0 || typing);
    return (
      <View>
        <View style={styles.fieldHead}>
          <View style={[styles.dot, which === 'from' ? styles.dotFrom : styles.dotTo]} />
          <Text style={styles.fieldLabel}>{label}</Text>
        </View>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={which === 'from' ? 'Choose starting point' : 'Choose destination'}
          value={value}
          onChangeText={(t) => suggest(which, t)}
          onFocus={() => setOpenWhich(which)}
          returnKeyType="search"
          placeholderTextColor="#9ca3af"
          accessibilityLabel={`${label} location`}
          accessibilityRole="combobox"
          onSubmitEditing={() => {
            if (which === 'from') toRef.current?.focus();
            else if (canSubmit) go();
          }}
        />
        {searching === which ? <ActivityIndicator color={BLUE} style={styles.inlineLoader} /> : null}
        {showList ? (
          <View style={styles.panel}>
            <Text style={styles.panelHead}>{typing ? 'Results' : 'Popular places'}</Text>
            {items.map((p) => (
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
            {typing && items.length === 0 ? (
              <Text style={styles.noMatches}>{searching === which ? 'Searching…' : 'No matches'}</Text>
            ) : null}
          </View>
        ) : null}
        {picked ? <Text style={styles.picked}>✓ {picked.name}</Text> : null}
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Get directions</Text>

      <View style={styles.card}>
        {renderField('from', 'From', fromText, fromList, from, fromRef)}
        <TouchableOpacity
          style={styles.swap}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Swap origin and destination"
          onPress={swap}
        >
          <Text style={styles.swapText}>⇅ Swap</Text>
        </TouchableOpacity>
        {renderField('to', 'To', toText, toList, to, toRef)}

        <View style={styles.segRow}>
          {VEHICLE_OPTIONS.map((o) => {
            const active = prefs.vehicleType === o.value;
            return (
              <TouchableOpacity
                key={o.value}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${o.label} transport`}
                onPress={() => setPrefs((p) => ({ ...p, vehicleType: o.value }))}
                style={[styles.segPill, active && styles.segPillActive]}
              >
                <Text style={[styles.segText, active && styles.segTextActive]}>{o.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.typeRow}>
          <View style={styles.segRowFlex}>
            {ROUTE_TYPE_OPTIONS.map((o) => {
              const active = prefs.routeType === o.value;
              return (
                <TouchableOpacity
                  key={o.value}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${o.label} route`}
                  onPress={() => setPrefs((p) => ({ ...p, routeType: o.value }))}
                  style={[styles.segPill, active && styles.segPillActive]}
                >
                  <Text style={[styles.segText, active && styles.segTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="More options"
            accessibilityState={{ expanded: showOptions }}
            onPress={() => setShowOptions((v) => !v)}
            style={[styles.optionsBtn, showOptions && styles.optionsBtnActive]}
          >
            <Text style={[styles.optionsText, showOptions && styles.optionsTextActive]}>Options</Text>
          </TouchableOpacity>
        </View>

        {showOptions ? (
          <View style={styles.avoidRow}>
            {AVOID_OPTIONS.map((o) => {
              const active = !!prefs[o.key];
              return (
                <TouchableOpacity
                  key={o.key}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Avoid ${o.label}`}
                  onPress={() => setPrefs((p) => ({ ...p, [o.key]: !p[o.key] }))}
                  style={[styles.avoidPill, active && styles.avoidPillActive]}
                >
                  <Text style={[styles.avoidText, active && styles.avoidTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        <GradientCTA
          variant="app"
          title="Get directions"
          loadingTitle="Finding best route…"
          loading={routing}
          disabled={!from || !to}
          onPress={go}
          accessibilityLabel="Get directions"
        />
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
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { paddingHorizontal: 24, paddingVertical: 24, gap: 10 },
  title: { fontSize: 22, fontWeight: '600', color: '#111827', lineHeight: 28 },
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, gap: 10 },
  fieldHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotFrom: { backgroundColor: '#10b981' },
  dotTo: { backgroundColor: '#f43f5e' },
  fieldLabel: { fontSize: 10, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#ffffff', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, color: '#111827' },
  inlineLoader: { marginTop: 8 },
  panel: { marginTop: 6, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, overflow: 'hidden' },
  panelHead: { paddingHorizontal: 12, paddingVertical: 6, fontSize: 10, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, backgroundColor: '#F9FAFB' },
  suggestion: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  suggestionName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  suggestionAddr: { fontSize: 12, color: '#6b7280' },
  noMatches: { paddingVertical: 14, textAlign: 'center', fontSize: 13, color: '#6b7280' },
  picked: { fontSize: 13, color: BLUE, fontWeight: '600', marginTop: 4 },
  swap: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 12 },
  swapText: { color: BLUE, fontSize: 14, fontWeight: '600' },
  segRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  segRowFlex: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  segPill: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#F3F4F6' },
  segPillActive: { backgroundColor: BLUE },
  segText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  segTextActive: { color: '#ffffff' },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionsBtn: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB' },
  optionsBtnActive: { backgroundColor: '#EFF6FF', borderColor: BLUE },
  optionsText: { fontSize: 12, fontWeight: '600', color: '#4b5563' },
  optionsTextActive: { color: BLUE },
  avoidRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  avoidPill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#E5E7EB' },
  avoidPillActive: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  avoidText: { fontSize: 12, fontWeight: '600', color: '#4b5563' },
  avoidTextActive: { color: '#ffffff' },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 12, padding: 10 },
  errorText: { color: '#dc2626', fontSize: 13 },
  sheet: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, gap: 6 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', marginBottom: 4 },
  sheetTitle: { fontSize: 22, fontWeight: '700', color: '#111827', fontVariant: ['tabular-nums'] },
  sheetSub: { fontSize: 13, color: '#6b7280' },
  sheetNote: { fontSize: 13, color: BLUE, lineHeight: 18 },
  step: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  stepText: { flex: 1, fontSize: 14, color: '#111827', lineHeight: 19 },
  stepMeta: { fontSize: 13, color: '#6b7280', fontVariant: ['tabular-nums'] },
});
