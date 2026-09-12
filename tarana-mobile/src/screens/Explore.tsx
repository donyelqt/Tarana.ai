import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import DynamicIsland from './DynamicIsland';
import ExploreMapView from './ExploreMapView';
import { CompassIcon, LayersIcon, TiltIcon } from './icons';
import { GradientCTA } from './ui';
import ExploreSheet from './ExploreSheet';
import {
  calculateRoute,
  DEFAULT_EXPLORE_PREFS,
  POPULAR_LOCATIONS,
  searchPlaces,
  TRAFFIC_DOTS,
  TRAFFIC_LABELS,
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

/**
 * Explore — web `ExploreMapView` translated to native (§8).
 *
 * Same composition: TomTom map background (the actual web map via
 * /embed/map — same markers/polylines/glow/traffic/retry, key stays
 * allowlisted server-side) + DynamicIsland search card (same 210/23
 * spring morph, collapsed "Where to?" pill) + traffic badge + map
 * controls (recenter/tilt/style) + bottom route sheet. No map SDK or
 * motion libs invented: WebView + Reanimated are the native carriers.
 */
export default function Explore() {
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [fromList, setFromList] = useState<Place[]>([]);
  const [toList, setToList] = useState<Place[]>([]);
  const [from, setFrom] = useState<Place | null>(null);
  const [to, setTo] = useState<Place | null>(null);
  const [openWhich, setOpenWhich] = useState<'from' | 'to' | null>(null);
  const [islandOpen, setIslandOpen] = useState(false);
  const [prefs, setPrefs] = useState<ExplorePreferences>(DEFAULT_EXPLORE_PREFS);
  const [showOptions, setShowOptions] = useState(false);
  const [searching, setSearching] = useState<'from' | 'to' | null>(null);
  const [routing, setRouting] = useState(false);
  const [route, setRoute] = useState<RouteSummary | null>(null);
  const [selectedId, setSelectedId] = useState('primary');
  const [mapStyle, setMapStyle] = useState<'main' | 'satellite'>('main');
  const [tiltOn, setTiltOn] = useState(true);
  const [recenterSignal, setRecenterSignal] = useState(0);
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

  const suggest = (which: 'from' | 'to', text: string) => {
    if (which === 'from') {
      setFromText(text);
      if (from && text !== from.name) setFrom(null);
    } else {
      setToText(text);
      if (to && text !== to.name) setTo(null);
    }
    setRoute(null);
    setSelectedId('primary');
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
    setSelectedId('primary');
    setError(null);
  };

  const go = async () => {
    if (!from || !to) return;
    // Web parity (FloatingSearchCard close): drop focus so the keyboard
    // retracts together with the card. Never on pick — auto-advance needs
    // the gesture chain alive.
    Keyboard.dismiss();
    setRouting(true);
    setError(null);
    setRoute(null);
    setSelectedId('primary');
    setOpenWhich(null);
    try {
      setRoute(await calculateRoute(from, to, prefs));
      // Web parity: collapse back to the pill once the route is on the map.
      setIslandOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Route request failed.');
    } finally {
      setRouting(false);
    }
  };

  // Web parity: handleClose clears route AND endpoints (not just the sheet).
  const closeRoute = () => {
    setRoute(null);
    setSelectedId('primary');
    setFrom(null);
    setTo(null);
    setFromText('');
    setToText('');
    setFromList([]);
    setToList([]);
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
  const expanded = islandOpen || routing;
  const hasEndpoint = !!from || !!to;

  // Selected route drives the map's primary polyline (web selectAlternative
  // promotes the tap to primary and keeps traffic as-is — mirrored here).
  const selectedAlt = route?.alternatives.find((a) => a.id === selectedId) ?? null;
  const mapPrimary = route
    ? selectedAlt
      ? { id: selectedAlt.id, path: selectedAlt.path }
      : { id: 'primary', path: route.path }
    : null;
  const mapAlternatives = route
    ? selectedAlt
      ? [{ id: 'primary', path: route.path }, ...route.alternatives.filter((a) => a.id !== selectedId)]
      : route.alternatives
    : [];

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
      // Open field stacks above its sibling: equal zIndex ties paint the
      // later sibling (To) over the earlier dropdown (From) on both
      // platforms — elevation carries it on Android, zIndex on iOS.
      <View style={[styles.fieldWrap, showList && styles.fieldWrapOpen]}>
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
            <ScrollView style={styles.panelList} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
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
            </ScrollView>
          </View>
        ) : null}
        {picked ? <Text style={styles.picked}>✓ {picked.name}</Text> : null}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.mapFill}>
        <ExploreMapView
          origin={from}
          destination={to}
          primary={mapPrimary}
          alternatives={mapAlternatives}
          mapStyle={mapStyle}
          tiltOn={tiltOn}
          recenterSignal={recenterSignal}
          loading={routing}
          onSelectRoute={setSelectedId}
        />
      </View>

      <View style={styles.islandSlot} pointerEvents="box-none">
        <DynamicIsland
          expanded={expanded}
          onCompactClick={() => setIslandOpen(true)}
          compactWidth={hasEndpoint ? 320 : 240}
          compactLabel={hasEndpoint ? `Edit route${from ? ` from ${from.name}` : ''}${to ? ` to ${to.name}` : ''}` : 'Open search'}
          compact={
            hasEndpoint ? (
              <View style={styles.pillSummary}>
                <View style={[styles.pillDot, styles.dotFrom]} />
                <Text style={[styles.pillText, !from && styles.pillTextDim]} numberOfLines={1}>
                  {from?.name ?? 'Start'}
                </Text>
                <Text style={styles.pillArrow}>→</Text>
                <View style={[styles.pillDot, styles.dotTo]} />
                <Text style={[styles.pillText, !to && styles.pillTextDim]} numberOfLines={1}>
                  {to?.name ?? 'Destination'}
                </Text>
              </View>
            ) : (
              'Where to?'
            )
          }
        >
          <View style={styles.islandBody}>
            <View style={styles.islandHead}>
              <Text style={styles.islandTitle}>Plan route</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Close search"
                onPress={() => setIslandOpen(false)}
                style={styles.islandCloseHit}
              >
                <Text style={styles.islandClose}>✕</Text>
              </TouchableOpacity>
            </View>
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
        </DynamicIsland>
      </View>

      {route?.traffic && !expanded ? (
        <View style={styles.badge} pointerEvents="none">
          <View style={[styles.badgeDot, { backgroundColor: TRAFFIC_DOTS[route.traffic.level] }]} />
          <Text style={styles.badgeText}>{TRAFFIC_LABELS[route.traffic.level]} traffic</Text>
        </View>
      ) : null}

      <View style={styles.controls} pointerEvents="box-none">
        <TouchableOpacity
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Recenter to my route"
          onPress={() => setRecenterSignal((n) => n + 1)}
          style={styles.controlBtn}
        >
          <CompassIcon size={20} color="#374151" />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={tiltOn ? 'Turn off 3D tilt' : 'Turn on 3D tilt'}
          onPress={() => setTiltOn((v) => !v)}
          style={[styles.controlBtn, tiltOn && styles.controlBtnActive]}
        >
          <TiltIcon size={20} color={tiltOn ? '#ffffff' : '#374151'} />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Change map style, current ${mapStyle}`}
          onPress={() => setMapStyle((s) => (s === 'main' ? 'satellite' : 'main'))}
          style={styles.controlBtn}
        >
          <LayersIcon size={20} color="#374151" />
        </TouchableOpacity>
      </View>

      {error && !expanded ? (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{error}</Text>
        </View>
      ) : null}

      {route && !expanded ? (
        <View style={styles.sheetSlot} pointerEvents="box-none">
          <ScrollView style={styles.sheetScroll} keyboardShouldPersistTaps="handled">
            <ExploreSheet
              route={route}
              selectedId={selectedId}
              onSelectAlternative={setSelectedId}
              onClose={closeRoute}
            />
          </ScrollView>
        </View>
      ) : null}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  mapFill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  islandSlot: { position: 'absolute', top: 12, left: 0, right: 0, zIndex: 30 },
  islandBody: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, gap: 8 },
  islandHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  islandTitle: { fontSize: 16, fontWeight: '700', color: '#111827', letterSpacing: -0.2 },
  islandCloseHit: { padding: 6 },
  islandClose: { fontSize: 14, color: '#9ca3af', fontWeight: '700' },
  pillSummary: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { flex: 1, fontSize: 13, fontWeight: '500', color: '#111827' },
  pillTextDim: { color: '#9ca3af' },
  pillArrow: { fontSize: 13, color: '#9ca3af', fontWeight: '700' },
  fieldWrap: { position: 'relative' },
  fieldWrapOpen: { zIndex: 100, elevation: 20 },
  fieldHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotFrom: { backgroundColor: '#10b981' },
  dotTo: { backgroundColor: '#f43f5e' },
  fieldLabel: { fontSize: 10, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#ffffff', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, color: '#111827' },
  inlineLoader: { marginTop: 8 },
  panel: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: 50,
    elevation: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  panelList: { maxHeight: 300 },
  panelHead: { paddingHorizontal: 12, paddingVertical: 6, fontSize: 10, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, backgroundColor: '#F9FAFB' },
  suggestion: { paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
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
  badge: {
    position: 'absolute',
    top: 78,
    left: 12,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#111827' },
  controls: { position: 'absolute', right: 12, top: '42%', zIndex: 20, gap: 6 },
  controlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  controlBtnActive: { backgroundColor: BLUE, borderColor: BLUE },
  toast: {
    position: 'absolute',
    top: 130,
    alignSelf: 'center',
    zIndex: 40,
    backgroundColor: '#dc2626',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    maxWidth: '90%',
  },
  toastText: { color: '#ffffff', fontSize: 13, fontWeight: '500', textAlign: 'center' },
  sheetSlot: { position: 'absolute', bottom: 12, left: 12, right: 12, zIndex: 20, maxHeight: '52%' },
  sheetScroll: { borderRadius: 16 },
});
