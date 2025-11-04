import { GoogleGenerativeAI } from "@google/generative-ai";
import { taranaai } from "@/app/itinerary-generator/data/itineraryData";
import { extractJson } from "./jsonUtils";
import { isCurrentlyPeakHours } from "@/lib/traffic";
import { supabaseAdmin } from "@/lib/data/supabaseAdmin";

// Utilities for itinerary post-processing

function cloneAllowedActivity(activity: any) {
  const cloned: any = {
    image: activity.image,
    title: activity.title,
    time: activity.time,
    desc: activity.desc,
    tags: Array.isArray(activity.tags) ? [...activity.tags] : [],
    peakHours: activity.peakHours,
    trafficRecommendation: activity.trafficRecommendation,
    combinedTrafficScore: activity.combinedTrafficScore
  };

  if (activity.trafficAnalysis) {
    cloned.trafficAnalysis = {
      recommendation: activity.trafficAnalysis.recommendation,
      realTimeTraffic: activity.trafficAnalysis.realTimeTraffic
        ? { ...activity.trafficAnalysis.realTimeTraffic }
        : undefined
    };
  }

  return cloned;
}

function distributeRemainingAllowedActivities(itinerary: any, durationDays: number | null) {
  if (!itinerary || !Array.isArray(itinerary.items)) return itinerary;

  const allowList = Array.isArray(itinerary?.searchMetadata?.allowedActivities)
    ? itinerary.searchMetadata.allowedActivities
    : [];

  if (!allowList.length) return itinerary;

  const usedTitles = new Set<string>();
  itinerary.items.forEach((period: any) => {
    if (!Array.isArray(period.activities)) {
      period.activities = [];
      return;
    }
    period.activities.forEach((activity: any) => {
      const title = typeof activity?.title === 'string' ? activity.title.trim().toLowerCase() : '';
      if (title) {
        usedTitles.add(title);
      }
    });
  });

  const remaining = allowList.filter((activity: any) => {
    const title = typeof activity?.title === 'string' ? activity.title.trim().toLowerCase() : '';
    return title && !usedTitles.has(title);
  });

  if (!remaining.length) {
    return itinerary;
  }

  const periodsInOrder = itinerary.items.filter((item: any) => Array.isArray(item.activities));

  // Fill empty periods first using remaining activities
  let cursor = 0;
  for (const period of periodsInOrder) {
    if (cursor >= remaining.length) break;
    if (period.activities.length === 0) {
      period.activities.push(cloneAllowedActivity(remaining[cursor++]));
    }
  }

  if (cursor >= remaining.length) {
    return itinerary;
  }

  // Balance across periods, aiming for at least two activities per slot before adding extras
  const targetPerSlot = durationDays && durationDays <= 2 ? 2 : 2;
  const sortedByLoad = [...periodsInOrder].sort((a, b) => a.activities.length - b.activities.length);

  let safety = 0;
  while (cursor < remaining.length && safety < remaining.length * 2) {
    for (const period of sortedByLoad) {
      if (cursor >= remaining.length) break;
      if (period.activities.length < targetPerSlot) {
        period.activities.push(cloneAllowedActivity(remaining[cursor++]));
      }
    }
    safety++;
    if (sortedByLoad.every(period => period.activities.length >= targetPerSlot)) {
      break;
    }
  }

  // If activities remain, append them round-robin to preserve all allowed entries
  while (cursor < remaining.length) {
    for (const period of periodsInOrder) {
      if (cursor >= remaining.length) break;
      period.activities.push(cloneAllowedActivity(remaining[cursor++]));
    }
  }

  return itinerary;
}

// Function to check for duplicate activities across days
export function removeDuplicateActivities(parsedItinerary: any) {
  if (!parsedItinerary || !parsedItinerary.items || !Array.isArray(parsedItinerary.items)) {
    return parsedItinerary;
  }

  const seenActivities = new Set<string>();

  const result = {
    ...parsedItinerary,
    items: parsedItinerary.items.map((period: any) => {
      if (!period.activities || !Array.isArray(period.activities)) return period;
      return {
        ...period,
        activities: period.activities.filter((activity: any) => {
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



export function organizeItineraryByDays(it: any, days: number | null) {
  if (!days || !it || !Array.isArray(it.items) || days <= 0) return it;
  // Collect all activities by inferred slot
  const pool: Record<string, any[]> = { Morning: [], Afternoon: [], Evening: [], Flexible: [] };
  const activityIndex = new Map<string, any>();
  for (const period of it.items) {
    const slot = inferSlot(period?.period || '');
    const acts = Array.isArray(period?.activities) ? period.activities : [];
    for (const a of acts) {
      if (!a?.title || a.title.toLowerCase() === 'no available activity') continue;
      pool[slot].push(a);
      if (typeof a.title === 'string') {
        activityIndex.set(a.title.toLowerCase(), a);
      }
    }
  }
  const slotOrder: Array<'Morning' | 'Afternoon' | 'Evening'> = ['Morning', 'Afternoon', 'Evening'];
  const slotPriority: Record<'Morning' | 'Afternoon' | 'Evening', Array<'Morning' | 'Afternoon' | 'Evening' | 'Flexible'>> = {
    Morning: ['Morning', 'Flexible', 'Afternoon', 'Evening'],
    Afternoon: ['Afternoon', 'Flexible', 'Morning', 'Evening'],
    Evening: ['Evening', 'Flexible', 'Afternoon', 'Morning']
  };
  const fallbackPriority: Array<'Morning' | 'Afternoon' | 'Evening' | 'Flexible'> = ['Morning', 'Afternoon', 'Evening', 'Flexible'];

  const queues: Record<'Morning' | 'Afternoon' | 'Evening' | 'Flexible', any[]> = {
    Morning: [...pool.Morning],
    Afternoon: [...pool.Afternoon],
    Evening: [...pool.Evening],
    Flexible: [...pool.Flexible]
  };

  const takeFromQueues = (
    slot: 'Morning' | 'Afternoon' | 'Evening',
    strict: boolean
  ): any | null => {
    const preferred = strict
      ? slotPriority[slot]
      : Array.from(new Set([...slotPriority[slot], ...fallbackPriority]));
    for (const key of preferred) {
      if (queues[key].length > 0) {
        return queues[key].shift();
      }
    }
    return null;
  };

  const anyQueuesRemaining = () =>
    queues.Morning.length > 0 ||
    queues.Afternoon.length > 0 ||
    queues.Evening.length > 0 ||
    queues.Flexible.length > 0;

  // Prepare day buckets
  const daysBuckets = Array.from({ length: days }, () => ({ Morning: [] as any[], Afternoon: [] as any[], Evening: [] as any[] }));

  // First pass: ensure every slot gets at most one best-fit activity
  for (let dayIndex = 0; dayIndex < days; dayIndex++) {
    const bucket = daysBuckets[dayIndex];
    slotOrder.forEach(slot => {
      const activity = takeFromQueues(slot, true);
      if (activity) {
        bucket[slot].push(activity);
      }
    });
  }

  // Additional passes: distribute any remaining activities while maintaining uniqueness
  while (anyQueuesRemaining()) {
    let assignedThisRound = false;
    for (let dayIndex = 0; dayIndex < days; dayIndex++) {
      const bucket = daysBuckets[dayIndex];
      for (const slot of slotOrder) {
        const activity = takeFromQueues(slot, false);
        if (activity) {
          bucket[slot].push(activity);
          assignedThisRound = true;
        }
        if (!anyQueuesRemaining()) {
          break;
        }
      }
      if (!anyQueuesRemaining()) {
        break;
      }
    }
    if (!assignedThisRound) {
      break; // Safeguard against infinite loops if queues cannot be depleted
    }
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

  const normalizeAllowedActivity = (activity: any) => {
    if (!activity || typeof activity?.title !== 'string') return null;
    const normalized: Record<string, any> = {
      title: activity.title,
      desc: activity.desc,
      tags: Array.isArray(activity.tags) ? activity.tags : [],
      time: activity.time,
      image: activity.image,
      peakHours: activity.peakHours
    };

    if (activity.trafficAnalysis) {
      normalized.trafficAnalysis = activity.trafficAnalysis;
    }
    if (activity.trafficRecommendation) {
      normalized.trafficRecommendation = activity.trafficRecommendation;
    }
    if (typeof activity.combinedTrafficScore !== 'undefined') {
      normalized.combinedTrafficScore = activity.combinedTrafficScore;
    }
    if (typeof activity.relevanceScore !== 'undefined') {
      normalized.relevanceScore = activity.relevanceScore;
    }
    if (typeof activity.isCurrentlyPeak !== 'undefined') {
      normalized.isCurrentlyPeak = activity.isCurrentlyPeak;
    }

    return normalized;
  };

  const mergeAllowedActivity = (existing: any | undefined, incoming: any | null) => {
    if (!existing && !incoming) return null;
    const merged: Record<string, any> = {
      ...(incoming || {}),
      ...(existing || {})
    };

    if ((!merged.tags || merged.tags.length === 0) && incoming?.tags?.length) {
      merged.tags = incoming.tags;
    }

    if (!merged.image && incoming?.image) {
      merged.image = incoming.image;
    }

    if (!merged.time && incoming?.time) {
      merged.time = incoming.time;
    }

    if (!merged.peakHours && incoming?.peakHours) {
      merged.peakHours = incoming.peakHours;
    }

    return merged;
  };

  const existingAllowedActivities = Array.isArray(it?.searchMetadata?.allowedActivities)
    ? it.searchMetadata.allowedActivities
    : [];

  const allowedMap = new Map<string, any>();
  const orderedKeys: string[] = [];
  const registerAllowed = (key: string, value: any) => {
    allowedMap.set(key, value);
    if (!orderedKeys.includes(key)) {
      orderedKeys.push(key);
    }
  };

  existingAllowedActivities.forEach((activity: any) => {
    const key = typeof activity?.title === 'string' ? activity.title.trim().toLowerCase() : '';
    const normalized = normalizeAllowedActivity(activity);
    if (!key || !normalized) return;
    registerAllowed(key, normalized);
  });

  const observedTitleKeys = new Set(
    newItems.flatMap((item: any) =>
      Array.isArray(item.activities)
        ? item.activities
            .map((activity: any) =>
              typeof activity?.title === 'string' ? activity.title.trim().toLowerCase() : null
            )
            .filter(Boolean)
        : []
    )
  );

  observedTitleKeys.forEach(titleKey => {
    const activity = activityIndex.get(titleKey);
    const normalized = normalizeAllowedActivity(activity);
    const merged = mergeAllowedActivity(allowedMap.get(titleKey), normalized);
    if (merged) {
      registerAllowed(titleKey, merged);
    }
  });

  const allowedActivities = orderedKeys
    .map(key => allowedMap.get(key))
    .filter(Boolean);

  return {
    ...it,
    items: newItems,
    searchMetadata: {
      ...(it.searchMetadata || {}),
      allowedActivities
    }
  };
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
    time: canonicalActivity.time,
    origin: activity.origin ?? 'primary',
    reason: activity.reason || `Recommended using canonical profile for ${activity.title}.`
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
              const title = typeof activity?.title === 'string' ? activity.title.trim() : '';
              if (!title) return false;

              const allowList = Array.isArray(itinerary?.searchMetadata?.allowedActivities)
                ? itinerary.searchMetadata.allowedActivities
                : [];
              const allowedTitleSet = new Set(
                allowList.map((allowed: any) =>
                  typeof allowed?.title === 'string' ? allowed.title.trim().toLowerCase() : null
                ).filter(Boolean)
              );

              if (!allowedTitleSet.has(title.toLowerCase())) {
                console.log(`Filtering out ${title} - not present in allowedActivities allowlist`);
                return false;
              }

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
    processed = removeDuplicateActivities(processed);
  }

  processed = distributeRemainingAllowedActivities(processed, durationDays);

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
    const inferredDuration = durationDays ?? (() => {
      const dayLabels = new Set<string>();
      (processed as any).items.forEach((item: any) => {
        const [dayLabel] = (item?.period || '').split(' - ');
        if (dayLabel) {
          dayLabels.add(dayLabel.trim());
        }
      });
      return dayLabels.size || (processed as any).items.length || 1;
    })();

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
          const normalizedTitle = typeof act?.title === 'string' ? act.title.trim().toLowerCase() : '';
          if (!normalizedTitle || normalizedTitle === "no available activity" || normalizedTitle === "activity") {
            return false; // Filter out nulls and placeholders
          }

          if (periodSeen!.has(normalizedTitle)) {
            return false; // Filter out duplicates within the same period
          }
          periodSeen!.add(normalizedTitle);
          return true;
        });

        const finalPeriod = { ...period, activities: validatedActivities };
        // Always preserve the reason field, even if activities array is empty
        if (finalPeriod.activities.length === 0) {
          if (period.reason) {
            finalPeriod.reason = period.reason;
          } else {
            const [rawDay, rawSlot] = (period?.period || '').split(' - ');
            const dayNumber = (() => {
              if (!rawDay) return 1;
              const match = rawDay.match(/(\d+)/);
              const parsed = match ? parseInt(match[1], 10) : NaN;
              return Number.isNaN(parsed) ? 1 : parsed;
            })();
            const slotLabel = rawSlot || 'Flexible';
            finalPeriod.reason = buildDeterministicEmptySlotReason(dayNumber, slotLabel, inferredDuration);
          }
        } else if (period.reason) {
          finalPeriod.reason = period.reason;
        }

        return finalPeriod;
      });

    processed = removeDuplicateActivities(processed);

    if (processed && Array.isArray((processed as any).items)) {
      const resolvedDuration = durationDays ?? (() => {
        const dayLabels = new Set<string>();
        (processed as any).items.forEach((item: any) => {
          const [dayLabel] = (item?.period || '').split(' - ');
          if (dayLabel) {
            dayLabels.add(dayLabel.trim());
          }
        });
        return dayLabels.size || (processed as any).items.length || 1;
      })();

      (processed as any).items = (processed as any).items.map((period: any) => {
        const activities = Array.isArray(period?.activities) ? period.activities : [];
        if (activities.length === 0) {
          const [rawDay, rawSlot] = (period?.period || '').split(' - ');
          const dayNumber = (() => {
            if (!rawDay) return 1;
            const match = rawDay.match(/(\d+)/);
            const parsed = match ? parseInt(match[1], 10) : NaN;
            return Number.isNaN(parsed) ? 1 : parsed;
          })();
          const slotLabel = rawSlot || 'Flexible';
          return {
            ...period,
            reason: period.reason || buildDeterministicEmptySlotReason(dayNumber, slotLabel, resolvedDuration)
          };
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
