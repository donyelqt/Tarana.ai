import { getPeakHoursContext } from "@/lib/traffic";
import { INTEREST_DETAILS, WEATHER_CONTEXTS } from "./config";
import type { WeatherCondition } from "../types/types";

/**
 * Build traffic-aware context for AI prompts
 * Combines peak hours data with real-time traffic insights
 */
export function buildTrafficAwareContext(activities: any[], restrictToProvided: boolean = true): string {
  const activitiesWithTraffic = activities.filter((activity: any) => activity.trafficAnalysis);

  const veryLow = activitiesWithTraffic.filter((a: any) => a.trafficAnalysis?.realTimeTraffic?.trafficLevel === 'VERY_LOW').length;
  const low = activitiesWithTraffic.filter((a: any) => a.trafficAnalysis?.realTimeTraffic?.trafficLevel === 'LOW').length;
  const moderate = activitiesWithTraffic.filter((a: any) => a.trafficAnalysis?.realTimeTraffic?.trafficLevel === 'MODERATE').length;

  const restrictionNote = restrictToProvided
    ? `Only use the pre-filtered list (${activities.length} items). No new activities may be introduced.`
    : '';

  return [
    `Traffic context: all activities already filtered to VERY_LOW/LOW/MODERATE levels.`,
    `Summary — VERY_LOW: ${veryLow}, LOW: ${low}, MODERATE: ${moderate}.`,
    `Emphasize the positive traffic outlook; high congestion items were removed upstream.`,
    restrictionNote
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildDetailedPrompt(
  prompt: string,
  sampleItinerary: any,
  weatherData: any,
  interests: string[],
  durationDays: number | null,
  budget?: string,
  pax?: string,
  restrictToSampleActivities: boolean = true
): string {
    const weatherId = weatherData?.weather?.[0]?.id || 0;
    const weatherDescription = weatherData?.weather?.[0]?.description || "";
    const temperature = weatherData?.main?.temp || 20;

    const getWeatherType = (id: number, temp: number): WeatherCondition => {
        if (id >= 200 && id <= 232) return 'thunderstorm';
        if ((id >= 300 && id <= 321) || (id >= 500 && id <= 531)) return 'rainy';
        if (id >= 600 && id <= 622) return 'snow';
        if (id >= 701 && id <= 781) return 'foggy';
        if (id === 800) return 'clear';
        if (id >= 801 && id <= 804) return 'cloudy';
        if (temp < 15) return 'cold';
        return 'default';
    };

    const weatherType: WeatherCondition = getWeatherType(weatherId, temperature);
    const weatherContext = WEATHER_CONTEXTS[weatherType](temperature, weatherDescription);

    const budgetCategory = (() => {
        if (!budget) return null;
        if (budget === "less than ₱3,000/day" || budget === "₱3,000 - ₱5,000/day") return "Budget";
        if (budget === "₱5,000 - ₱10,000/day") return "Mid-range";
        if (budget === "₱10,000+/day") return "Luxury";
        return budget; // fallback to the raw value
    })();

    const paxCategory = (() => {
        if (!pax) return null;
        if (pax === "1") return "Solo";
        if (pax === "2") return "Couple";
        if (pax === "3-5") return "Family";
        if (pax === "6+") return "Group";
        return pax; // fallback to the raw value
    })();

    const peakHoursContext = getPeakHoursContext();
    const trafficContext = buildTrafficAwareContext(sampleItinerary?.items?.flatMap((item: any) => item.activities || []), restrictToSampleActivities);
    
    const allowedActivitiesFromSearch = Array.isArray(sampleItinerary?.searchMetadata?.allowedActivities)
      ? sampleItinerary.searchMetadata.allowedActivities
      : null;

    // Provide a curated list of activities with essential details to prevent hallucination.
    const curatedActivities = (allowedActivitiesFromSearch && allowedActivitiesFromSearch.length > 0
        ? allowedActivitiesFromSearch
        : sampleItinerary?.items?.flatMap((item: any) => item.activities || []) || []
      )
      .slice(0, 18)
      .map((activity: any) => ({
        title: activity.title,
        desc: activity.desc,
        tags: activity.tags
      }));

    const sampleItineraryContext = curatedActivities && curatedActivities.length > 0
      ? `EXCLUSIVE ACTIVITY LIST: ${JSON.stringify({ activities: curatedActivities })}\nRULE: Recommend only activities present in this list. Do not invent items.`
      : "ERROR: No activities found in database. Return an error message stating insufficient data.";

    let interestsContext = "";
    if (interests && Array.isArray(interests) && interests.length > 0 && !interests.includes("Random")) {
      interestsContext = `
        The visitor has expressed specific interest in: ${interests.join(", ")}.
        From the sample itinerary database, prioritize activities that have tags matching these interests:
        ${interests.map((interest: string) => INTEREST_DETAILS[interest as keyof typeof INTEREST_DETAILS] || `- ${interest}: Select appropriate activities from the sample database`).join("\n")}
        
        Ensure these activities are also appropriate for the current weather conditions.
      `;
    } else {
      interestsContext = `
        The visitor hasn't specified particular interests, so provide a balanced mix of Baguio's highlights across different categories.
        Select a variety of activities from the sample itinerary database that cover different interest areas.
      `;
    }

    let durationContext = "";
    if (durationDays) {
      durationContext = `
        This is a ${durationDays}-day trip, so pace the itinerary accordingly:
        ${durationDays === 1 ? "Focus on must-see highlights and efficient time management. Select 2 activities per time period (morning, afternoon, evening) from the sample database." : ""}
        ${durationDays === 2 ? "Balance major attractions with some deeper local experiences. Select 2 activities per time period per day from the sample database." : ""}
        ${durationDays === 3 ? "Include major attractions and allow time to explore local neighborhoods. Select 2 activities per time period per day from the sample database, allowing for more relaxed pacing." : ""}
        ${durationDays >= 4 ? "Include major attractions, local experiences, and some day trips to nearby areas. Select 1-2 activities per time period per day from the sample database, allowing for a very relaxed pace." : ""}
      `;
    }

    let budgetContext = "";
    if (budgetCategory) {
      budgetContext = `
        The visitor's budget preference is ${budget}, so recommend:
        ${budgetCategory === "Budget" ? "From the sample itinerary database, prioritize activities with the 'Budget-friendly' tag. Focus on affordable dining, free/low-cost attractions, public transportation, and budget accommodations." : ""}
        ${budgetCategory === "Mid-range" ? "From the sample itinerary database, select a mix of budget and premium activities. Include moderate restaurants, standard attraction fees, occasional taxis, and mid-range accommodations." : ""}
        ${budgetCategory === "Luxury" ? "From the sample itinerary database, include premium experiences where available. Recommend fine dining options, premium experiences, private transportation, and luxury accommodations." : ""}
      `;
    }

    let paxContext = "";
    if (paxCategory) {
      paxContext = `
        The group size is ${pax}, so consider:
        ${paxCategory === "Solo" ? "From the sample itinerary database, select activities that are enjoyable for solo travelers. Include solo-friendly activities, social opportunities, and safety considerations." : ""}
        ${paxCategory === "Couple" ? "From the sample itinerary database, prioritize activities suitable for couples. Include romantic settings, couple-friendly activities, and intimate dining options." : ""}
        ${paxCategory === "Family" ? "From the sample itinerary database, prioritize activities with the 'Family-friendly' tag if available. Include family-friendly activities, child-appropriate options, and group dining venues." : ""}
        ${paxCategory === "Group" ? "From the sample itinerary database, select activities that can accommodate larger parties. Include group-friendly venues, activities that accommodate larger parties, and group dining options." : ""}
      `;
    }

    const interestDirective = interestsContext.trim() ? `- ${interestsContext.trim()}` : '';
    const durationDirective = durationContext.trim() ? `- ${durationContext.trim()}` : '';
    const budgetDirective = budgetContext.trim() ? `- ${budgetContext.trim()}` : '';
    const paxDirective = paxContext.trim() ? `- ${paxContext.trim()}` : '';

    return `
${prompt}

${sampleItineraryContext}
${weatherContext}
${peakHoursContext}
${trafficContext}

Key directives:
- Use only activities present in the exclusive list above. No improvisation.
- Pre-filtering already removed high-traffic options; describe remaining picks with positive traffic framing.
${interestDirective}
${durationDirective}
${budgetDirective}
${paxDirective}

Output requirements:
1. Cover exactly ${durationDays ?? 'the requested'} day(s) with Morning (8-12), Afternoon (12-18), Evening (18+).
2. Do not repeat any activity across periods or days.
3. For each activity include: exact image URL, title, time window, concise description mentioning why timing is optimal, and tags from the database.
4. If a slot cannot be filled, leave activities [] and add a traffic-aware reason.
5. Respond with JSON object: { "title", "subtitle", "items": [ { "period", "activities": [...], "reason"? } ] }.
6. Validate that every string (title, tags, image) exactly matches the provided database entry.
`;
}
