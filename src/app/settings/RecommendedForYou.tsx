'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Clock3, Compass, MapPin, RefreshCw, Utensils } from 'lucide-react';
import { useSession } from 'next-auth/react';
import type {
  SettingsRecommendation,
  SettingsRecommendationsResponse,
} from '@/types/settings-recommendations';

function RecommendationRow({ recommendation }: { recommendation: SettingsRecommendation }) {
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
  const { data: response, isFetching, isError, refetch } = useQuery<SettingsRecommendationsResponse>({
    queryKey: ['settings-recommendations', userId],
    queryFn: async () => {
      if (!userId) {
        return { success: true, personalized: false, recommendations: [] };
      }

      const result = await fetch('/api/recommendations/settings', {
        headers: { Accept: 'application/json' },
      });
      const body = (await result.json().catch(() => null)) as
        | (Partial<SettingsRecommendationsResponse> & { error?: string })
        | null;

      if (!result.ok || body?.success !== true || !Array.isArray(body.recommendations)) {
        throw new Error(body?.error || 'Failed to load recommendations');
      }

      return body as SettingsRecommendationsResponse;
    },
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const recommendations = response?.recommendations ?? [];
  const hasSavedMeals = response?.personalized ?? false;
  const personalizationError = response?.personalizationError ?? false;
  const showPersonalizationError = isError || personalizationError;
  const hasTasteMatch = recommendations.some(
    (recommendation) => recommendation.kind === 'cafe' && recommendation.context === 'Taste match'
  );
  const statusText = showPersonalizationError
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

      {showPersonalizationError && (
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
