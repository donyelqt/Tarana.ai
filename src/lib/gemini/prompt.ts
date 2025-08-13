import { INTEREST_DETAILS } from './interests';

export function buildInterestsContext(interests?: string[]) {
  if (interests && Array.isArray(interests) && interests.length > 0 && !interests.includes('Random')) {
    return `
        The visitor has expressed specific interest in: ${interests.join(', ')}.
        From the sample itinerary database, prioritize activities that have tags matching these interests:
        ${interests
          .map((interest: string) => INTEREST_DETAILS[interest as keyof typeof INTEREST_DETAILS] || `- ${interest}: Select appropriate activities from the sample database`)
          .join('\n')}
        
        Ensure these activities are also appropriate for the current weather conditions.
      `;
  }
  return `
        The visitor hasn't specified particular interests, so provide a balanced mix of Baguio's highlights across different categories.
        Select a variety of activities from the sample itinerary database that cover different interest areas.
      `;
}

export function normalizeBudget(budget?: string) {
  if (!budget) return null;
  if (budget === 'less than ₱3,000/day' || budget === '₱3,000 - ₱5,000/day') return 'Budget';
  if (budget === '₱5,000 - ₱10,000/day') return 'Mid-range';
  if (budget === '₱10,000+/day') return 'Luxury';
  return budget;
}

export function normalizePax(pax?: string) {
  if (!pax) return null;
  if (pax === '1') return 'Solo';
  if (pax === '2') return 'Couple';
  if (pax === '3-5') return 'Family';
  if (pax === '6+') return 'Group';
  return pax;
}

export function extractDurationDays(duration: number | string | null | undefined): number | null {
  if (!duration && duration !== 0) return null;
  const match = duration.toString().match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

export function buildDurationContext(durationDays: number | null) {
  if (!durationDays) return '';
  return `
        This is a ${durationDays}-day trip, so pace the itinerary accordingly:
        ${durationDays === 1 ? 'Focus on must-see highlights and efficient time management. Select 2-3 activities per time period (morning, afternoon, evening) from the sample database.' : ''}
        ${durationDays === 2 ? 'Balance major attractions with some deeper local experiences. Select 2-3 activities per time period per day from the sample database.' : ''}
        ${durationDays === 3 ? "Include major attractions and allow time to explore local neighborhoods. Select 2 activities per time period per day from the sample database, allowing for more relaxed pacing." : ''}
        ${durationDays >= 4 ? 'Include major attractions, local experiences, and some day trips to nearby areas. Select 1-2 activities per time period per day from the sample database, allowing for a very relaxed pace.' : ''}
      `;
}

export function buildBudgetContext(budgetCategory: string | null, budgetRaw?: string) {
  if (!budgetCategory) return '';
  return `
        The visitor's budget preference is ${budgetRaw}, so recommend:
        ${budgetCategory === 'Budget' ? "From the sample itinerary database, prioritize activities with the 'Budget-friendly' tag. Focus on affordable dining, free/low-cost attractions, public transportation, and budget accommodations." : ''}
        ${budgetCategory === 'Mid-range' ? "From the sample itinerary database, select a mix of budget and premium activities. Include moderate restaurants, standard attraction fees, occasional taxis, and mid-range accommodations." : ''}
        ${budgetCategory === 'Luxury' ? "From the sample itinerary database, include premium experiences where available. Recommend fine dining options, premium experiences, private transportation, and luxury accommodations." : ''}
      `;
}

export function buildPaxContext(paxCategory: string | null, paxRaw?: string) {
  if (!paxCategory) return '';
  return `
        The group size is ${paxRaw}, so consider:
        ${paxCategory === 'Solo' ? 'From the sample itinerary database, select activities that are enjoyable for solo travelers. Include solo-friendly activities, social opportunities, and safety considerations.' : ''}
        ${paxCategory === 'Couple' ? 'From the sample itinerary database, prioritize activities suitable for couples. Include romantic settings, couple-friendly activities, and intimate dining options.' : ''}
        ${paxCategory === 'Family' ? "From the sample itinerary database, prioritize activities with the 'Family-friendly' tag if available. Include family-friendly activities, child-appropriate options, and group dining venues." : ''}
        ${paxCategory === 'Group' ? 'From the sample itinerary database, select activities that can accommodate larger parties. Include group-friendly venues, activities that accommodate larger parties, and group dining options.' : ''}
      `;
}

export function buildDetailedPrompt(
  prompt: string,
  sampleItineraryContext: string,
  weatherContext: string,
  interestsContext: string,
  durationContext: string,
  budgetContext: string,
  paxContext: string
) {
  return `
      ${prompt}
      ${sampleItineraryContext}
      ${weatherContext}
      ${interestsContext}
      ${durationContext}
      ${budgetContext}
      ${paxContext}
      
      Generate a detailed Baguio City itinerary.

      Rules:
      1. **Be concise.**
      2. **Strictly use the provided sample itinerary database.** Do NOT invent, suggest, or mention any activity, place, or experience that is not present in the provided database. If no suitable activity exists for a time slot, omit that time slot entirely and do not output any placeholder.
      3. Match activities to user interests and weather.
      4. Organize by Morning (8AM-12NN), Afternoon (12NN-6PM), Evening (6PM onwards).
      5. Pace the itinerary based on trip duration.
      6. For each activity, include: **image** (exact image URL from the database), **title**, **time** slot (e.g., "9:00-10:30AM"), a **brief** description (features, costs, location, duration, weather notes), and **tags** (interest and weather).
      7. Adhere to the user's budget.
      8. Output a JSON object with this structure: { "title": "Your X Day Itinerary", "subtitle": "...", "items": [{"period": "...", "activities": [{"image": "...", "title": "...", "time": "...", "desc": "...", "tags": [...]}]}] }
    `;
}