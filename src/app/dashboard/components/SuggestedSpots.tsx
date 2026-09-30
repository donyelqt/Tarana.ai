"use client"

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import SpotlightCard from "./cards/SpotlightCard";
import {
  spotsQueryOptions,
  toSpotCard,
  SPOT_SCOPES,
  REGION_MEMBERS,
  LUZON_MEMBERS,
  mergeRegionPools,
  regionCardKey,
  type SpotPayload,
  type SpotScopeId,
} from "../utils";
import { getCityCenter } from "@/lib/data/cityConfig";

/** Region ids exist only in this component. Never sent to the route. */
const VISAYAS_ID = 'visayas' as const;
const VISAYAS_LABEL = 'Visayas';
const LUZON_ID = 'luzon' as const;
const LUZON_LABEL = 'Luzon';
type RegionId = typeof VISAYAS_ID | typeof LUZON_ID;
type SpotsView = SpotScopeId | RegionId;

const REGION_META: Record<RegionId, { members: readonly string[]; label: string }> = {
  [VISAYAS_ID]: { members: REGION_MEMBERS, label: VISAYAS_LABEL },
  [LUZON_ID]: { members: LUZON_MEMBERS, label: LUZON_LABEL },
};

function isRegionView(view: SpotsView): view is RegionId {
  return view === VISAYAS_ID || view === LUZON_ID;
}

/**
 * Cities and regions share one list so the row is a single carousel instead
 * of two parallel maps. Order is the ship order: cities, then regions.
 */
const PILLS: ReadonlyArray<{ id: SpotsView; label: string }> = [
  ...SPOT_SCOPES,
  ...([VISAYAS_ID, LUZON_ID] as const).map((id) => ({ id, label: REGION_META[id].label })),
];

const pillClass = (active: boolean): string =>
  `shrink-0 snap-start touch-manipulation px-4 py-1.5 rounded-full text-sm font-medium border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
    active
      ? 'bg-gradient-to-b from-blue-700 to-blue-500 hover:to-blue-700 text-white border-blue-600'
      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
  }`;

const SuggestedSpots = () => {
  const [view, setView] = useState<SpotsView>('baguio');
  const pillsRef = useRef<HTMLDivElement>(null);
  const { data: session, status } = useSession();
  void session;
  const authed = status === 'authenticated';

  // Every city (Baguio included) comes from GET /api/spots — Baguio serves
  // the curated pool first plus photo-verified TomTom extras behind it.
  // Region views fire one ordinary per-city query per member; they never
  // send a region id to the route.
  const isRegion = isRegionView(view);
  const citySpots = useQuery({
    ...spotsQueryOptions(isRegion ? 'baguio' : view, status),
    enabled: authed && !isRegion,
  });
  const regionBoracay = useQuery({
    ...spotsQueryOptions('boracay', status),
    enabled: authed && view === VISAYAS_ID,
  });
  const regionCebu = useQuery({
    ...spotsQueryOptions('cebu', status),
    enabled: authed && view === VISAYAS_ID,
  });
  const regionBaguio = useQuery({
    ...spotsQueryOptions('baguio', status),
    enabled: authed && view === LUZON_ID,
  });
  const regionManila = useQuery({
    ...spotsQueryOptions('manila', status),
    enabled: authed && view === LUZON_ID,
  });
  const { cards, subtitle, keys } = useMemo(() => {
    if (isRegionView(view)) {
      const meta = REGION_META[view];
      const feeds: Record<string, SpotPayload[] | null | undefined> = {
        boracay: regionBoracay.data,
        cebu: regionCebu.data,
        baguio: regionBaguio.data,
        manila: regionManila.data,
      };
      const pools = meta.members.map((city) => ({ city, spots: feeds[city] ?? [] }));
      const merged = mergeRegionPools(pools);
      // toSpotCard returns RecommendationCard (no poolCity); the region key
      // is computed from the merged payload BEFORE ranking, so the render
      // never depends on a field the card type omits.
      const ranked = merged
        .map((p) => ({ card: toSpotCard(p, getCityCenter(p.poolCity)), key: regionCardKey(p.poolCity, p) }))
        .filter((entry): entry is { card: NonNullable<typeof entry.card>; key: string } => entry.card !== null)
        .slice(0, 3);
      return {
        cards: ranked.map((entry) => entry.card),
        keys: ranked.map((entry) => entry.key),
        subtitle: `Top picks across ${meta.label}`,
      };
    }
    const label = SPOT_SCOPES.find((s) => s.id === view)?.label ?? view;
    const origin = getCityCenter(view);
    const cards = (citySpots.data ?? [])
      .map((p: SpotPayload) => toSpotCard(p, origin))
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .slice(0, 3);
    return { cards, subtitle: `Top picks in ${label}`, keys: cards.map((c) => c.name) };
  }, [view, citySpots.data, regionBoracay.data, regionCebu.data, regionBaguio.data, regionManila.data]);

  // Mobile renders the pills as a horizontal carousel, so the last pills
  // (Visayas, Luzon) start outside the visible area. Bring the active pill
  // into view when the selection changes. When the row does not overflow
  // (desktop) scrollWidth === clientWidth and this does nothing.
  useEffect(() => {
    const track = pillsRef.current;
    if (!track || track.scrollWidth <= track.clientWidth) return;
    const pill = track.querySelector<HTMLElement>(`[data-spot-pill="${view}"]`);
    if (!pill) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    pill.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest', inline: 'start' });
  }, [view]);
  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4 px-1">
        <h2 className="font-medium text-xl text-gray-900">Suggested Spots</h2>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
      {/*
        Mobile: horizontal scroll-snap carousel. Negative margin + matching
        padding bleeds the scroller to the screen edge so pills are not cut
        mid-word, while px-8 keeps them aligned with the card grid below.
        scroll-pl-8 makes snap and scrollIntoView respect that same inset.
        md+ restores the original single in-flow row (no bleed, px-1).
        py-1 gives the focus ring vertical room: overflow-x-auto forces
        overflow-y to auto, which would otherwise clip the 2px ring.
      */}
      <div
        ref={pillsRef}
        role="group"
        aria-label="Destination city"
        className="-mx-8 mb-5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-8 py-1 scroll-pl-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:mb-6 md:px-1 md:scroll-pl-1"
      >
        {PILLS.map((pill) => (
          <button
            key={pill.id}
            type="button"
            data-spot-pill={pill.id}
            aria-pressed={pill.id === view}
            onClick={() => setView(pill.id)}
            className={pillClass(pill.id === view)}
          >
            {pill.label}
          </button>
        ))}
      </div>
      {isRegion ? (
        (view === VISAYAS_ID
          ? regionBoracay.isLoading || regionCebu.isLoading
          : regionBaguio.isLoading || regionManila.isLoading) ? (
          <div className="text-sm text-gray-500 px-1" role="status">Finding spots…</div>
        ) : cards.length === 0 ? (
          <div className="text-sm text-gray-500 px-1" role="status">
            No spots found yet — try Baguio.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((spot, i) => (
              <SpotlightCard key={keys[i] ?? spot.name} {...spot} ctaText="Visit Spot" />
            ))}
          </div>
        )
      ) : !citySpots.data ? (
        <div className="text-sm text-gray-500 px-1" role="status">Finding spots…</div>
      ) : cards.length === 0 ? (
        <div className="text-sm text-gray-500 px-1" role="status">
          No spots found yet — try Baguio.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((spot) => (
            <SpotlightCard key={spot.name} {...spot} ctaText="Visit Spot" />
          ))}
        </div>
      )}
    </div>
  )
}

export default SuggestedSpots;
