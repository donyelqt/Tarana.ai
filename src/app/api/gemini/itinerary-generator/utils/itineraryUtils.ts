import { GoogleGenerativeAI } from "@google/generative-ai";
import { taranaai } from "@/app/itinerary-generator/data/itineraryData";
import { extractJson } from "./jsonUtils";
import { isCurrentlyPeakHours } from "@/lib/traffic";
import { supabaseAdmin } from "@/lib/data/supabaseAdmin";

// Utilities for itinerary post-processing

// Function to check for duplicate activities across days
export function removeDuplicateActivities(parsedItinerary: any) {
  if (!parsedItinerary || !parsedItinerary.items || !Array.isArray(parsedItinerary.items)) {
    return parsedItinerary;
  }

  const seenByPeriod = new Map<string, Set<string>>();

  const result = {
    ...parsedItinerary,
    items: parsedItinerary.items.map((period: any, index: number) => {
      if (!period.activities || !Array.isArray(period.activities)) {
        return period;
      }

      const periodKey = typeof period?.period === 'string' ? period.period : `period-${index}`;
      let periodSeen = seenByPeriod.get(periodKey);
      if (!periodSeen) {
        periodSeen = new Set<string>();
        seenByPeriod.set(periodKey, periodSeen);
      }

      const filteredActivities = period.activities.filter((activity: any) => {
        const title = typeof activity?.title === 'string' ? activity.title.trim() : '';
        if (!title) {
          return false;
        }

        const normalized = title.toLowerCase();
        if (periodSeen!.has(normalized)) {
          return false;
        }

        periodSeen!.add(normalized);
        return true;
      });

      return {
        ...period,
        activities: filteredActivities
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
  
  // CRITICAL FIX: Ensure we don't lose activities by collecting all activities first
  const allActivities = [...pool.Morning, ...pool.Afternoon, ...pool.Evening, ...pool.Flexible];
  
  // Prepare day buckets
  const daysBuckets = Array.from({ length: days }, () => ({ Morning: [] as any[], Afternoon: [] as any[], Evening: [] as any[] }));
  
  // Distribute activities across days ensuring all activities are used
  // Morning activities distribution
  pool.Morning.forEach((activity, index) => {
    const dayIndex = index % days;
    daysBuckets[dayIndex].Morning.push(activity);
  });
  
  // Afternoon activities distribution
  pool.Afternoon.forEach((activity, index) => {
    const dayIndex = index % days;
    daysBuckets[dayIndex].Afternoon.push(activity);
  });
  
  // Evening activities distribution
  pool.Evening.forEach((activity, index) => {
    const dayIndex = index % days;
    daysBuckets[dayIndex].Evening.push(activity);
  });
  
  // Flexible activities distribution - distribute evenly across all time slots
  pool.Flexible.forEach((activity, index) => {
    const dayIndex = index % days;
    const slotIndex = Math.floor(index / days) % 3;
    const slots: Array<'Morning'|'Afternoon'|'Evening'> = ['Morning','Afternoon','Evening'];
    const slot = slots[slotIndex];
    daysBuckets[dayIndex][slot].push(activity);
  });

  // Backfill empty slots so each day has at least one activity per period when possible
  if (allActivities.length > 0) {
    let fillerIndex = 0;
    const fillerPool = allActivities.map(activity => ({ ...activity }));

    daysBuckets.forEach(bucket => {
      const slots: Array<'Morning'|'Afternoon'|'Evening'> = ['Morning','Afternoon','Evening'];
      slots.forEach(slot => {
        if (bucket[slot].length === 0 && fillerPool.length > 0) {
          const fallback = fillerPool[fillerIndex % fillerPool.length];
          fillerIndex++;
          bucket[slot].push({ ...fallback });
        }
      });
    });
  }

  // Build new items: Day N - Morning/Afternoon/Evening
  const newItems: any[] = [];
  for (let i = 0; i < daysBuckets.length; i++) {
    const dayNum = i + 1;
    const slots: Array<'Morning'|'Afternoon'|'Evening'> = ['Morning','Afternoon','Evening'];
    for (const s of slots) {
      newItems.push({ period: `Day ${dayNum} - ${s}`, activities: daysBuckets[i][s] });
    }
  }
  
  return { ...it, items: newItems };
}

/**
 * Get the correct image URL for an activity title by searching in Supabase vector database
 * Falls back to the vector database image if no match exists
 */
export async function getActivityImage(title: string, fallbackImage?: string): Promise<any> {
  // Check if we can find the activity in Supabase vector database
  if (!supabaseAdmin) {
    console.error("Supabase admin client is not initialized for getActivityImage.");
    return fallbackImage || taranaai; // Use taranaai as final fallback
  }

  const { data, error } = await supabaseAdmin
    .from('itinerary_embeddings')
    .select('metadata')
    .eq('activity_id', title)
    .single();

  if (error || !data) {
    return fallbackImage || taranaai; // Use taranaai as final fallback
  }

  // Extract image from metadata
  const metadata = data.metadata as Record<string, any>;
  return metadata?.image || fallbackImage || taranaai;
}

/**
 * Validate that an activity exists in our Supabase vector database and return the validated activity
 * with correct image URL from local imports
 */

export async function validateAndEnrichActivity(activity: any): Promise<any | null> {
  // Check if the activity exists in our Supabase vector database
  if (!supabaseAdmin) {
    console.error("Supabase admin client is not initialized for validateAndEnrichActivity.");
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('itinerary_embeddings')
    .select('activity_id, metadata')
    .eq('activity_id', activity.title)
    .single();

  if (error || !data) {
    console.warn(`Activity "${activity.title}" not found in Supabase vector database, excluding from itinerary`);
    return null;
  }

  const canonicalActivity = data.metadata;

  // Check if activity is currently in peak hours
  if (canonicalActivity.peakHours && isCurrentlyPeakHours(canonicalActivity.peakHours)) {
    console.warn(`Activity "${activity.title}" is currently in peak hours (${canonicalActivity.peakHours}), excluding from itinerary`);
    return null;
  }
  
  // Return enriched activity with correct local image
  return {
    ...activity,
    image: await getActivityImage(activity.title, activity.image),
    // Ensure we use canonical data for consistency
    desc: canonicalActivity.desc,
    tags: canonicalActivity.tags,
    peakHours: canonicalActivity.peakHours,
    time: canonicalActivity.time
  };
}

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
    const guidance = `You are an expert Baguio itinerary planner with deep knowledge of peak hours and traffic patterns. The user wants a ${durationDays}-day trip. The current itinerary is missing plans for: ${missingDays.join(", ")}. 
    
    MANDATORY REQUIREMENTS:
    1. ONLY suggest activities that are NOT currently in peak hours based on Manila time
    2. Use the peak hours data to avoid crowded periods
    3. If popular activities are currently busy, suggest alternative activities or different timing
    4. Provide specific reasoning for timing choices
    
    CURRENT CONTEXT: ${peakHoursContext}
    
    Generate detailed plans for the missing days with Morning/Afternoon/Evening periods. Each activity must include: title, desc, image, time, peakHours, tags, and entranceFee. Return JSON format with "items" array containing period objects with activities arrays. ABSOLUTELY NO activities currently in peak hours.`;

    const resp = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: `${guidance}\n\nUser prompt: ${userPrompt}` }] }],
    });

    const text = resp.response?.text() ?? "";
    const jsonText = extractJson(text);

    if (jsonText) {
      try {
        const generatedItinerary = JSON.parse(jsonText);
        if (generatedItinerary && Array.isArray(generatedItinerary.items) && generatedItinerary.items.length > 0) {
          const newItemsMap = new Map<string, any[]>();
          for (const newItem of generatedItinerary.items) {
            // Filter out any peak hour activities that might have been generated
            const filteredActivities = (newItem.activities || []).filter((activity: any) => {
              if (!activity.peakHours) return true; // No peak hours data, assume it's fine
              const isPeakNow = isCurrentlyPeakHours(activity.peakHours);
              if (isPeakNow) {
                console.log(`Filtering out ${activity.title} - currently in peak hours: ${activity.peakHours}`);
              }
              return !isPeakNow;
            });
            newItemsMap.set(newItem.period, filteredActivities);
          }

          itinerary.items.forEach((item: any) => {
            if (newItemsMap.has(item.period)) {
              item.activities = newItemsMap.get(item.period) || [];
            }
          });
        }
        // If the AI returns an empty or invalid plan, we do nothing,
        // allowing the original empty placeholders to proceed to the reason-generation step.
      } catch (e) {
            console.error("Failed to parse generated itinerary for missing days:", e);
          }
        }
  }

  // Fill empty periods with deterministic reasons to avoid extra model calls.
  const emptyPeriods = itinerary.items.filter((item: any) => !item.activities || item.activities.length === 0);

  if (emptyPeriods.length > 0) {
    itinerary.items.forEach((item: any) => {
      if (!item.activities || item.activities.length === 0) {
        const period = item.period;
        const [day, timeSlot] = period.split(' - ');
        const dayNumber = parseInt(day.replace('Day ', ''));
        item.reason = buildDeterministicEmptySlotReason(dayNumber, timeSlot, durationDays ?? 1);
      }
    });
  }

  return itinerary;
}

export async function processItinerary(parsed: any, prompt: string, durationDays: number | null, model: any, peakHoursContext: string) {
  let processed = removeDuplicateActivities(parsed);
  processed = organizeItineraryByDays(processed, durationDays);
  if (durationDays && model && hasMissingPeriods(processed, durationDays)) {
    processed = await ensureFullItinerary(processed, prompt, durationDays, model, peakHoursContext);
  }

  // Log peak hours filtering for debugging (kept concise)
  let totalActivities = 0;
  let filteredActivities = 0;
  
  if (processed && processed.items) {
    processed.items.forEach((period: any) => {
      if (period.activities) {
        totalActivities += period.activities.length;
        period.activities.forEach((activity: any) => {
          if (activity.peakHours && isCurrentlyPeakHours(activity.peakHours)) {
            console.log(`WARNING: ${activity.title} is currently in peak hours but wasn't filtered!`);
            filteredActivities++;
          }
        });
      }
    });
  }
  
  console.log(`=== PEAK HOURS FILTERING SUMMARY ===\nTotal activities: ${totalActivities}\nActivities in peak hours: ${filteredActivities}\n=======================================`);

  // Final cleanup pass - only remove duplicates, preserve reasons and activities as-is
  if (processed && typeof processed === "object" && Array.isArray((processed as any).items)) {
    const seenByPeriod = new Map<string, Set<string>>();
    (processed as any).items = (processed as any).items
      .map((period: any, index: number) => {
        if (!period.activities || !Array.isArray(period.activities)) {
          period.activities = [];
        }

        const periodKey = typeof period?.period === 'string' ? period.period : `period-${index}`;
        let periodSeen = seenByPeriod.get(periodKey);
        if (!periodSeen) {
          periodSeen = new Set<string>();
          seenByPeriod.set(periodKey, periodSeen);
        }

        const validatedActivities = period.activities.filter((act: any) => {
          if (!act || !act.title || act.title.toLowerCase() === "no available activity") {
            return false; // Filter out nulls and placeholders
          }

          const normalized = act.title.toLowerCase();
          if (periodSeen!.has(normalized)) {
            return false; // Filter out duplicates within the same period
          }
          periodSeen!.add(normalized);
          return true;
        });

        const finalPeriod = { ...period, activities: validatedActivities };
        // Always preserve the reason field, even if activities array is empty
        if (period.reason) {
          finalPeriod.reason = period.reason;
        }

        return finalPeriod;
      });
  }

  // Ensure every period has at least one activity by recycling available ones when needed
  if (processed && Array.isArray(processed?.items)) {
    const availablePool = processed.items
      .flatMap((period: any) => Array.isArray(period?.activities) ? period.activities : [])
      .filter((activity: any) => activity && typeof activity?.title === 'string' && activity.title.trim().length > 0)
      .map((activity: any) => ({ ...activity }));

    if (availablePool.length > 0) {
      let fallbackIndex = 0;
      processed.items = processed.items.map((period: any) => {
        if (!Array.isArray(period.activities)) {
          period.activities = [];
        }

        if (period.activities.length === 0) {
          const fallbackActivity = availablePool[fallbackIndex % availablePool.length];
          fallbackIndex++;
          period.activities = [{ ...fallbackActivity }];
          // Remove deterministic placeholder reason when we now have a real activity
          if (period.reason) {
            delete period.reason;
          }
        }

        return period;
      });
    }
  }
  
  return processed;
}

function hasMissingPeriods(itinerary: any, durationDays: number): boolean {
  if (!itinerary?.items || !Array.isArray(itinerary.items)) {
    return true;
  }

  const periodsPerDay = new Map<string, { period: string; hasActivities: boolean }[]>();

  itinerary.items.forEach((item: any) => {
    const [day] = (item?.period || '').split(' - ');
    if (!day) {
      return;
    }
    if (!periodsPerDay.has(day)) {
      periodsPerDay.set(day, []);
    }
    periodsPerDay.get(day)!.push({ period: item.period, hasActivities: Array.isArray(item.activities) && item.activities.length > 0 });
  });

  for (let i = 1; i <= durationDays; i++) {
    const key = `Day ${i}`;
    const slots = periodsPerDay.get(key) || [];
    const missingSlot = slots.some(slot => !slot.hasActivities);
    if (missingSlot || slots.length === 0) {
      return true;
    }
  }

  return false;
}

function buildDeterministicEmptySlotReason(dayNumber: number, timeSlot: string, durationDays: number): string {
  const normalizedSlot = timeSlot.toLowerCase();

  if (dayNumber === durationDays && normalizedSlot === "evening") {
    return "This final evening is left unscheduled to allow for a stress-free departure. Use this time for last-minute shopping, a farewell dinner, or simply to reflect on your wonderful Baguio experience.";
  }

  if (dayNumber === 1 && normalizedSlot === "morning") {
    return "Your first morning is intentionally flexible. After arriving and getting settled, this time allows you to ease into Baguio's relaxed pace—perfect for a hearty breakfast or a light walk to get your bearings.";
  }

  const slotMessages: Record<string, string[]> = {
    morning: [
      "Morning peak hours at popular viewpoints (6-8 AM) create crowded conditions. This flexible time lets you visit scenic spots after 9 AM when parking is easier and the atmosphere is calmer.",
      "Tour buses fill up Baguio's key attractions early. Use this window for a relaxing breakfast or a quiet stroll before tackling the main sights at off-peak hours.",
      "Traffic sensors show a short-lived morning rush. Holding this slot open keeps your day adaptable for weather or spontaneous discoveries later on."
    ],
    afternoon: [
      "Afternoon congestion around Session Road and SM Baguio peaks from 12-3 PM. This buffer keeps your group rested before diving into late-day adventures.",
      "Mountain roads heading to panoramic viewpoints slow down after lunch. Stay flexible now so you can visit during clearer, late-afternoon windows.",
      "Cloud buildup is common mid-afternoon. Keeping this slot open lets you pivot to indoor cafés or museums until skies clear."
    ],
    evening: [
      "Dinner rush in Baguio spikes between 6-7 PM. Waiting it out means shorter queues and better service once the crowd thins.",
      "Night markets and cafés come alive later in the evening. This empty slot is your strategic buffer to explore them after peak traffic eases.",
      "Evening weather can turn misty. Keeping plans flexible allows you to choose between cozy indoor spots or a late-night stroll when conditions improve."
    ]
  };

  const candidates = slotMessages[normalizedSlot] || [
    "This period stays open to adapt to real-time traffic and crowd conditions, giving your group room for spontaneous exploration."
  ];

  return candidates[dayNumber % candidates.length];
}
