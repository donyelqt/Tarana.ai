"use client"

import { useMemo } from "react";
import SpotlightCard from "./cards/SpotlightCard";
import { rankSpots, spotPool, toSpotCard } from "../utils";

const SuggestedSpots = () => {
  // Live ranking over the real attraction dataset: off-peak spots first
  // (soft bonus, never filtered), deterministic daily rotation for variety.
  // Distances are haversine from Baguio center ("~" = estimate, no GPS here).
  const spots = useMemo(() => {
    const ranked = rankSpots(spotPool());
    const cards = ranked
      .map((a) => toSpotCard(a))
      .filter((c): c is NonNullable<typeof c> => c !== null);
    return cards.slice(0, 3);
  }, []);

  if (spots.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-6 px-1">
        <h2 className="font-medium text-xl text-gray-900">Suggested Spots</h2>
        <p className="text-sm text-gray-500">Optimized for low traffic and crowd</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {spots.map((spot) => (
          <SpotlightCard key={spot.name} {...spot} ctaText="Visit Spot" />
        ))}
      </div>
    </div>
  )
}

export default SuggestedSpots;
