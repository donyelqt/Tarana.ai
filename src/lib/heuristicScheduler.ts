/**
 * Heuristic Scheduler for Itinerary Generation
 * 
 * This module provides algorithms to optimize activity scheduling based on various constraints
 * such as time, location, activity type, and user preferences.
 */

interface ActivityMetadata {
  duration?: number;
  location?: string;
  type?: string;
  [key: string]: string | number | undefined;
}

interface Activity {
  id?: string;
  title: string;
  time?: string;
  desc?: string;
  tags?: string[];
  metadata?: ActivityMetadata;
  score?: number;
}

interface ScheduledActivity extends Activity {
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
}

interface ScheduleOptions {
  startTime?: string; // Default start time for the day (HH:MM)
  endTime?: string;   // Default end time for the day (HH:MM)
  breakDuration?: number; // Minutes between activities
  maxActivitiesPerDay?: number;
  preferredTimes?: Record<string, string[]>; // Activity type -> preferred time slots
}

/**
 * Default scheduling options
 */
const DEFAULT_OPTIONS: ScheduleOptions = {
  startTime: '08:00',
  endTime: '21:00',
  breakDuration: 30, // 30 minutes between activities
  maxActivitiesPerDay: 6,
  preferredTimes: {
    'Food': ['07:00', '12:00', '18:00'], // Breakfast, lunch, dinner
    'Nature': ['09:00', '15:00'],         // Morning and afternoon
    'Museum': ['10:00', '14:00'],         // Late morning to afternoon
    'Shopping': ['16:00'],                // Late afternoon
    'Nightlife': ['19:00'],               // Evening
  }
};

/**
 * Estimate activity duration based on type and description
 * @param activity The activity to estimate duration for
 * @returns Estimated duration in minutes
 */
function estimateActivityDuration(activity: Activity): number {
  // Use provided duration if available
  if (activity.metadata?.duration) {
    return activity.metadata.duration;
  }
  
  // Estimate based on activity type
  const type = activity.metadata?.type?.toLowerCase() || '';
  const desc = activity.desc?.toLowerCase() || '';
  
  if (type.includes('food') || desc.includes('restaurant') || desc.includes('café') || desc.includes('cafe')) {
    return 90; // 1.5 hours for dining
  }
  
  if (type.includes('museum') || desc.includes('museum')) {
    return 120; // 2 hours for museums
  }
  
  if (type.includes('park') || desc.includes('park') || type.includes('nature')) {
    return 120; // 2 hours for parks and nature
  }
  
  if (type.includes('shopping') || desc.includes('market') || desc.includes('shop')) {
    return 90; // 1.5 hours for shopping
  }
  
  if (type.includes('tour') || desc.includes('tour')) {
    return 180; // 3 hours for tours
  }
  
  // Default duration
  return 60; // 1 hour default
}

/**
 * Convert time string to minutes since midnight
 * @param time Time in HH:MM format
 * @returns Minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to time string
 * @param minutes Minutes since midnight
 * @returns Time in HH:MM format
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Find the best time slot for an activity based on preferred times and available slots
 * @param activity The activity to schedule
 * @param availableSlots Array of available time slots [startMinutes, endMinutes]
 * @param options Scheduling options
 * @returns The best time slot [startMinutes, endMinutes] or null if no slot available
 */
function findBestTimeSlot(
  activity: Activity,
  availableSlots: [number, number][],
  options: ScheduleOptions
): [number, number] | null {
  const activityType = activity.metadata?.type || 'default';
  const duration = estimateActivityDuration(activity);
  
  // Check if we have preferred times for this activity type
  const preferredTimes = options.preferredTimes?.[activityType];
  
  if (preferredTimes && preferredTimes.length > 0) {
    // Convert preferred times to minutes
    const preferredMinutes = preferredTimes.map(t => timeToMinutes(t));
    
    // Sort available slots by proximity to preferred times
    const scoredSlots = availableSlots
      .filter(([start, end]) => (end - start) >= duration) // Filter slots that are too short
      .map(slot => {
        const [start, end] = slot;
        // Find the closest preferred time
        const closestPreferred = preferredMinutes.reduce((closest, preferred) => {
          const distance = Math.abs(preferred - start);
          return distance < closest.distance ? { preferred, distance } : closest;
        }, { preferred: -1, distance: Infinity });
        
        return {
          slot,
          score: 1000 - closestPreferred.distance // Higher score for closer to preferred time
        };
      })
      .sort((a, b) => b.score - a.score); // Sort by score descending
    
    if (scoredSlots.length > 0) {
      const [start, end] = scoredSlots[0].slot;
      return [start, start + duration];
    }
  }
  
  // If no preferred times or no suitable slots found, just use the first available slot
  for (const [start, end] of availableSlots) {
    if ((end - start) >= duration) {
      return [start, start + duration];
    }
  }
  
  return null; // No suitable slot found
}

// Simple in-memory cache for scheduler results
const schedulerCache = new Map<string, { result: ScheduledActivity[]; timestamp: number }>();
const SCHEDULER_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

/**
 * Generate a cache key based on activities and options
 * @param activities Array of activities to schedule
 * @param options Scheduling options
 * @returns Cache key string
 */
function generateCacheKey(activities: Activity[], options: Partial<ScheduleOptions> = {}): string {
  // Create a simplified representation of activities for the cache key
  const activityKey = activities.map(a => {
    return {
      id: a.id,
      title: a.title,
      type: a.metadata?.type || '',
      score: a.score || 0
    };
  });
  
  // Create a simplified representation of options
  const optionsKey = {
    startTime: options.startTime || DEFAULT_OPTIONS.startTime,
    endTime: options.endTime || DEFAULT_OPTIONS.endTime,
    maxActivitiesPerDay: options.maxActivitiesPerDay || DEFAULT_OPTIONS.maxActivitiesPerDay,
    breakDuration: options.breakDuration || DEFAULT_OPTIONS.breakDuration
  };
  
  // Combine and hash to create a unique key
  return JSON.stringify({
    activities: activityKey,
    options: optionsKey
  });
}

/**
 * Schedule activities for a single day using heuristic algorithms
 * @param activities Array of activities to schedule
 * @param options Scheduling options
 * @param vectorScores Optional map of activity IDs to vector similarity scores
 * @returns Array of scheduled activities with start and end times
 */
export function scheduleActivitiesForDay(
  activities: Activity[],
  options: Partial<ScheduleOptions> = {},
  vectorScores?: Map<string, number>
): ScheduledActivity[] {
  // Generate a cache key based on activities and options
  const cacheKey = generateCacheKey(activities, options);
  
  // Check cache for recent similar scheduling requests
  const cached = schedulerCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SCHEDULER_CACHE_DURATION) {
    return cached.result;
  }
  
  // Merge options with defaults
  const mergedOptions: ScheduleOptions = { ...DEFAULT_OPTIONS, ...options };
  
  // Convert time strings to minutes for easier calculation
  const dayStartMinutes = timeToMinutes(mergedOptions.startTime || '08:00');
  const dayEndMinutes = timeToMinutes(mergedOptions.endTime || '21:00');
  const breakDuration = mergedOptions.breakDuration || 30;
  
  // Initialize available time slots
  let availableSlots: [number, number][] = [[dayStartMinutes, dayEndMinutes]];
  
  // Calculate combined scores that incorporate vector similarity when available
  const activityScores = new Map<string, number>();
  activities.forEach(activity => {
    let baseScore = activity.score !== undefined ? activity.score : 0.5; // Default score if none provided
    
    // Apply vector score boost if available (weighted at 70% of total score)
    if (vectorScores && vectorScores.has(activity.title)) {
      const vectorScore = vectorScores.get(activity.title) || 0;
      // Combine scores with vector similarity having higher weight
      const combinedScore = (vectorScore * 0.7) + (baseScore * 0.3);
      activityScores.set(activity.title, combinedScore);
    } else {
      activityScores.set(activity.title, baseScore);
    }
  });
  
  // Sort activities by combined score and type
  const sortedActivities = [...activities].sort((a, b) => {
    const scoreA = activityScores.get(a.title) || 0;
    const scoreB = activityScores.get(b.title) || 0;
    
    // If there's a significant difference in scores, use that
    if (Math.abs(scoreA - scoreB) > 0.1) {
      return scoreB - scoreA;
    }
    
    // Otherwise, prioritize by type (food at meal times, etc.)
    const typeA = a.metadata?.type || '';
    const typeB = b.metadata?.type || '';
    
    // Prioritize food activities for meal times
    if (typeA.includes('food') && !typeB.includes('food')) return -1;
    if (!typeA.includes('food') && typeB.includes('food')) return 1;
    
    // If all else is equal, use duration as a tiebreaker (shorter activities first)
    const durationA = estimateActivityDuration(a);
    const durationB = estimateActivityDuration(b);
    return durationA - durationB;
  });
  
  const scheduledActivities: ScheduledActivity[] = [];
  
  // Schedule activities until we run out of activities or slots
  for (const activity of sortedActivities) {
    // Stop if we've reached the maximum activities per day
    if (scheduledActivities.length >= (mergedOptions.maxActivitiesPerDay || 6)) {
      break;
    }
    
    // Find the best time slot for this activity
    const bestSlot = findBestTimeSlot(activity, availableSlots, mergedOptions);
    
    if (bestSlot) {
      const [startMinutes, endMinutes] = bestSlot;
      
      // Create scheduled activity
      const scheduledActivity: ScheduledActivity = {
        ...activity,
        startTime: minutesToTime(startMinutes),
        endTime: minutesToTime(endMinutes),
        time: `${minutesToTime(startMinutes)}-${minutesToTime(endMinutes)}`,
      };
      
      scheduledActivities.push(scheduledActivity);
      
      // Update available slots
      const newAvailableSlots: [number, number][] = [];
      
      for (const [slotStart, slotEnd] of availableSlots) {
        // If this slot doesn't overlap with the scheduled activity, keep it as is
        if (slotEnd <= startMinutes || slotStart >= endMinutes + breakDuration) {
          newAvailableSlots.push([slotStart, slotEnd]);
          continue;
        }
        
        // If there's space before the activity, add it as an available slot
        if (slotStart < startMinutes) {
          newAvailableSlots.push([slotStart, startMinutes]);
        }
        
        // If there's space after the activity (plus break), add it as an available slot
        if (slotEnd > endMinutes + breakDuration) {
          newAvailableSlots.push([endMinutes + breakDuration, slotEnd]);
        }
      }
      
      availableSlots = newAvailableSlots;
    }
  }
  
  // Sort scheduled activities by start time
  const result = scheduledActivities.sort((a, b) => {
    return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
  });
  
  // Cache the result
  schedulerCache.set(cacheKey, {
    result,
    timestamp: Date.now()
  });
  
  // Clean old cache entries periodically
  if (schedulerCache.size > 50) {
    const now = Date.now();
    for (const [key, value] of schedulerCache.entries()) {
      if (now - value.timestamp > SCHEDULER_CACHE_DURATION) {
        schedulerCache.delete(key);
      }
    }
  }
  
  return result;
}

/**
 * Schedule activities for multiple days with parallel processing
 * @param activitiesByDay Activities grouped by day
 * @param options Scheduling options
 * @param vectorScores Optional map of activity titles to vector similarity scores
 * @returns Scheduled activities grouped by day
 */
export function scheduleMultiDayItinerary(
  activitiesByDay: Activity[][],
  options: Partial<ScheduleOptions> = {},
  vectorScores?: Map<string, number>
): ScheduledActivity[][] {
  // Generate a cache key for the entire multi-day scheduling operation
  const allActivities = activitiesByDay.flat();
  let multiDayCacheKey = `multiday_${generateCacheKey(allActivities, options)}`;
  
  // Add vector scores to cache key if provided
  if (vectorScores && vectorScores.size > 0) {
    const vectorHash = Array.from(vectorScores.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([title, score]) => `${title.substring(0, 10)}:${score.toFixed(2)}`)
      .join('_');
    multiDayCacheKey += `_${vectorHash.substring(0, 100)}`;
  }
  
  // Check cache for recent similar multi-day scheduling requests
  const cached = schedulerCache.get(multiDayCacheKey);
  if (cached && Date.now() - cached.timestamp < SCHEDULER_CACHE_DURATION) {
    try {
      // Attempt to reconstruct the day structure from the cached result
      const result: ScheduledActivity[][] = [];
      let activityIndex = 0;
      
      for (let i = 0; i < activitiesByDay.length; i++) {
        const dayActivitiesCount = activitiesByDay[i].length;
        // Find activities for this day in the cached result
        const dayActivities = cached.result.filter(activity => {
          const originalActivity = allActivities[activityIndex++];
          return activity.title === originalActivity.title;
        });
        
        if (dayActivities.length > 0) {
          result.push(dayActivities);
        } else {
          // If we can't match the activities, fall back to scheduling this day
          result.push(scheduleActivitiesForDay(activitiesByDay[i], options, vectorScores));
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error reconstructing cached multi-day schedule:', error);
      // Fall back to regular scheduling if cache reconstruction fails
    }
  }
  
  // Process each day in parallel for better performance
   const scheduledDays = activitiesByDay.map(dayActivities => 
     scheduleActivitiesForDay(dayActivities, options, vectorScores)
   );
   
   // Cache the result
   schedulerCache.set(multiDayCacheKey, {
     result: scheduledDays.flat(),
     timestamp: Date.now()
   });
  
  return scheduledDays;
}

/**
 * Group activities by period (Morning, Afternoon, Evening)
 * @param scheduledActivities Array of scheduled activities
 * @returns Activities grouped by period
 */
export function groupActivitiesByPeriod(scheduledActivities: ScheduledActivity[]): Record<string, ScheduledActivity[]> {
  const periods: Record<string, ScheduledActivity[]> = {
    'Morning': [],
    'Afternoon': [],
    'Evening': []
  };
  
  for (const activity of scheduledActivities) {
    const startHour = parseInt(activity.startTime.split(':')[0], 10);
    
    if (startHour < 12) {
      periods['Morning'].push(activity);
    } else if (startHour < 18) {
      periods['Afternoon'].push(activity);
    } else {
      periods['Evening'].push(activity);
    }
  }
  
  return periods;
}