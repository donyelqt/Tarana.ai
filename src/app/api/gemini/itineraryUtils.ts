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
      if (acts.length > 0) {
        newItems.push({ period: `Day ${dayNum} - ${s}`, activities: acts });
      }
    }
  }
  return { ...it, items: newItems };
}
