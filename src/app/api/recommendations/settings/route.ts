import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { handleApiError } from '@/lib/errors/handleApiError';
import { timedHttp } from '@/lib/observability/httpMetrics';
import { logger } from '@/lib/observability/logger';
import { getRequestId } from '@/middleware/requestId';
import { listMeals } from '@/lib/services/mealService';
import type { SavedMeal } from '@/app/saved-meals/data';
import {
  activityToPayload,
  rankCafes,
  rankSpots,
  spotPool,
  toCafeCard,
  toSpotCard,
} from '@/app/dashboard/utils';
import type { SettingsRecommendation } from '@/types/settings-recommendations';

const ROUTE = '/api/recommendations/settings';
const MEAL_TYPES: readonly SavedMeal['mealType'][] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

function toSavedMeals(input: unknown): SavedMeal[] {
  if (!Array.isArray(input)) return [];

  return input.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const meal = row as Record<string, unknown>;
    const cafeName = typeof meal.cafe_name === 'string' ? meal.cafe_name.trim() : '';
    if (!cafeName) return [];

    const rawMealType = typeof meal.meal_type === 'string' ? meal.meal_type : '';
    const mealType = MEAL_TYPES.includes(rawMealType as SavedMeal['mealType'])
      ? (rawMealType as SavedMeal['mealType'])
      : 'Snack';
    const price = typeof meal.price === 'number' && Number.isFinite(meal.price) ? meal.price : 0;
    const goodFor = typeof meal.good_for === 'number' && Number.isFinite(meal.good_for) ? meal.good_for : 1;

    return [{
      id: typeof meal.id === 'string' ? meal.id : '',
      cafeName,
      mealType,
      price,
      goodFor,
      location: typeof meal.location === 'string' ? meal.location : '',
      image: typeof meal.image === 'string' ? meal.image : '',
      menuItems: Array.isArray(meal.menu_items) ? meal.menu_items : [],
    }];
  });
}


function buildRecommendations(savedMeals: SavedMeal[]): SettingsRecommendation[] {
  const rankedCafe = rankCafes(savedMeals, 1)[0];
  const cafeCard = rankedCafe ? toCafeCard(rankedCafe) : null;
  const rankedSpot = rankSpots(spotPool(), new Date(), 1)[0];
  const spotCard = rankedSpot ? toSpotCard(activityToPayload(rankedSpot)) : null;
  const recommendations: SettingsRecommendation[] = [];

  if (cafeCard) {
    recommendations.push({
      kind: 'cafe',
      card: {
        name: cafeCard.name,
        image: cafeCard.image,
        distance: cafeCard.distance,
        time: cafeCard.time,
        ...(cafeCard.traffic ? { traffic: cafeCard.traffic } : {}),
      },
      href: '/tarana-eats',
      action: 'Explore cafe',
      context: rankedCafe?.matchedOn.length ? 'Taste match' : 'Popular cafe',
    });
  }

  if (spotCard) {
    recommendations.push({
      kind: 'spot',
      card: {
        name: spotCard.name,
        image: spotCard.image,
        distance: spotCard.distance,
        time: spotCard.time,
        ...(spotCard.traffic ? { traffic: spotCard.traffic } : {}),
      },
      href: '/tarana-explore',
      action: 'Explore spot',
      context: spotCard.traffic ? 'Good timing' : 'Baguio favorite',
    });
  }

  return recommendations;
}

export const GET = withAuth(async (request: NextRequest, userId: string) => {
  return timedHttp(ROUTE, 'GET', async () => {
    try {
      let savedMeals: SavedMeal[] = [];
      let personalizationError = false;

      try {
        savedMeals = toSavedMeals(await listMeals(userId));
      } catch (error) {
        personalizationError = true;
        logger.warn('Settings recommendation personalization unavailable', {
          entryPoint: ROUTE,
          errorName: error instanceof Error ? error.name : 'UnknownError',
        }, getRequestId(request));
      }

      return NextResponse.json({
        success: true,
        personalized: !personalizationError && savedMeals.length > 0,
        personalizationError,
        recommendations: buildRecommendations(savedMeals),
      });
    } catch (error) {
      return handleApiError(error, request);
    }
  }, (response) => response.status);
});
