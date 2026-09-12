import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { config } from '../config';
import type { Place } from '../data';

export type MapRouteShape = {
  id: string;
  path: Array<{ lat: number; lon: number }>;
};

export type ExploreMapProps = {
  origin: Place | null;
  destination: Place | null;
  primary: MapRouteShape | null;
  alternatives: MapRouteShape[];
  mapStyle: 'main' | 'satellite';
  tiltOn: boolean;
  recenterSignal: number;
  /** Web parity: useRouteCalculation isCalculating → map "Analyzing routes…" overlay. */
  loading: boolean;
  onSelectRoute: (id: string) => void;
};

/**
 * The web TomTom map (src/app/embed/map, same InteractiveRouteMap,
 * same markers/polylines/glow/traffic/retry) inside a native WebView.
 *
 * Why not inline HTML: the TomTom key is referrer-allowlisted to the web
 * origin (see locations/search forwarding) — a null-origin WebView page
 * gets 403s. Loading our first-party /embed/map keeps the key
 * server-side-approved and ships zero keys in the binary (§7.5).
 * Bridge protocol is documented in src/app/embed/map/EmbedMap.tsx.
 */
export default function ExploreMapView({
  origin,
  destination,
  primary,
  alternatives,
  mapStyle,
  tiltOn,
  recenterSignal,
  loading,
  onSelectRoute,
}: ExploreMapProps) {
  const webRef = useRef<WebView | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const readyRef = useRef(false);
  const queueRef = useRef<string[]>([]);
  const firstSignal = useRef(true);

  const embedUrl = `${config.webBaseUrl.replace(/\/$/, '')}/embed/map`;

  const send = (cmd: Record<string, unknown>) => {
    const js = `window.__taranaMapCmd && window.__taranaMapCmd(${JSON.stringify(cmd)}); true;`;
    if (!readyRef.current) {
      queueRef.current.push(js);
      return;
    }
    try {
      webRef.current?.injectJavaScript(js);
    } catch {
      /* webview gone — next remount replays from props */
    }
  };

  const flush = () => {
    const q = queueRef.current;
    queueRef.current = [];
    for (const js of q) {
      try {
        webRef.current?.injectJavaScript(js);
      } catch {
        break;
      }
    }
  };

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: unknown;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (typeof msg !== 'object' || msg === null) return;
    const type = (msg as { type?: unknown }).type;
    if (type === 'embed-ready') {
      readyRef.current = true;
      setReady(true);
      flush();
    } else if (type === 'route-select') {
      const id = (msg as { routeId?: unknown }).routeId;
      if (typeof id === 'string' && id) onSelectRoute(id);
    }
  };

  // Route state → map (single command keeps markers + polylines in sync,
  // mirroring the web effect that redraws both together).
  useEffect(() => {
    if (!primary && !origin && !destination) {
      send({ type: 'clear' });
      return;
    }
    send({
      type: 'set-route',
      origin: origin ? { id: origin.id, name: origin.name, address: origin.address, lat: origin.lat, lng: origin.lon } : null,
      destination: destination
        ? { id: destination.id, name: destination.name, address: destination.address, lat: destination.lat, lng: destination.lon }
        : null,
      primary: primary
        ? { id: primary.id, summary: {}, path: primary.path.map((p) => ({ lat: p.lat, lng: p.lon })) }
        : null,
      alternatives: alternatives.map((a) => ({
        id: a.id,
        summary: {},
        path: a.path.map((p) => ({ lat: p.lat, lng: p.lon })),
      })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primary?.id, origin?.id, destination?.id, alternatives.map((a) => a.id).join(',')]);

  useEffect(() => {
    send({ type: 'style', style: mapStyle });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStyle]);

  useEffect(() => {
    send({ type: 'tilt', on: tiltOn });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiltOn]);

  useEffect(() => {
    send({ type: 'loading', on: loading });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    if (firstSignal.current) {
      firstSignal.current = false;
      return;
    }
    send({ type: 'recenter' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterSignal]);

  if (failed) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackTitle}>Map unavailable</Text>
        <Text style={styles.fallbackSub}>Check your connection and try again.</Text>
        <TouchableOpacity
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Retry loading map"
          onPress={() => {
            setFailed(false);
            setReady(false);
            readyRef.current = false;
            setAttempt((n) => n + 1);
          }}
          style={styles.retry}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <WebView
        key={attempt}
        ref={webRef}
        style={styles.fill}
        source={{ uri: embedUrl }}
        // First-party embed URL only; '*' is required because dev serves
        // plain http (default whitelist allows https only).
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
        onError={() => setFailed(true)}
        onHttpError={() => setFailed(true)}
        startInLoadingState={false}
        accessibilityLabel="Route map"
      />
      {!ready ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#0066FF" />
          <Text style={styles.loadingText}>Getting map services ready.</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  loading: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: { fontSize: 13, color: '#6b7280' },
  fallback: { flex: 1, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 24 },
  fallbackTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  fallbackSub: { fontSize: 13, color: '#6b7280', textAlign: 'center' },
  retry: { marginTop: 8, backgroundColor: '#0066FF', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20 },
  retryText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
});
