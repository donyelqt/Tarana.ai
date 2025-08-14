import { WEATHER_TAG_FILTERS } from './weather';
import { VectorSearchResult } from './types';
import { searchSimilarActivities } from '@/lib/vectorSearch';

export async function buildActivitiesFromVector(
  prompt: string,
  interests: string[] | undefined,
  budgetCategory: string | null,
  paxCategory: string | null,
  weatherType: string,
): Promise<VectorSearchResult[]> {
  let similar: VectorSearchResult[] = [];

  let enhancedPrompt = prompt;
  if (interests && Array.isArray(interests) && !interests.includes('Random')) {
    enhancedPrompt += ' ' + interests.join(' ');
  }
  if (budgetCategory) {
    enhancedPrompt += ' ' + budgetCategory;
  }
  if (paxCategory) {
    enhancedPrompt += ' ' + paxCategory;
  }

  const queries: string[] = [enhancedPrompt];
  if (interests && Array.isArray(interests) && !interests.includes('Random')) {
    interests.forEach((interest) => {
      queries.push(`${prompt} ${interest} ${weatherType === 'rainy' ? 'indoor' : ''}`);
    });
  }

  const batchResults = await Promise.all(queries.map((q) => searchSimilarActivities(q, 30)));

  const seenIds = new Set<string>();
  batchResults.forEach((results) => {
    if (Array.isArray(results)) {
      results.forEach((item: any) => {
        if (item.activity_id && !seenIds.has(item.activity_id)) {
          seenIds.add(item.activity_id);
          similar.push(item);
        }
      });
    }
  });

  // Apply weather + interest filters before scoring
  const allowedWeatherTags: string[] = (WEATHER_TAG_FILTERS as any)[weatherType] ?? [];
  const interestSet = new Set(
    interests && Array.isArray(interests) && !interests.includes('Random') ? interests : []
  );

  // Priority queue via simple top-N sorting
  const scored = similar.map((s: any) => {
    const tags: string[] = s.metadata?.tags || [];
    let score = s.similarity * 10;

    if (interestSet.size > 0) {
      const interestMatches = tags.filter((t: string) => interestSet.has(t)).length;
      score += (interestMatches / Math.max(1, interestSet.size)) * 5;
    }

    if (allowedWeatherTags.length > 0) {
      const weatherMatches = tags.filter((t: string) => allowedWeatherTags.includes(t)).length;
      score += weatherMatches * 2;
    }

    return { ...s, score } as VectorSearchResult;
  });

  // Sort by score desc
  scored.sort((a, b) => (b.score || 0) - (a.score || 0));

  // Final filtering and diversity control
  const filtered: VectorSearchResult[] = [];
  for (const s of scored) {
    const tags: string[] = s.metadata?.tags || [];
    const interestMatch = interestSet.size === 0 || tags.some((t) => interestSet.has(t));
    const weatherMatch = allowedWeatherTags.length === 0 || tags.some((t) => allowedWeatherTags.includes(t));
    if ((s.score || 0) < 5) continue;

    const activityType = s.metadata?.type || 'unknown';
    if (activityType === 'Food') {
      const foodCount = filtered.filter((a) => a.metadata?.type === 'Food').length;
      if (foodCount > scored.length * 0.3) continue;
    }

    if (interestMatch && weatherMatch) {
      filtered.push(s);
    }
  }

  // Preprocess durations
  filtered.forEach((activity: any) => {
    if (!activity.metadata) activity.metadata = {};
    if (!activity.metadata.duration) {
      const type = activity.metadata.type?.toLowerCase() || '';
      if (type.includes('food')) activity.metadata.duration = 90;
      else if (type.includes('museum')) activity.metadata.duration = 120;
      else if (type.includes('nature') || type.includes('park')) activity.metadata.duration = 120;
      else if (type.includes('shopping')) activity.metadata.duration = 90;
      else activity.metadata.duration = 60;
    }
  });

  return filtered;
}

export function toSampleItineraryFromVector(results: VectorSearchResult[]) {
  if (!results || results.length === 0) return null;
  return {
    title: 'Vector Suggestions',
    subtitle: 'Activities matched from vector search',
    items: [
      {
        period: 'Anytime',
        activities: results.map((s: any) => ({
          image: s.metadata?.image || '',
          title: s.metadata?.title || s.activity_id,
          time: s.metadata?.time || '',
          desc: s.metadata?.desc || '',
          tags: s.metadata?.tags || [],
        })),
      },
    ],
  } as any;
}