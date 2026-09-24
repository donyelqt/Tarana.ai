'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Clock3, Compass, MapPin, RefreshCw, Utensils } from 'lucide-react';
import { useSession } from 'next-auth/react';
import {
  activityToPayload,
  rankCafes,
  rankSpots,
  spotPool,
  toCafeCard,
  toSpotCard,
  type RecommendationCard,
} from '@/app/dashboard/utils';
import { getSavedMeals } from '@/lib/data/supabaseMeals';

type Recommendation = {
  kind: 'cafe' | 'spot';
  card: RecommendationCard;
  href: string;
  action: string;
  context: string;
};

function RecommendationRow({ recommendation }: { recommendation: Recommendation }) {
  const [imageFailed, setImageFailed] = useState(false);
  const { card, kind, href, action, context } = recommendation;
  const Icon = kind === 'cafe' ? Utensils : Compass;

  return (
    <Link
      href={href}
      aria-label={`${action}: ${card.name}`}
      className="group flex min-w-0 items-center gap-3 rounded-2xl border border-gray-100 p-3 transition-colors hover:border-blue-200 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      <div className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-xl bg-blue-50">
        {card.image && !imageFailed ? (
          <Image
            src={card.image}
            alt=""
            fill
            sizes="76px"
            className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-blue-400" aria-hidden="true">
            <Icon size={24} strokeWidth={1.75} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-blue-700">
          <Icon size={13} strokeWidth={2} aria-hidden="true" />
          <span className="truncate">{context}</span>
        </div>
        <h4 className="truncate text-sm font-semibold text-gray-900">{card.name}</h4>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} aria-hidden="true" />
            {card.distance}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock3 size={12} aria-hidden="true" />
            {card.time}
          </span>
          {card.traffic && (
            <span className={card.traffic === 'High' ? 'text-amber-700' : 'text-emerald-700'}>
              {card.traffic === 'High' ? 'Busy right now' : 'Less busy now'}
            </span>
          )}
        </div>
      </div>
      <ArrowUpRight
        size={18}
        className="shrink-0 text-gray-400 transition-colors group-hover:text-blue-600 motion-reduce:transform-none"
        aria-hidden="true"
      />
    </Link>
  );
}

export default function RecommendedForYou() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const { data: savedMeals = [], isFetching, isError, refetch } = useQuery({
    queryKey: ['saved-meals', userId],
    queryFn: async () => {
      if (!userId) return [];
      return await getSavedMeals();
    },
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const recommendations = useMemo<Recommendation[]>(() => {
    const rankedCafe = rankCafes(savedMeals, 1)[0];
    const cafeCard = rankedCafe ? toCafeCard(rankedCafe) : null;
    const rankedSpot = rankSpots(spotPool(), new Date(), 1)[0];
    const spotCard = rankedSpot ? toSpotCard(activityToPayload(rankedSpot)) : null;

    return [
      cafeCard && {
        kind: 'cafe' as const,
        card: cafeCard,
        href: '/tarana-eats',
        action: 'Explore cafe',
        context: rankedCafe.matchedOn.length > 0 ? 'Taste match' : 'Popular cafe',
      },
      spotCard && {
        kind: 'spot' as const,
        card: spotCard,
        href: '/tarana-explore',
        action: 'Explore spot',
        context: spotCard.traffic ? 'Good timing' : 'Baguio favorite',
      },
    ].filter((recommendation): recommendation is Recommendation => recommendation !== null && recommendation !== undefined);
  }, [savedMeals]);

  const hasSavedMeals = savedMeals.length > 0;
  const hasTasteMatch = recommendations.some(
    (recommendation) => recommendation.kind === 'cafe' && recommendation.context === 'Taste match'
  );
  const statusText = isError
    ? 'Showing popular picks — saved meals could not load.'
    : isFetching && !hasSavedMeals
      ? 'Personalizing picks from your saved meals…'
      : hasSavedMeals
        ? hasTasteMatch
          ? 'Matched to your saved meals'
          : 'Inspired by your saved meals'
        : 'Popular Baguio picks to start your next plan';

  return (
    <section
      aria-labelledby="recommended-for-you-heading"
      aria-busy={isFetching}
      className="rounded-3xl border border-gray-200/60 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)]"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="recommended-for-you-heading" className="text-lg font-semibold text-gray-900">
            Recommended for you
          </h2>
          <p className="mt-1 text-sm text-gray-600" aria-live="polite">
            {statusText}
          </p>
        </div>
        {isFetching && (
          <RefreshCw size={16} className="mt-1 shrink-0 animate-spin text-blue-600 motion-reduce:animate-none" aria-hidden="true" />
        )}
      </div>

      {isError && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900" role="status">
          <span>Personalization is temporarily unavailable.</span>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Retry
          </button>
        </div>
      )}

      {recommendations.length > 0 ? (
        <div className="space-y-3">
          {recommendations.map((recommendation) => (
            <RecommendationRow key={`${recommendation.kind}-${recommendation.card.name}`} recommendation={recommendation} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-5 text-center">
          <Compass size={22} className="mx-auto text-gray-400" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-gray-900">No recommendations yet</p>
          <p className="mt-1 text-sm text-gray-600">Start an itinerary to shape picks around your trip.</p>
          <Link
            href="/itinerary-generator"
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Build an itinerary
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  );
}
