"use client"

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import SpotlightCard from "./cards/SpotlightCard";
import { rankCafes, toCafeCard } from "../utils";
import { getSavedMeals } from "@/lib/data/supabaseMeals";

export const RecommendedCafes = () => {
  const { data: session } = useSession();

  // Shared cache with the saved-meals page (same key + fetcher): zero extra
  // fetch when both pages are visited. Ranked by taste overlap with saves;
  // ratings order until saves load.
  const { data: savedMeals = [] } = useQuery({
    queryKey: ["saved-meals", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];
      return await getSavedMeals(session.user.id);
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

  if (cafes.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-6 px-1">
        <h2 className="font-medium text-xl text-gray-900">Recommended Cafes</h2>
        <p className="text-sm text-gray-500">
          {savedMeals.length > 0 ? "Matched to your tastes" : "From Baguio's cafe guide"}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cafes.map((cafe) => (
          <SpotlightCard key={cafe.name} {...cafe} ctaText="View Cafe" />
        ))}
      </div>
    </div>
  )
}

export default RecommendedCafes;
