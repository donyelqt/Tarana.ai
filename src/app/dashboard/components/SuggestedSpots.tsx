"use client"

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import SpotlightCard from "./cards/SpotlightCard";
import {
  activityToPayload,
  rankSpots,
  spotPool,
  spotsQueryOptions,
  spotsSubtitle,
  toSpotCard,
  SPOT_SCOPES,
  type SpotPayload,
  type SpotScopeId,
} from "../utils";
import { getCityCenter } from "@/lib/data/cityConfig";

const SuggestedSpots = () => {
  const [city, setCity] = useState<SpotScopeId>('baguio');
  const { data: session, status } = useSession();
  void session;

  // Baguio stays fully local (instant, offline-safe, curated pool).
  // Other cities come from GET /api/spots (live TomTom search, hourly cache).
  const { data: remoteSpots } = useQuery({
    ...spotsQueryOptions(city, status),
    enabled: status === 'authenticated' && city !== 'baguio',
  });

  const { cards, subtitle } = useMemo(() => {
    if (city === 'baguio') {
      const ranked = rankSpots(spotPool());
      const cards = ranked
        .map((a) => toSpotCard(activityToPayload(a)))
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .slice(0, 3);
      return { cards, subtitle: spotsSubtitle(ranked) };
    }
    const label = SPOT_SCOPES.find((s) => s.id === city)?.label ?? city;
    const origin = getCityCenter(city);
    const cards = (remoteSpots ?? [])
      .map((p: SpotPayload) => toSpotCard(p, origin))
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .slice(0, 3);
    return { cards, subtitle: `Top picks in ${label}` };
  }, [city, remoteSpots]);

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4 px-1">
        <h2 className="font-medium text-xl text-gray-900">Suggested Spots</h2>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
      <div className="flex gap-2 mb-6 px-1" role="group" aria-label="Destination city">
        {SPOT_SCOPES.map((s) => {
          const active = s.id === city;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={active}
              onClick={() => setCity(s.id)}
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
      </div>
      {city !== 'baguio' && !remoteSpots ? (
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
