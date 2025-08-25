import { getPeakHoursContext } from "@/lib/peakHours";
import { INTEREST_DETAILS, WEATHER_CONTEXTS } from "./config";
import type { WeatherCondition } from "../types/types";

export function buildDetailedPrompt(prompt: string, effectiveSampleItinerary: any, weatherData: any, interests: string[], durationDays: number | null, budget: string, pax: string) {
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
    
    const sampleItineraryContext = effectiveSampleItinerary
      ? `EXCLUSIVE DATABASE: ${JSON.stringify(effectiveSampleItinerary)}\n\nABSOLUTE RULE: You MUST ONLY use activities from this database. This is the COMPLETE list of available activities. DO NOT create, invent, or suggest any activity not in this list. Activities are pre-filtered and ranked by relevance. Higher relevanceScore values indicate better matches.`
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
        ${durationDays === 1 ? "Focus on must-see highlights and efficient time management. Select 2-3 activities per time period (morning, afternoon, evening) from the sample database." : ""}
        ${durationDays === 2 ? "Balance major attractions with some deeper local experiences. Select 2-3 activities per time period per day from the sample database." : ""}
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

    return `
      ${prompt}
      
      ${sampleItineraryContext}
      ${weatherContext}
      ${peakHoursContext}
      
      MANDATORY PEAK HOURS FILTERING:
      - ABSOLUTELY FORBIDDEN: Do not include any activity currently in peak hours
      - The provided database has already been filtered to exclude peak hour activities
      - If you cannot find enough activities, return fewer activities rather than including peak hour ones
      - Every activity description must mention optimal visit times to avoid crowds
      - Current Manila time context is provided - use it to validate timing recommendations
      ${interestsContext}
      ${durationContext}
      ${budgetContext}
      ${paxContext}
      
      Generate a detailed Baguio City itinerary using the semantically retrieved activities from the database. For multi-day itineraries, ensure each activity is only recommended once across all days.

      Rules:
      1. **Be precise and personalized.**
      2. **MANDATORY: ONLY use activities from the provided RAG database that also exist in our canonical activity list.** You are FORBIDDEN from creating, inventing, or suggesting ANY activity that is not explicitly listed in both the RAG database and our canonical data. Every single activity in your response MUST have an exact title match in our canonical data. The system will automatically provide the correct image URLs from our local imports - do not modify image URLs. If the database is empty or insufficient, return fewer activities rather than inventing new ones.
      3. **Prioritize activities with higher relevanceScore values** as they are more closely aligned with the user's query, interests, weather conditions, and current traffic levels.
      4. Organize by Morning (8AM-12NN), Afternoon (12NN-6PM), Evening (6PM onwards), respecting the time periods already suggested in the database.
      ${durationDays ? `4.a. Ensure the itinerary spans exactly ${durationDays} day(s). Create separate day sections and, within each day, include Morning, Afternoon, and Evening periods populated only from the database.` : ""}
      5. Pace the itinerary based on trip duration, ensuring a balanced schedule.
      6. For each activity, include: **image** (MUST be the exact image URL from the database - do not modify or substitute), **title** (exact title from the database), **time** slot (e.g., "9:00-10:30AM"), a **brief** description that mentions optimal visit times to avoid crowds, and **tags** (exact tags from the database).
      7. **TRAFFIC-AWARE DESCRIPTIONS:** Every activity description MUST include traffic timing information. Examples: "Best visited after 2 PM to avoid morning crowds" or "Currently low traffic - perfect time to visit!" The provided database contains only non-peak activities, so all suggestions should emphasize their current low-traffic status.
      8. Adhere to the user's budget preferences by selecting only activities from the database that match the budget category.
      9. **CRITICAL: DO NOT REPEAT activities across different days.** Each activity should only be recommended once in the entire itinerary.
      10. **VALIDATION REQUIREMENT:** Before including any activity, verify it exists in the provided database AND is not currently in peak hours. The database has been pre-filtered for peak hours, but you must still validate. If insufficient non-peak activities exist, return a shorter itinerary rather than including peak hour activities.
      11. **OUTPUT FORMAT:** Return a JSON object that strictly follows this Zod schema:\n          \`z.object({\n            title: z.string(),\n            subtitle: z.string(),\n            items: z.array(z.object({\n              period: z.string(),\n              activities: z.array(z.object({\n                image: z.string(),\n                title: z.string(),\n                time: z.string(),\n                desc: z.string(),\n                tags: z.array(z.string()),
              })),
            })),\n          })\`
      12. **FINAL CHECK:** Before outputting, verify every single activity title, image URL, and tags match exactly with the provided database entries. Each image field must contain the exact URL string from the database without any modifications.
    `;
}
