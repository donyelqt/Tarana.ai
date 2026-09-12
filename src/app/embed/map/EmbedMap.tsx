'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { LocationPoint, RouteData } from '@/types/route-optimization';
import type { MapStyle } from '@/lib/integrations/tomtomMapUtils';

// Map must be client-only and skip SSR (TomTom uses window) — same as ExploreMapView.
const InteractiveRouteMap = dynamic(
  () => import('@/app/tarana-explore/components/route/InteractiveRouteMap'),
  { ssr: false }
);

type BridgeLocation = {
  id?: unknown;
  name?: unknown;
  address?: unknown;
  lat?: unknown;
  lng?: unknown;
  lon?: unknown;
};

type BridgeRoute = {
  id?: unknown;
  summary?: { lengthInMeters?: unknown; travelTimeInSeconds?: unknown; trafficDelayInSeconds?: unknown };
  path?: Array<{ lat?: unknown; lng?: unknown; lon?: unknown }>;
};

type BridgeCommand =
  | { type: 'set-route'; origin?: BridgeLocation | null; destination?: BridgeLocation | null; primary?: BridgeRoute | null; alternatives?: BridgeRoute[] }
  | { type: 'clear' }
  | { type: 'recenter' }
  | { type: 'style'; style?: unknown }
  | { type: 'tilt'; on?: unknown }
  | { type: 'loading'; on?: unknown };

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (msg: string) => void };
    __taranaMapCmd?: (cmd: BridgeCommand) => void;
  }
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Cap bridge paths so a pathological payload can't OOM the map. */
const MAX_PATH_PTS = 50000;

function toLocation(raw: BridgeLocation | null | undefined): LocationPoint | null {
  if (!raw || typeof raw !== 'object') return null;
  const lat = raw.lat;
  const lng = finite(raw.lng) ? raw.lng : finite(raw.lon) ? (raw.lon as number) : NaN;
  if (!finite(lat) || !finite(lng)) return null;
  return {
    id: typeof raw.id === 'string' ? raw.id : `${lat},${lng}`,
    name: typeof raw.name === 'string' ? raw.name : '',
    address: typeof raw.address === 'string' ? raw.address : '',
    lat: lat as number,
    lng,
  };
}

function toRouteData(raw: BridgeRoute | null | undefined): RouteData | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw.summary && typeof raw.summary === 'object' ? raw.summary : {};
  const coords = (Array.isArray(raw.path) ? raw.path : [])
    .slice(0, MAX_PATH_PTS)
    .map((p) => {
      if (!p || typeof p !== 'object') return null;
      const lat = p.lat;
      const lng = finite(p.lng) ? p.lng : finite(p.lon) ? (p.lon as number) : NaN;
      return finite(lat) && finite(lng) ? { lat: lat as number, lng } : null;
    })
    .filter((c): c is { lat: number; lng: number } => c !== null);
  const lengthInMeters = finite(s.lengthInMeters) ? (s.lengthInMeters as number) : 0;
  const travelTimeInSeconds = finite(s.travelTimeInSeconds) ? (s.travelTimeInSeconds as number) : 0;
  const trafficDelayInSeconds = finite(s.trafficDelayInSeconds) ? (s.trafficDelayInSeconds as number) : 0;
  return {
    id: typeof raw.id === 'string' ? raw.id : `route-${lengthInMeters}-${travelTimeInSeconds}`,
    summary: {
      lengthInMeters,
      travelTimeInSeconds,
      trafficDelayInSeconds,
      departureTime: '',
      arrivalTime: '',
      routeType: 'fastest',
    },
    legs: [{ startLocation: null as unknown as LocationPoint, endLocation: null as unknown as LocationPoint, summary: null as unknown as RouteData['summary'], instructions: [], geometry: { type: 'LineString', coordinates: coords } }],
    geometry: { type: 'LineString', coordinates: coords },
    instructions: [],
  };
}

function post(msg: { type: string; routeId?: string }) {
  try {
    window.ReactNativeWebView?.postMessage(JSON.stringify(msg));
  } catch {
    /* native shell absent (desktop debug) — map still works standalone */
  }
}

/**
 * EmbedMap — the web explore map minus the explore UI, driven by native.
 * Owns the same state ExploreMapView owns (endpoints, routes, style,
 * recenter, tilt) so InteractiveRouteMap behaves identically: same
 * markers, polylines, glow, traffic flow, fit-bounds, retry, style swap.
 */
export default function EmbedMap() {
  const [origin, setOrigin] = useState<LocationPoint | null>(null);
  const [destination, setDestination] = useState<LocationPoint | null>(null);
  const [currentRoute, setCurrentRoute] = useState<RouteData | null>(null);
  const [alternativeRoutes, setAlternativeRoutes] = useState<RouteData[]>([]);
  const [mapStyle, setMapStyle] = useState<MapStyle>('main');
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [tiltOn, setTiltOn] = useState(true);
  // Web parity: useRouteCalculation isCalculating → "Analyzing routes…" overlay.
  const [loading, setLoading] = useState(false);
  const styleControlRef = useRef<{ changeStyle: (style: MapStyle) => void } | null>(null);

  const handleRouteSelect = useCallback((routeId: string) => {
    post({ type: 'route-select', routeId });
  }, []);

  useEffect(() => {
    window.__taranaMapCmd = (cmd: BridgeCommand) => {
      try {
        if (!cmd || typeof cmd !== 'object') return;
        switch (cmd.type) {
          case 'set-route': {
            setOrigin(toLocation(cmd.origin ?? null));
            setDestination(toLocation(cmd.destination ?? null));
            setCurrentRoute(toRouteData(cmd.primary ?? null));
            setAlternativeRoutes(
              Array.isArray(cmd.alternatives)
                ? cmd.alternatives.map(toRouteData).filter((r): r is RouteData => r !== null)
                : []
            );
            break;
          }
          case 'clear':
            setOrigin(null);
            setDestination(null);
            setCurrentRoute(null);
            setAlternativeRoutes([]);
            break;
          case 'recenter':
            setRecenterSignal((n) => n + 1);
            break;
          case 'style':
            if (cmd.style === 'main' || cmd.style === 'satellite') {
              styleControlRef.current?.changeStyle(cmd.style);
            }
            break;
          case 'tilt':
            setTiltOn(cmd.on === true);
            break;
          case 'loading':
            setLoading(cmd.on === true);
            break;
          default:
            break;
        }
      } catch {
        /* malformed bridge payload — never crash the map */
      }
    };
    post({ type: 'embed-ready' });
    return () => {
      delete window.__taranaMapCmd;
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <InteractiveRouteMap
        currentRoute={currentRoute}
        alternativeRoutes={alternativeRoutes}
        trafficConditions={null}
        origin={origin}
        destination={destination}
        waypoints={[]}
        isLoading={loading}
        onRouteSelect={handleRouteSelect}
        currentMapStyle={mapStyle}
        onStyleChange={setMapStyle}
        recenterSignal={recenterSignal}
        tiltOn={tiltOn}
        styleControlRef={styleControlRef}
      />
    </div>
  );
}
