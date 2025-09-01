import { GoogleGenerativeAI } from "@google/generative-ai";
import { sampleItineraryCombined, taranaai } from "@/app/itinerary-generator/data/itineraryData";
import { extractJson } from "./jsonUtils";
import { isCurrentlyPeakHours } from "@/lib/traffic";

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

  // Find all empty periods and ask the AI to generate reasons for them in a single batch.
  const emptyPeriods = itinerary.items.filter((item: any) => !item.activities || item.activities.length === 0);

  if (emptyPeriods.length > 0) {
    const reasonPrompt = `
      You are a world-class travel assistant AI specializing in Baguio City itineraries. Your task is to provide insightful, unique, and genuinely helpful reasons for why certain time slots are left empty, with specific focus on peak hours optimization and practical travel advice.

      USER TRIP REQUEST: "${userPrompt}"
      CURRENT TRAFFIC AND PEAK HOUR CONTEXT: ${peakHoursContext}

      For EACH of the following empty time slots, provide a distinct and compelling reason that explains the strategic value of keeping this time flexible.

      EMPTY SLOTS:
      ${emptyPeriods.map((p: any) => `- ${p.period}`).join('\n')}

      CRITICAL INSTRUCTIONS:
      1. **PEAK HOURS FOCUS:** If activities were excluded due to current peak hours, clearly explain this and suggest when to visit those attractions instead.
      2. **TRAFFIC-AWARE REASONING:** Reference current Manila time and explain how traffic patterns affect the decision to keep this slot open.
      3. **SPECIFIC BAGUIO CONTEXT:** Include local insights about Baguio's unique characteristics (weather changes, mountain traffic, local dining patterns).
      4. **ACTIONABLE SUGGESTIONS:** Don't just explain why it's empty - provide specific alternative activities or timing recommendations.
      5. **UNIQUE REASONS:** Each explanation must be distinct and tailored to the specific day/time combination.

      ENHANCED REASONING CATEGORIES:
      - **Peak Hours Avoidance:** "Major attractions like [specific attraction] are currently experiencing peak crowds (current Manila time shows rush hour). This time is strategically left open so you can visit these places during off-peak hours for a better experience."
      - **Weather Flexibility:** "Baguio's mountain weather can change quickly. This flexible time allows you to adapt your plans based on current conditions."
      - **Local Dining Patterns:** "This aligns with local meal times in Baguio. Use this period to discover authentic local restaurants when they're less crowded."
      - **Traffic Optimization:** "Current traffic conditions make this an ideal buffer time. Mountain roads to popular viewpoints are clearer during off-peak hours."
      - **Cultural Immersion:** "Perfect time for spontaneous local discoveries - perhaps stumble upon a local market or artisan workshop not in typical tourist guides."

      RETURN FORMAT: Valid JSON object with period names as keys and detailed, actionable reasons as values.

      EXAMPLE ENHANCED REASONS:
      {
        "Day 2 - Afternoon": "Popular shopping areas like Session Road and Baguio Night Market are currently experiencing peak foot traffic. This afternoon break allows you to explore these areas later when crowds thin out (typically after 3 PM). Perfect time to rest at your hotel or discover a quiet local café.",
        "Day 3 - Morning": "Major viewpoints like Mines View Park are currently in their morning rush (6-8 AM peak hours). This flexible morning lets you visit these scenic spots after 9 AM when parking is easier and crowds are lighter. Use this time for a leisurely breakfast at a local restaurant.",
        "Day 3 - Evening": "Evening traffic to popular dinner spots peaks around 6-7 PM. This open slot allows you to dine later when restaurants are less crowded and you can enjoy a more relaxed atmosphere. Consider exploring nearby walking areas or local night markets that open later."
      }

      Generate specific, actionable reasons for each empty slot.
    `;

    let reasons: any = {}; // Initialize reasons
    try {
      const result = await model.generateContent(reasonPrompt);
      const text = result.response.text();
      const reasonsJson = extractJson(text);
      if (reasonsJson) {
        reasons = JSON.parse(reasonsJson);
      }
    } catch (error) {
      console.error("Failed to generate AI reasons for empty slots:", error);
      // AI call failed, reasons will be an empty object, and we'll apply fallbacks.
    }

    // Add reasons to the itinerary, applying a fallback for any period the AI missed.
    itinerary.items.forEach((item: any) => {
      if (!item.activities || item.activities.length === 0) {
        if (reasons[item.period]) {
          item.reason = reasons[item.period];
        } else {
          // Apply enhanced fallback with peak hours reasoning
          const period = item.period;
          const [day, timeSlot] = period.split(' - ');
          
          // Enhanced fallback reasons based on day and time slot
          // Enhanced fallback messages with specific Baguio context and peak hours reasoning
          const timeSlotMessages = {
            morning: [
              "Morning peak hours at popular viewpoints (6-8 AM) create crowded conditions. This flexible time allows you to visit Mines View Park, Botanical Garden, or other scenic spots after 9 AM when parking is available and crowds are lighter. Perfect for a leisurely breakfast at a local café first.",
              "Current Manila time indicates morning rush at tourist attractions. Use this period for hotel breakfast or explore quiet residential areas like Teacher's Camp before the tour buses arrive at major sites.",
              "Popular morning destinations are currently experiencing peak traffic. This open slot lets you start your day relaxed and visit attractions during their off-peak hours for better photo opportunities and shorter queues."
            ],
            afternoon: [
              "Afternoon peak hours (12-3 PM) at shopping areas like Session Road and SM Baguio create heavy foot traffic. This break allows you to explore these areas later when they're less crowded. Perfect time for a traditional Baguio 'merienda' at a quiet local restaurant.",
              "Current traffic conditions make this ideal for indoor activities or rest. Consider visiting museums, art galleries, or enjoying the cool Baguio weather from your hotel. Popular outdoor attractions will be less crowded after 3 PM.",
              "Peak afternoon traffic to mountain viewpoints makes this perfect buffer time. Use this period to rest and prepare for evening activities, or explore nearby walking areas that don't require vehicle access."
            ],
            evening: [
              "Evening peak hours (5-7 PM) at restaurants and night markets create long waits. This flexible time allows you to dine later when establishments are less crowded and you can enjoy a more relaxed atmosphere. Perfect for discovering hidden local eateries.",
              "Current Manila time shows evening rush hour affecting Baguio's dining scene. Use this period to explore nearby walking areas or wait until after 8 PM when popular restaurants have shorter queues and better service.",
              "Peak evening traffic makes this ideal for spontaneous exploration. Consider discovering local night markets that open later, or enjoy Baguio's cool evening air with a leisurely walk through quieter neighborhoods."
            ]
          };
          
          const dayNumber = parseInt(day.replace('Day ', ''));
          
          if (dayNumber === durationDays && timeSlot === "Evening") {
            item.reason = "This final evening is left unscheduled to allow for a stress-free departure. Use this time for last-minute shopping, a farewell dinner, or simply to reflect on your wonderful Baguio experience.";
          } else if (dayNumber === 1 && timeSlot === "Morning") {
            item.reason = "Your first morning is intentionally flexible. After arriving and getting settled, this time allows you to ease into Baguio's relaxed pace - perhaps grab a local breakfast or take a short walk to get your bearings.";
          } else {
            const timeSlotKey = timeSlot.toLowerCase() as keyof typeof timeSlotMessages;
            const messages = timeSlotMessages[timeSlotKey] || [
              "This period is intentionally left flexible due to current traffic conditions. Use this time for spontaneous discoveries or relaxation."
            ];
            
            item.reason = messages[Math.floor(Math.random() * messages.length)];
          }
          
          if (!reasons[item.period]) {
            console.warn(
              `AI did not provide a reason for empty slot: ${item.period}. Using enhanced fallback.`
            );
          }
        }
      }
    });
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
    .flatMap((section: any) => section.activities)
    .find((act: any) => act.title.toLowerCase() === title.toLowerCase());
  
  return canonicalActivity?.image || fallbackImage || taranaai; // Use taranaai as final fallback
}

/**
 * Validate that an activity exists in our canonical data and return the validated activity
 * with correct image URL from local imports
 */
export function validateAndEnrichActivity(activity: any): any | null {
  // Check if the activity exists in our canonical sample data
  const canonicalActivity = sampleItineraryCombined.items
    .flatMap((section: any) => section.activities)
    .find((act: any) => act.title.toLowerCase() === activity.title?.toLowerCase());
  
  if (!canonicalActivity) {
    console.warn(`Activity "${activity.title}" not found in canonical data, excluding from itinerary`);
    return null;
  }

  // Check if activity is currently in peak hours
  if (canonicalActivity.peakHours && isCurrentlyPeakHours(canonicalActivity.peakHours)) {
    console.warn(`Activity "${activity.title}" is currently in peak hours (${canonicalActivity.peakHours}), excluding from itinerary`);
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

  // Log peak hours filtering for debugging
  console.log('=== PEAK HOURS FILTERING SUMMARY ===');
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
  
  console.log(`Total activities in itinerary: ${totalActivities}`);
  console.log(`Activities currently in peak hours: ${filteredActivities}`);
  console.log('=======================================');

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
            // Final peak hours check
            if (act.peakHours && isCurrentlyPeakHours(act.peakHours)) {
              console.log(`Final filter: Removing ${act.title} - currently in peak hours`);
              return false;
            }
            seenActivities.add(act.title);
            return true;
          });

        const finalPeriod = { ...period, activities: validatedActivities };

        return finalPeriod;
      })
  }
  
  return processed;
}
