import { createVectorScoreMap } from '@/lib/vectorSearch';
import { sampleItineraryCombined } from '@/app/itinerary-generator/data/itineraryData';
import { VectorSearchResult } from './types';

export function extractAndCleanJSON(text: string): any {
  let cleanedJson = text;

  // Extract from markdown code blocks
  const codeBlockMatch = cleanedJson.match(/```(?:json)?\n?([\s\S]*?)\n?```/i);
  if (codeBlockMatch) {
    cleanedJson = codeBlockMatch[1];
  }

  // Clean comments and trailing commas
  cleanedJson = cleanedJson
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/,\s*([\]}])/g, '$1')
    .trim();

  return JSON.parse(cleanedJson);
}

export function buildTitleToImageLookup() {
  const titleToImage: Record<string, string> = {};
  for (const sec of sampleItineraryCombined.items) {
    for (const act of sec.activities) {
      const img = typeof act.image === "string" ? act.image : (act.image as any)?.src || "";
      if (act.title && img) {
        titleToImage[act.title] = img;
      }
    }
  }
  return titleToImage;
}

export function cleanupActivities(parsed: any, titleToImage: Record<string, string>) {
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.items)) {
    return parsed;
  }

  parsed.items = parsed.items
    .map((period: any) => {
      const cleanedActs = Array.isArray(period.activities)
        ? period.activities
            .filter((act: any) => act.title && act.title.toLowerCase() !== "no available activity")
            .map((act: any) => {
              // Back-fill missing images
              if ((!act.image || act.image === "") && titleToImage[act.title]) {
                act.image = titleToImage[act.title];
              }
              
              // Add metadata if not present
              if (!act.metadata) {
                act.metadata = {};
              }
              
              // Infer activity type from tags
              if (!act.metadata.type && Array.isArray(act.tags)) {
                const tags = act.tags.map((t: string) => t.toLowerCase());
                if (tags.some((t: string) => t.includes('food') || t.includes('culinary') || t.includes('restaurant'))) {
                  act.metadata.type = 'Food';
                } else if (tags.some((t: string) => t.includes('nature') || t.includes('park') || t.includes('outdoor'))) {
                  act.metadata.type = 'Nature';
                } else if (tags.some((t: string) => t.includes('museum') || t.includes('art') || t.includes('culture'))) {
                  act.metadata.type = 'Museum';
                } else if (tags.some((t: string) => t.includes('shopping') || t.includes('market'))) {
                  act.metadata.type = 'Shopping';
                } else if (tags.some((t: string) => t.includes('night') || t.includes('bar') || t.includes('entertainment'))) {
                  act.metadata.type = 'Nightlife';
                }
              }
              
              return act;
            })
        : [];
      return { ...period, activities: cleanedActs };
    })
    .filter((period: any) => Array.isArray(period.activities) && period.activities.length > 0);

  return parsed;
}

export function attemptJSONSalvage(text: string): any {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("No valid JSON structure found");
  }
  
  const potentialJson = text.slice(firstBrace, lastBrace + 1);
  const parsed = JSON.parse(potentialJson);

  if (parsed && typeof parsed === "object" && Array.isArray(parsed.items)) {
    parsed.items = parsed.items
      .map((period: any) => {
        const filteredActivities = Array.isArray(period.activities)
          ? period.activities.filter((act: any) => act.title && act.title.toLowerCase() !== "no available activity")
          : [];
        return { ...period, activities: filteredActivities };
      })
      .filter((period: any) => period.activities.length > 0);
  }

  return parsed;
}