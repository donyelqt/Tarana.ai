import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import DynamicIsland from './DynamicIsland';
import ExploreMapView from './ExploreMapView';
import {
  BikeIcon,
  CarIcon,
  CompassIcon,
  LayersIcon,
  SlidersIcon,
  TiltIcon,
  TruckIcon,
  WalkIcon,
} from './icons';
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

/**
 * Web parity: FloatingSearchCard SlidingSegmented thumb spring. NOTE these
 * are the SEGMENT constants (stiffness 420, damping 34, mass 0.9) — NOT the
 * island morph constants (210/23/1). Each motion keeps its own verified set.
 */
const SEG_SPRING = { stiffness: 420, damping: 34, mass: 0.9 } as const;

/** Web parity: VEHICLE_OPTIONS (Ride reuses the Bike glyph — web does too). */
const VEHICLE_OPTIONS: Array<{ value: ExploreVehicleType; label: string }> = [
  { value: 'car', label: 'Drive' },
  { value: 'walk', label: 'Walk' },
  { value: 'bicycle', label: 'Bike' },
  { value: 'motorcycle', label: 'Ride' },
  { value: 'truck', label: 'Truck' },
];

const VEHICLE_GLYPHS: Record<ExploreVehicleType, (p: { color: string }) => ReactNode> = {
  car: ({ color }) => <CarIcon size={16} color={color} />,
  walk: ({ color }) => <WalkIcon size={16} color={color} />,
  bicycle: ({ color }) => <BikeIcon size={16} color={color} />,
  motorcycle: ({ color }) => <BikeIcon size={16} color={color} />,
  truck: ({ color }) => <TruckIcon size={16} color={color} />,
};

/** Web parity: ROUTE_TYPE_OPTIONS values (Scenic sends 'thrilling'). */
const ROUTE_TYPE_OPTIONS: Array<{ value: ExploreRouteType; label: string; glyph: string }> = [
  { value: 'fastest', label: 'Fastest', glyph: '⚡' },
  { value: 'shortest', label: 'Shortest', glyph: '➲' },
  { value: 'thrilling', label: 'Scenic', glyph: '◷' },
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
 * Apple-style segmented track: one white thumb sliding between icon-only
 * options. Web SlidingSegmented parity (gray-50 track, thumb + labels).
 */
function SlidingTrack<T extends string>({
  options,
  value,
  onChange,
  a11yPrefix,
  renderIcon,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  a11yPrefix: string;
  renderIcon: (value: T, active: boolean) => ReactNode;
}) {
  const [rects, setRects] = useState<Record<string, { x: number; width: number }>>({});
  const left = useSharedValue(0);
  const thumbWidth = useSharedValue(0);
  const active = rects[value];
  const activeX = active?.x;
  const activeW = active?.width;

  useEffect(() => {
    if (activeX !== undefined && activeW !== undefined) {
      left.value = withSpring(activeX, SEG_SPRING);
      thumbWidth.value = withSpring(activeW, SEG_SPRING);
    }
  }, [activeX, activeW, left, thumbWidth]);

  const thumbStyle = useAnimatedStyle(() => ({
    left: left.value,
    width: thumbWidth.value,
  }));

  return (
    <View style={styles.track}>
      {active ? <Animated.View style={[styles.thumb, thumbStyle]} /> : null}
      {options.map((o) => {
        const isActive = o.value === value;
        return (
          <TouchableOpacity
            key={o.value}
            style={styles.trackBtn}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${o.label} ${a11yPrefix}`}
            onPress={() => onChange(o.value)}
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout;
              setRects((prev) => {
                const p = prev[o.value];
                if (p && Math.abs(p.x - x) < 0.5 && Math.abs(p.width - width) < 0.5) return prev;
                return { ...prev, [o.value]: { x, width } };
              });
            }}
          >
            {renderIcon(o.value, isActive)}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * Explore — web `ExploreMapView` translated to native (§8).
 *
 * Same composition: TomTom map background (the actual web map via
 * /embed/map — same markers/polylines/glow/traffic/retry, key stays
 * allowlisted server-side) + DynamicIsland search card (same 210/23
 * spring morph, collapsed "Where to?" pill) + traffic badge + map
 * controls (recenter/tilt/style) + bottom route sheet. No map SDK or
 * motion libs invented: WebView + Reanimated are the native carriers.
 *
 * Island content is a 1:1 of FloatingSearchCard (no title row, no X —
 * the hamburger corner is excluded per call): borderless From/To with
 * absolute left swap circle, icon-only vehicle track with sliding thumb,
 * transparent route-type row, sliders options button, gradient avoid
 * pills, magnifier CTA. Collapse = post-calc or keyboard-away (the
 * native translation of outside-click/Escape).
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

  // Native translation of web outside-click/Escape dismiss: a user-sent
  // keyboard retreat means "done with input". No routing guard needed —
  // expanded survives on `routing`, and on error the toast owns the screen.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => setIslandOpen(false));
    return () => sub.remove();
  }, []);

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

  // Web LocationField clear(): drop the commit, reopen the list, refocus.
  const clearField = (which: 'from' | 'to') => {
    seq.current += 1;
    if (timer.current) clearTimeout(timer.current);
    setSearching((s) => (s === which ? null : s));
    if (which === 'from') {
      setFromText('');
      setFrom(null);
      setFromList([]);
      setOpenWhich('from');
      fromRef.current?.focus();
    } else {
      setToText('');
      setTo(null);
      setToList([]);
      setOpenWhich('to');
      toRef.current?.focus();
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
        <View style={styles.inputWrap}>
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
          {searching === which ? (
            <ActivityIndicator color={BLUE} size="small" style={styles.inputSide} />
          ) : value ? (
            <TouchableOpacity
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Clear ${label.toLowerCase()}`}
              onPress={() => clearField(which)}
              style={styles.inputSide}
            >
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
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
                  <Text style={styles.sugIcon}>{typing ? '⌕' : '◉'}</Text>
                  <View style={styles.sugTexts}>
                    <Text style={styles.suggestionName}>{p.name}</Text>
                    <Text style={styles.suggestionAddr} numberOfLines={1}>{p.address}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {typing && items.length === 0 ? (
                <Text style={styles.noMatches}>{searching === which ? 'Searching…' : 'No matches'}</Text>
              ) : null}
            </ScrollView>
          </View>
        ) : null}
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
            <View style={styles.fieldsBox}>
              {renderField('from', 'From', fromText, fromList, from, fromRef)}
              <TouchableOpacity
                style={styles.swapBtn}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Swap origin and destination"
                onPress={swap}
              >
                <Text style={styles.swapGlyph}>⇅</Text>
              </TouchableOpacity>
              {renderField('to', 'To', toText, toList, to, toRef)}
            </View>

            <View style={styles.transportRow}>
              <SlidingTrack
                options={VEHICLE_OPTIONS}
                value={prefs.vehicleType}
                onChange={(v) => setPrefs((p) => ({ ...p, vehicleType: v }))}
                a11yPrefix="transport"
                renderIcon={(v, active) => {
                  const G = VEHICLE_GLYPHS[v];
                  return <G color={active ? '#111827' : '#6b7280'} />;
                }}
              />
            </View>

            <View style={styles.typeRow}>
              <View style={styles.typeTrackWrap}>
                <SlidingTrack
                  options={ROUTE_TYPE_OPTIONS}
                  value={prefs.routeType}
                  onChange={(v) => setPrefs((p) => ({ ...p, routeType: v }))}
                  a11yPrefix="route"
                  renderIcon={(v, active) => {
                    const opt = ROUTE_TYPE_OPTIONS.find((o) => o.value === v);
                    const color = active ? '#111827' : '#6b7280';
                    return (
                      <View style={styles.typeOpt}>
                        <Text style={[styles.typeGlyph, { color }]}>{opt?.glyph ?? ''}</Text>
                        <Text style={[styles.typeText, active && styles.typeTextActive]}>{opt?.label ?? ''}</Text>
                      </View>
                    );
                  }}
                />
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="More options"
                accessibilityState={{ expanded: showOptions }}
                onPress={() => setShowOptions((v) => !v)}
                style={[styles.optBtn, showOptions && styles.optBtnActive]}
              >
                <SlidersIcon size={16} color={showOptions ? BLUE : '#6b7280'} />
              </TouchableOpacity>
            </View>

            {showOptions ? (
              <View style={styles.drawer}>
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
                      >
                        {active ? (
                          <LinearGradient
                            colors={['#1D4ED8', '#3B82F6']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={[styles.avoidPill, styles.avoidPillActive]}
                          >
                            <Text style={[styles.avoidText, styles.avoidTextActive]}>{o.label}</Text>
                          </LinearGradient>
                        ) : (
                          <View style={styles.avoidPill}>
                            <Text style={styles.avoidText}>{o.label}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={styles.submitWrap}>
              <GradientCTA
                variant="app"
                // Web submit carries a leading magnifier; GradientCTA is
                // canonical-shared so the glyph rides the title, not the module.
                title="⌕  Get directions"
                loadingTitle="Finding best route…"
                loading={routing}
                disabled={!from || !to}
                onPress={go}
                accessibilityLabel="Get directions"
              />
            </View>
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
  islandBody: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12, gap: 4 },
  pillSummary: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { flex: 1, fontSize: 13, fontWeight: '500', color: '#111827' },
  pillTextDim: { color: '#9ca3af' },
  pillArrow: { fontSize: 13, color: '#9ca3af', fontWeight: '700' },
  fieldsBox: { position: 'relative', paddingLeft: 38 },
  swapBtn: {
    position: 'absolute',
    left: 0,
    top: '50%',
    marginTop: -15,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 60,
    elevation: 6,
  },
  swapGlyph: { fontSize: 14, color: '#6b7280', fontWeight: '700' },
  fieldWrap: { position: 'relative' },
  fieldWrapOpen: { zIndex: 100, elevation: 20 },
  fieldHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotFrom: { backgroundColor: '#10b981' },
  dotTo: { backgroundColor: '#f43f5e' },
  fieldLabel: { fontSize: 10, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8 },
  inputWrap: { position: 'relative', justifyContent: 'center' },
  input: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 0,
    paddingRight: 40,
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  inputSide: { position: 'absolute', right: 4, top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: 6 },
  clearText: { fontSize: 14, color: '#9ca3af', fontWeight: '700' },
  panel: {
    position: 'absolute',
    top: '100%',
    left: -38,
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
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  sugIcon: { fontSize: 14, color: '#9ca3af', width: 18, textAlign: 'center' },
  sugTexts: { flex: 1, minWidth: 0 },
  suggestionName: { fontSize: 14, fontWeight: '500', color: '#111827' },
  suggestionAddr: { fontSize: 12, color: '#6b7280' },
  noMatches: { paddingVertical: 14, textAlign: 'center', fontSize: 13, color: '#6b7280' },
  transportRow: { paddingHorizontal: 0, paddingVertical: 6 },
  track: {
    flexDirection: 'row',
    position: 'relative',
    alignSelf: 'stretch',
    backgroundColor: '#F9FAFB',
    borderRadius: 999,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  thumb: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  trackBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, zIndex: 1 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  typeTrackWrap: { flex: 1 },
  typeOpt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  typeGlyph: { fontSize: 14 },
  typeText: { fontSize: 12, fontWeight: '500', color: '#6b7280' },
  typeTextActive: { color: '#111827', fontWeight: '600' },
  optBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optBtnActive: { backgroundColor: '#EFF6FF' },
  drawer: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10 },
  avoidRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  avoidPill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#E5E7EB' },
  avoidPillActive: { borderColor: '#1D4ED8' },
  avoidText: { fontSize: 12, fontWeight: '600', color: '#4b5563' },
  avoidTextActive: { color: '#ffffff' },
  submitWrap: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10 },
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
