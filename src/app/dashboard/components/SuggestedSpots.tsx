"use client"

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import SpotlightCard from "./cards/SpotlightCard";
import {
  spotsQueryOptions,
  toSpotCard,
  SPOT_SCOPES,
  REGION_MEMBERS,
  mergeRegionPools,
  type SpotPayload,
  type SpotScopeId,
} from "../utils";
import { getCityCenter } from "@/lib/data/cityConfig";

/** Region ids exist only in this component. Never sent to the route. */
const REGION_ID = 'visayas' as const;
const REGION_LABEL = 'Visayas';
type SpotsView = SpotScopeId | typeof REGION_ID;

const SuggestedSpots = () => {
  const [view, setView] = useState<SpotsView>('baguio');
  const { data: session, status } = useSession();
  void session;
  const authed = status === 'authenticated';

  // Every city (Baguio included) comes from GET /api/spots — Baguio serves
  // the curated pool first plus photo-verified TomTom extras behind it.
  // The region view fires one ordinary per-city query per member; it never
  // sends a region id to the route.
  const citySpots = useQuery({
    ...spotsQueryOptions(view === REGION_ID ? 'baguio' : view, status),
    enabled: authed && view !== REGION_ID,
  });
  const regionBoracay = useQuery({
    ...spotsQueryOptions('boracay', status),
    enabled: authed && view === REGION_ID,
  });
  const regionCebu = useQuery({
    ...spotsQueryOptions('cebu', status),
    enabled: authed && view === REGION_ID,
  });
  const regionElNido = useQuery({
    ...spotsQueryOptions('el_nido', status),
    enabled: authed && view === REGION_ID,
  });

  const { cards, subtitle } = useMemo(() => {
    if (view === REGION_ID) {
      const pools = [
        { city: REGION_MEMBERS[0], spots: regionBoracay.data ?? [] },
        { city: REGION_MEMBERS[1], spots: regionCebu.data ?? [] },
        { city: REGION_MEMBERS[2], spots: regionElNido.data ?? [] },
      ];
      const merged = mergeRegionPools(pools);
      // Each card is ranked from its own member-city center — never recentered.
      const ranked = merged
        .map((p) => {
          const owner = pools.find((pool) => pool.spots.includes(p))?.city ?? 'cebu';
          return toSpotCard(p, getCityCenter(owner));
        })
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .slice(0, 3);
      return { cards: ranked, subtitle: `Top picks across the ${REGION_LABEL}` };
    }
    const label = SPOT_SCOPES.find((s) => s.id === view)?.label ?? view;
    const origin = getCityCenter(view);
    const cards = (citySpots.data ?? [])
      .map((p: SpotPayload) => toSpotCard(p, origin))
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .slice(0, 3);
    return { cards, subtitle: `Top picks in ${label}` };
  }, [view, citySpots.data, regionBoracay.data, regionCebu.data, regionElNido.data]);
  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4 px-1">
        <h2 className="font-medium text-xl text-gray-900">Suggested Spots</h2>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
      <div className="flex gap-2 mb-6 px-1" role="group" aria-label="Destination city">
        {SPOT_SCOPES.map((s) => {
          const active = s.id === view;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={active}
              onClick={() => setView(s.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                active
                  ? 'bg-gradient-to-b from-blue-700 to-blue-500 hover:to-blue-700 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              {s.label}
            </button>
          );
        })}
        <button
          key={REGION_ID}
          type="button"
          aria-pressed={view === REGION_ID}
          onClick={() => setView(REGION_ID)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            view === REGION_ID
              ? 'bg-gradient-to-b from-blue-700 to-blue-500 hover:to-blue-700 text-white border-blue-600'
              : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
          }`}
        >
          {REGION_LABEL}
        </button>
      </div>
      {view === REGION_ID ? (
        regionBoracay.isLoading || regionCebu.isLoading || regionElNido.isLoading ? (
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
