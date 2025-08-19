import { GoogleGenerativeAI } from "@google/generative-ai";
import { sampleItineraryCombined, taranaai } from "@/app/itinerary-generator/data/itineraryData";

// Utilities for itinerary post-processing

// Function to check for duplicate activities across days
export function removeDuplicateActivities(parsedItinerary: any) {
  if (!parsedItinerary || !parsedItinerary.items || !Array.isArray(parsedItinerary.items)) {
    return parsedItinerary;
  }
  const seenActivities = new Set<string>();
  const result = {
    ...parsedItinerary,
    items: parsedItinerary.items.map((day: any) => {
      if (!day.activities || !Array.isArray(day.activities)) return day;
      return {
        ...day,
        activities: day.activities.filter((activity: any) => {
          const title = activity?.title;
          if (!title || typeof title !== 'string') return false;
          const key = title.toLowerCase();
          if (seenActivities.has(key)) return false;
          seenActivities.add(key);
          return true;
        })
      };
    })
  };
  return result;
}

// Helpers to organize itinerary by exact duration with Morning/Afternoon/Evening buckets
const inferSlot = (label: string) => {
  const l = (label || '').toLowerCase();
  if (/morning|\bam\b/.test(l)) return 'Morning';
  if (/afternoon|\bpm\b/.test(l)) return 'Afternoon';
  if (/evening|night/.test(l)) return 'Evening';
  return 'Flexible';
};


export async function ensureFullItinerary(
  itinerary: any,
  userPrompt: string,
  durationDays: number,
  model: any,
  peakHoursContext: string
): Promise<any> {
  const dayActivities: { [key: string]: any[] } = {};
  for (const item of itinerary.items) {
    const day = item.period.split(" - ")[0];
    if (!dayActivities[day]) {
      dayActivities[day] = [];
    }
    dayActivities[day].push(...item.activities);
  }

  const missingDays = Array.from({ length: durationDays }, (_, i) => `Day ${i + 1}`)
    .filter(day => !dayActivities[day] || dayActivities[day].length === 0);

  if (missingDays.length > 0) {
    const guidance = `You are an itinerary planner for Baguio. The user wants a ${durationDays}-day trip. The current itinerary is missing a full plan for the following days: ${missingDays.join(", ")}. Please generate a detailed plan for these specific days, with distinct activities for morning, afternoon, and evening. Ensure the output is in JSON format with a root object containing an "items" array, where each item has "period" (e.g., "Day X - Morning") and "activities" array.`;

    const resp = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: `${guidance}\n\nUser prompt: ${userPrompt}` }] }],
    });

    const text = resp.response?.text() ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const generatedItinerary = JSON.parse(match[0]);
        if (generatedItinerary && Array.isArray(generatedItinerary.items)) {
          // Remove the empty day placeholders
          itinerary.items = itinerary.items.filter((item: any) => {
            const day = item.period.split(" - ")[0];
            return !missingDays.includes(day);
          });
          // Add the newly generated days
          itinerary.items.push(...generatedItinerary.items);
        }
      } catch (e) {
        console.error("Failed to parse generated itinerary for missing days:", e);
      }
    }
  }

  // Find all empty periods and ask the AI to generate reasons for them in a single batch.
  const emptyPeriods = itinerary.items.filter((item: any) => !item.activities || item.activities.length === 0);

  if (emptyPeriods.length > 0) {
    const reasonPrompt = `
      You are an expert travel assistant. For the following user trip request, analyze why no activities are recommended for certain time slots and provide a clear, contextual reason for EACH empty slot. Consider the following factors:
      - Time of day (morning/afternoon/evening)
      - Weather conditions if mentioned
      - User's stated interests and preferences
      - Duration of the trip
      - Common travel wisdom (e.g., rest periods, meal times, travel time)
      - Activities already scheduled for that day
      - Current traffic conditions: ${peakHoursContext}

      USER TRIP REQUEST: "${userPrompt}"

      IMPORTANT: You MUST provide a reason for EVERY empty time slot listed below. Each reason should be specific to that particular time slot and day. Consider the following for each empty slot:
      - Time of day (morning/afternoon/evening)
      - Activities before/after this slot
      - Realistic travel and rest times
      - Local customs (e.g., siesta time, meal times)

      EMPTY SLOTS THAT NEED REASONS:
      ${emptyPeriods.map((p: any) => `- ${p.period}`).join('\n')}

      RETURN FORMAT: A JSON object where keys are the period names (e.g., "Day 2 - Evening") and values are the generated reasons.
      
      EXAMPLE RESPONSE FOR 4-DAY ITINERARY:
      {
        "Day 1 - Evening": "Evening left open to allow for a relaxed dinner and recovery after travel. The nearby Session Road offers many dining options within walking distance.",
        "Day 2 - Evening": "No evening activities suggested to allow for rest after a full day of exploring. Consider visiting a local café or enjoying the hotel's amenities.",
        "Day 3 - Evening": "Evening kept free for packing and preparing for departure tomorrow. You might want to revisit your favorite spots or do some last-minute souvenir shopping.",
        "Day 4 - Morning": "Morning left open for a relaxed breakfast and final preparations before checking out. Consider visiting a nearby café to enjoy your last moments in the city.",
        "Day 4 - Afternoon": "Afternoon kept free for travel to your next destination. Ensure you have all your belongings and have checked out of your accommodation.",
        "Day 4 - Evening": "Evening slot falls after your scheduled departure. Safe travels!"
      }
      
      Now provide reasons for ALL the empty slots listed above. Make sure to include EVERY slot in your response.
    `;

    try {
      const result = await model.generateContent(reasonPrompt);
      const text = result.response.text();
      const reasonsJson = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
      const reasons = JSON.parse(reasonsJson);

      // Add the AI-generated reasons back to the itinerary.
      itinerary.items.forEach((item: any) => {
        if (reasons[item.period]) {
          item.reason = reasons[item.period];
        }
      });

    } catch (error) {
      console.error("Failed to generate AI reasons for empty slots:", error);
      // As a fallback, add a generic reason if the AI fails.
      itinerary.items.forEach((item: any) => {
        if (!item.activities || item.activities.length === 0) {
          item.reason = "This time is intentionally left open for you to relax or explore spontaneously.";
        }
      });
    }
  }

  return itinerary;
}

export function organizeItineraryByDays(it: any, days: number | null) {
  if (!days || !it || !Array.isArray(it.items) || days <= 0) return it;
  // Collect all activities by inferred slot
  const pool: Record<string, any[]> = { Morning: [], Afternoon: [], Evening: [], Flexible: [] };
  for (const period of it.items) {
    const slot = inferSlot(period?.period || '');
    const acts = Array.isArray(period?.activities) ? period.activities : [];
    for (const a of acts) {
      if (!a?.title || a.title.toLowerCase() === 'no available activity') continue;
      pool[slot].push(a);
    }
  }
  // Prepare day buckets
  const daysBuckets = Array.from({ length: days }, () => ({ Morning: [] as any[], Afternoon: [] as any[], Evening: [] as any[] }));
  const distribute = (slot: 'Morning'|'Afternoon'|'Evening', items: any[]) => {
    let di = 0;
    for (const item of items) {
      daysBuckets[di][slot].push(item);
      di = (di + 1) % daysBuckets.length;
    }
  };
  // Distribute fixed slots round-robin
  distribute('Morning', pool.Morning);
  distribute('Afternoon', pool.Afternoon);
  distribute('Evening', pool.Evening);
  // Place flexible items into the slot with the fewest activities per day, preferring Afternoon then Morning then Evening
  for (const flex of pool.Flexible) {
    let bestDay = 0; let bestSlot: 'Afternoon'|'Morning'|'Evening' = 'Afternoon'; let bestCount = Infinity;
    for (let d = 0; d < daysBuckets.length; d++) {
      const order: Array<'Afternoon'|'Morning'|'Evening'> = ['Afternoon','Morning','Evening'];
      for (const s of order) {
        const count = daysBuckets[d][s].length;
        if (count < bestCount) { bestCount = count; bestDay = d; bestSlot = s; }
      }
    }
    daysBuckets[bestDay][bestSlot].push(flex);
  }
  // Build new items: Day N - Morning/Afternoon/Evening, drop empty periods
  const newItems: any[] = [];
  for (let i = 0; i < daysBuckets.length; i++) {
    const dayNum = i + 1;
    const slots: Array<'Morning'|'Afternoon'|'Evening'> = ['Morning','Afternoon','Evening'];
    for (const s of slots) {
      const acts = daysBuckets[i][s];
      // Always create a period for each slot, even if empty.
      // The ensureFullItinerary function will handle filling the gaps.
      newItems.push({ period: `Day ${dayNum} - ${s}`, activities: acts });
    }
  }
  return { ...it, items: newItems };
}

/**
 * Get the correct image URL for an activity title by searching directly in itineraryData.ts
 * Falls back to the vector database image if no match exists
 */
export function getActivityImage(title: string, fallbackImage?: string): any {
  const canonicalActivity = sampleItineraryCombined.items
    .flatMap(section => section.activities)
    .find(act => act.title.toLowerCase() === title.toLowerCase());
  
  return canonicalActivity?.image || fallbackImage || taranaai; // Use taranaai as final fallback
}

/**
 * Validate that an activity exists in our canonical data and return the validated activity
 * with correct image URL from local imports
 */
export function validateAndEnrichActivity(activity: any): any | null {
  // Check if the activity exists in our canonical sample data
  const canonicalActivity = sampleItineraryCombined.items
    .flatMap(section => section.activities)
    .find(act => act.title.toLowerCase() === activity.title?.toLowerCase());
  
  if (!canonicalActivity) {
    console.warn(`Activity "${activity.title}" not found in canonical data, excluding from itinerary`);
    return null;
  }
  
  // Return enriched activity with correct local image
  return {
    ...activity,
    image: getActivityImage(activity.title, activity.image),
    // Ensure we use canonical data for consistency
    desc: canonicalActivity.desc,
    tags: canonicalActivity.tags,
    peakHours: canonicalActivity.peakHours,
    time: canonicalActivity.time
  };
}

export async function processItinerary(parsed: any, prompt: string, durationDays: number | null, model: any, peakHoursContext: string) {
  let processed = removeDuplicateActivities(parsed);
  processed = organizeItineraryByDays(processed, durationDays);
  if (durationDays && model) {
    processed = await ensureFullItinerary(processed, prompt, durationDays, model, peakHoursContext);
  }

  // Final cleanup and validation pass.
  if (processed && typeof processed === "object" && Array.isArray((processed as any).items)) {
    const seenActivities = new Set<string>();
    (processed as any).items = (processed as any).items
      .map((period: any) => {
        if (!period.activities || !Array.isArray(period.activities)) {
          period.activities = [];
        }

        const validatedActivities = period.activities
          .map((act: any) => validateAndEnrichActivity(act)) // Validate every activity
          .filter((act: any): act is any => {
            if (!act || !act.title || act.title.toLowerCase() === "no available activity") {
              return false; // Filter out nulls and placeholders
            }
            if (seenActivities.has(act.title)) {
              return false; // Filter out duplicates
            }
            seenActivities.add(act.title);
            return true;
          });

        const finalPeriod = { ...period, activities: validatedActivities };

        // If a period is empty and has no reason, add a default one.
        if (finalPeriod.activities.length === 0 && !finalPeriod.reason) {
          finalPeriod.reason = "This time is intentionally left open for you to relax or explore spontaneously.";
        }
        
        return finalPeriod;
      })
  }
  
  return processed;
}
