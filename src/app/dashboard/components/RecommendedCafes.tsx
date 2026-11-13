"use client"

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import SpotlightCard from "./cards/SpotlightCard";
import { rankCafes, toCafeCard } from "../utils";
import { getSavedMeals } from "@/lib/data/supabaseMeals";

export const RecommendedCafes = () => {
  const { data: session, status } = useSession();

  const { data: savedMeals = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["saved-meals", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];
      return await getSavedMeals();
    },
    enabled: !!session?.user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const cafes = useMemo(() => {
    const ranked = rankCafes(savedMeals);
    const cards = ranked
      .map((r) => toCafeCard(r))
      .filter((c): c is NonNullable<typeof c> => c !== null);
    return cards.slice(0, 3);
  }, [savedMeals]);

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-6 px-1">
        <h2 className="font-medium text-xl text-gray-900">Recommended Cafes</h2>
        <p className="text-sm text-gray-500">
          {savedMeals.length > 0 ? "Matched to your tastes" : "From Baguio's cafe guide"}
        </p>
      </div>

      {status === "loading" || isLoading ? (
        <div className="text-sm text-gray-500 px-1" role="status">Finding cafes…</div>
      ) : isError ? (
        <div className="px-1 py-3" role="alert">
          <p className="text-sm text-red-700">We could not load recommended cafes.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-2 min-h-[44px] px-4 rounded-xl border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Retry
          </button>
        </div>
      ) : cafes.length === 0 ? (
        <div className="text-sm text-gray-500 px-1" role="status">No recommended cafes found right now.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cafes.map((cafe) => (
            <SpotlightCard key={cafe.name} {...cafe} ctaText="View Cafe" />
          ))}
        </div>
      )}
    </div>
  )
}

export default RecommendedCafes;
