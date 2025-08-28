/**
 * Peak Hours Management for Manila Timezone
 * Handles peak hours detection and low-traffic activity suggestions
 */

export interface PeakHoursPeriod {
  start: string;
  end: string;
}

export interface ActivityPeakHours {
  periods: PeakHoursPeriod[];
  timezone: string;
}

/**
 * Get current Manila time
 */
export function getManilaTime(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
}

/**
 * Parse peak hours string into structured periods
 * Examples: "10 am - 11 am / 4 pm - 6 pm", "Saturday & Sunday 6 am - 5 pm"
 */
export function parsePeakHours(peakHoursStr: string): PeakHoursPeriod[] {
  if (!peakHoursStr) return [];
  
  const periods: PeakHoursPeriod[] = [];
  
  // Split by "/" to handle multiple time ranges
  const timeRanges = peakHoursStr.split('/').map(range => range.trim());
  
  for (const range of timeRanges) {
    // Skip day-specific ranges for now (e.g., "Saturday & Sunday")
    if (range.toLowerCase().includes('saturday') || 
        range.toLowerCase().includes('sunday') || 
        range.toLowerCase().includes('weekday')) {
      continue;
    }
    
    // Extract time range pattern like "10 am - 11 am" or "4 pm - 6 pm"
    const timeMatch = range.match(/(\d{1,2}):?(\d{0,2})\s*(am|pm)\s*-\s*(\d{1,2}):?(\d{0,2})\s*(am|pm)/i);
    
    if (timeMatch) {
      const [, startHour, startMin = '00', startPeriod, endHour, endMin = '00', endPeriod] = timeMatch;
      
      periods.push({
        start: `${startHour}:${startMin.padStart(2, '0')} ${startPeriod.toUpperCase()}`,
        end: `${endHour}:${endMin.padStart(2, '0')} ${endPeriod.toUpperCase()}`
      });
    }
  }
  
  return periods;
}

/**
 * Convert time string to 24-hour format for comparison
 */
export function convertTo24Hour(timeStr: string): number {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return -1;
  
  const [, hour, minute, period] = match;
  let hour24 = parseInt(hour);
  
  if (period.toUpperCase() === 'PM' && hour24 !== 12) {
    hour24 += 12;
  } else if (period.toUpperCase() === 'AM' && hour24 === 12) {
    hour24 = 0;
  }
  
  return hour24 * 100 + parseInt(minute); // Return as HHMM format for easy comparison
}

/**
 * Check if current Manila time falls within peak hours
 */
export function isCurrentlyPeakHours(peakHoursStr: string): boolean {
  const manilaTime = getManilaTime();
  const currentHour = manilaTime.getHours();
  const currentMinute = manilaTime.getMinutes();
  const currentTime24 = currentHour * 100 + currentMinute;
  
  const periods = parsePeakHours(peakHoursStr);
  
  for (const period of periods) {
    const startTime = convertTo24Hour(period.start);
    const endTime = convertTo24Hour(period.end);
    
    if (startTime !== -1 && endTime !== -1) {
      // Handle cases where end time is next day (rare but possible)
      if (startTime <= endTime) {
        if (currentTime24 >= startTime && currentTime24 <= endTime) {
          return true;
        }
      } else {
        // Crosses midnight
        if (currentTime24 >= startTime || currentTime24 <= endTime) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * Get peak hours context for AI prompt
 */
export function getPeakHoursContext(): string {
  const manilaTime = getManilaTime();
  const timeStr = manilaTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila'
  });
  
  const dayStr = manilaTime.toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'Asia/Manila'
  });
  
  return `
    CURRENT MANILA TIME CONTEXT:
    Current time: ${timeStr} on ${dayStr}
    
    STRICT PEAK HOURS ENFORCEMENT:
    - ABSOLUTE RULE: NO activities currently in peak hours are allowed in the itinerary
    - The system has already filtered out all peak hour activities from the database
    - Only suggest activities that are guaranteed to be in low-traffic periods right now
    - Every recommended activity is currently experiencing optimal (low) traffic conditions
    
    PEAK HOURS REFERENCE (for context only - these activities are already excluded):
    - Tourist attractions: Usually busiest 10 AM - 12 PM and 4 PM - 6 PM
    - Restaurants: Lunch (12 PM - 2 PM) and Dinner (6 PM - 8 PM) rush
    - Markets: Early morning (5 AM - 8 AM) and evening (5 PM - 7 PM)
    - Shopping malls: Weekends and evenings
    
    TRAFFIC-AWARE MESSAGING:
    - Emphasize that all suggested activities are currently in their optimal (low-traffic) periods
    - Mention specific benefits of visiting during current low-traffic times
    - Highlight the perfect timing for crowd-free experiences
  `;
}

/**
 * Filter activities to prioritize low-traffic options based on current time
 * STRICT filtering - absolutely no peak hour activities allowed
 */
export function filterLowTrafficActivities<T extends { peakHours?: string; title?: string }>(
  activities: T[]
): { lowTraffic: T[]; currentlyPeak: T[] } {
  const lowTraffic: T[] = [];
  const currentlyPeak: T[] = [];
  
  console.log(`=== FILTERING ${activities.length} ACTIVITIES FOR PEAK HOURS ===`);
  
  for (const activity of activities) {
    const activityTitle = activity.title || 'Unknown Activity';
    
    if (!activity.peakHours) {
      console.log(`✓ ${activityTitle}: No peak hours data - ALLOWED`);
      lowTraffic.push(activity);
      continue;
    }
    
    const isPeak = isCurrentlyPeakHours(activity.peakHours);
    if (isPeak) {
      console.log(`✗ ${activityTitle}: Currently in peak hours (${activity.peakHours}) - BLOCKED`);
      currentlyPeak.push(activity);
    } else {
      console.log(`✓ ${activityTitle}: Not in peak hours (${activity.peakHours}) - ALLOWED`);
      lowTraffic.push(activity);
    }
  }
  
  console.log(`RESULT: ${lowTraffic.length} allowed, ${currentlyPeak.length} blocked`);
  console.log('=======================================');
  
  return { lowTraffic, currentlyPeak };
}

/**
 * Get next low-traffic time for an activity
 */
export function getNextLowTrafficTime(peakHoursStr: string): string {
  if (!peakHoursStr) return "Available now";
  
  const manilaTime = getManilaTime();
  const periods = parsePeakHours(peakHoursStr);
  
  if (periods.length === 0) return "Available now";
  
  const currentTime24 = manilaTime.getHours() * 100 + manilaTime.getMinutes();
  
  // Find the next time when it's not peak hours
  for (const period of periods) {
    const endTime = convertTo24Hour(period.end);
    if (endTime !== -1 && currentTime24 < endTime) {
      const endHour = Math.floor(endTime / 100);
      const endMinute = endTime % 100;
      return `Best to visit after ${endHour > 12 ? endHour - 12 : endHour}:${endMinute.toString().padStart(2, '0')} ${endHour >= 12 ? 'PM' : 'AM'}`;
    }
  }
  
  return "Available now";
}

/**
 * Check if a given time is during peak hours
 */
export function isPeakHour(date: Date): boolean {
  const hour = date.getHours();
  const minute = date.getMinutes();
  const currentTime24 = hour * 100 + minute;
  
  // General peak hours: 7-9 AM, 12-2 PM, 5-7 PM
  const peakPeriods = [
    { start: 700, end: 900 },   // Morning rush
    { start: 1200, end: 1400 }, // Lunch rush
    { start: 1700, end: 1900 }  // Evening rush
  ];
  
  return peakPeriods.some(period => 
    currentTime24 >= period.start && currentTime24 <= period.end
  );
}

/**
 * Get peak hour multiplier for traffic calculations
 */
export function getPeakHourMultiplier(date: Date): number {
  if (isPeakHour(date)) {
    const hour = date.getHours();
    // Higher multiplier during rush hours
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
      return 1.5; // 50% increase during rush hours
    }
    return 1.3; // 30% increase during lunch hours
  }
  return 1.0; // No multiplier during off-peak hours
}

/**
 * Get next peak hour period
 */
export function getNextPeakHour(date: Date): Date | null {
  const hour = date.getHours();
  const nextPeakHour = new Date(date);
  
  if (hour < 7) {
    // Next peak is morning rush
    nextPeakHour.setHours(7, 0, 0, 0);
  } else if (hour < 12) {
    // Next peak is lunch rush
    nextPeakHour.setHours(12, 0, 0, 0);
  } else if (hour < 17) {
    // Next peak is evening rush
    nextPeakHour.setHours(17, 0, 0, 0);
  } else {
    // Next peak is tomorrow morning
    nextPeakHour.setDate(nextPeakHour.getDate() + 1);
    nextPeakHour.setHours(7, 0, 0, 0);
  }
  
  return nextPeakHour;
}
