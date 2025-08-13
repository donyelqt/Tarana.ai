import { scheduleMultiDayItinerary, groupActivitiesByPeriod } from '@/lib/heuristicScheduler';
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

export function applyHeuristicScheduling(
  parsed: any, 
  duration: number, 
  similar: VectorSearchResult[]
) {
  if (!parsed || !Array.isArray(parsed.items)) {
    return parsed;
  }

  // Extract activities by day
  const activitiesByDay: any[] = [];
  
  if (duration > 1) {
    // Multi-day itinerary
    const dayMap = new Map<string, any[]>();
    
    for (const item of parsed.items) {
      const dayMatch = item.period.match(/Day (\d+)/i);
      if (dayMatch) {
        const day = parseInt(dayMatch[1], 10);
        if (!dayMap.has(day.toString())) {
          dayMap.set(day.toString(), []);
        }
        if (Array.isArray(item.activities)) {
          dayMap.get(day.toString())!.push(...item.activities);
        }
      } else {
        // Distribute activities across days
        const activities = item.activities || [];
        const activitiesPerDay = Math.ceil(activities.length / duration);
        for (let i = 0; i < duration; i++) {
          const day = i + 1;
          if (!dayMap.has(day.toString())) {
            dayMap.set(day.toString(), []);
          }
          const dayActivities = activities.slice(i * activitiesPerDay, (i + 1) * activitiesPerDay);
          if (dayActivities.length > 0) {
            dayMap.get(day.toString())!.push(...dayActivities);
          }
        }
      }
    }
    
    const days = Array.from(dayMap.keys()).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    for (const day of days) {
      activitiesByDay.push(dayMap.get(day) || []);
    }
  } else {
    // Single day - combine all activities
    const allActivities: any[] = [];
    for (const item of parsed.items) {
      if (Array.isArray(item.activities)) {
        allActivities.push(...item.activities);
      }
    }
    activitiesByDay.push(allActivities);
  }

  // Create vector score map for scheduling
  const vectorScoreMap = similar && similar.length > 0
    ? createVectorScoreMap(
        similar.map(s => ({
          activity_id: s.activity_id,
          similarity: s.similarity,
          metadata: (s.metadata ?? {}) as Record<string, any>,
        }))
      )
    : undefined;
  
  // Apply heuristic scheduling
  const scheduledDays = scheduleMultiDayItinerary(activitiesByDay, {
    startTime: '08:00',
    endTime: '21:00',
    maxActivitiesPerDay: 8
  }, vectorScoreMap);
  
  // Rebuild itinerary with scheduled activities
  const newItems: any[] = [];
  
  scheduledDays.forEach((scheduledActivities, dayIndex) => {
    const dayNumber = dayIndex + 1;
    const periodGroups = groupActivitiesByPeriod(scheduledActivities);
    
    for (const [period, activities] of Object.entries(periodGroups)) {
      if (activities.length > 0) {
        newItems.push({
          period: activitiesByDay.length > 1 ? `Day ${dayNumber} - ${period}` : period,
          activities: activities
        });
      }
    }
  });
  
  parsed.items = newItems;
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