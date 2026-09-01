"use client";

import { useEffect, useRef, useState } from "react";
import { createTomTomMap, calculateOptimalMapView, ZOOM_LEVELS } from "@/lib/integrations/tomtomMapUtils";

type ItineraryActivity = {
  title: string;
  lat?: number;
  lon?: number;
  image?: string;
  desc?: string;
};

interface ItineraryMapProps {
  activities: ItineraryActivity[];
  className?: string;
  height?: string; // e.g. "320px" or "h-80"
}

/**
 * ItineraryMap — polyline-only map for Gala itineraries.
 * Reads N activity lat/lon and renders ordered polyline + N numbered markers.
 * Does NOT reuse InteractiveRouteMap (which requires RouteData legs[].geometry).
 */
export default function ItineraryMap({ activities, className = "", height = "320px" }: ItineraryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const points = activities.filter((a) => typeof a.lat === "number" && typeof a.lon === "number") as Array<Required<Pick<ItineraryActivity, "lat" | "lon">> & ItineraryActivity>;

  useEffect(() => {
    let cancelled = false;
    let map: any = null;

    async function init() {
      if (!containerRef.current) return;
      if (points.length === 0) return;

      const apiKey = (process.env.NEXT_PUBLIC_TOMTOM_API_KEY as string) || (process.env.TOMTOM_API_KEY as string) || "";
      if (!apiKey) {
        setError("TomTom API key missing");
        return;
      }

      try {
        const locs = points.map((p) => ({ lat: p.lat, lng: p.lon }));
        const view = calculateOptimalMapView(locs);

        map = await createTomTomMap({
          apiKey,
          container: containerRef.current!,
          center: view.center,
          zoom: view.zoom,
          style: "main",
          enableTraffic: false,
          enableControls: true,
          worldView: true,
          minZoom: ZOOM_LEVELS.WORLD,
          maxZoom: ZOOM_LEVELS.BUILDING,
        });

        if (cancelled) return;
        mapRef.current = map;

        // Fit bounds to points (with padding)
        if (points.length > 1 && map.fitBounds) {
          const bounds = new (window as any).tt.LngLatBounds();
          points.forEach((p) => bounds.extend([p.lon, p.lat] as any));
          map.fitBounds(bounds, { padding: 40, maxZoom: 15 });
        }

        // Add numbered markers
        markersRef.current.forEach((m) => { try { m.remove(); } catch {} });
        markersRef.current = [];

        points.forEach((p, idx) => {
          const el = document.createElement("div");
          el.className = "itinerary-marker";
          el.style.width = "28px";
          el.style.height = "28px";
          el.style.borderRadius = "9999px";
          el.style.background = "#2563eb";
          el.style.color = "#fff";
          el.style.display = "flex";
          el.style.alignItems = "center";
          el.style.justifyContent = "center";
          el.style.fontSize = "12px";
          el.style.fontWeight = "700";
          el.style.border = "2px solid #fff";
          el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.25)";
          el.textContent = String(idx + 1);

          const marker = new (window as any).tt.Marker({ element: el, anchor: "center" }).setLngLat([p.lon, p.lat] as any).addTo(map);
          markersRef.current.push(marker);
        });

        // Add ordered polyline
        if (points.length > 1) {
          const geojson = {
            type: "Feature" as const,
            geometry: {
              type: "LineString" as const,
              coordinates: points.map((p) => [p.lon, p.lat]),
            },
            properties: {},
          };

          const sourceId = "itinerary-polyline";
          const layerId = "itinerary-polyline-layer";

          // Remove previous if exists (hot reload)
          try { if (map.getLayer(layerId)) map.removeLayer(layerId); } catch {}
          try { if (map.getSource(sourceId)) map.removeSource(sourceId); } catch {}

          map.addSource(sourceId, { type: "geojson", data: geojson });
          map.addLayer({
            id: layerId,
            type: "line",
            source: sourceId,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#2563eb", "line-width": 4, "line-opacity": 0.85 },
          });
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load map");
      }
    }

    init();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => { try { m.remove(); } catch {} });
      markersRef.current = [];
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch {}
        mapRef.current = null;
      }
    };
  }, [points.map((p) => `${p.lat},${p.lon}`).join("|")]);

  if (points.length === 0) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500 ${className}`} style={{ height }}>
        No coordinates to display
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600 ${className}`} style={{ height }}>
        {error}
      </div>
    );
  }

  return <div ref={containerRef} className={`rounded-xl overflow-hidden border border-gray-200 ${className}`} style={{ height, minHeight: height }} />;
}