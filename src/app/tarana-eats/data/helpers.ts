
import { FullMenu, RestaurantData } from "./types";

export const getEmptyFullMenu = (): FullMenu => ({
  Breakfast: [],
  Lunch: [],
  Dinner: [],
  Snacks: [],
  Drinks: []
});

export const getMenuByRestaurantName = (name: string, restaurants: RestaurantData[]): FullMenu => {
  const restaurant = restaurants.find(r => r.name === name);
  return restaurant?.fullMenu || getEmptyFullMenu();
};

export const createFoodPrompt = (preferences: any) => {
  const { budget, cuisine, pax, restrictions, mealType } = preferences;
  
  let budgetRange = "mid-range";
  if (budget) {
    const budgetNum = parseInt(budget.replace(/[^\d]/g, ''));
    if (budgetNum < 300) budgetRange = "budget-friendly";
    else if (budgetNum > 1000) budgetRange = "high-end";
    else budgetRange = "mid-range";
  }

  return `
    I need food recommendations in Baguio City based on these preferences:
    - Budget: ${budget || budgetRange}
    - Cuisine preference: ${cuisine || "Any"}
    - Number of people: ${pax || "1-2"}
    - Dietary restrictions: ${restrictions && restrictions.length > 0 ? restrictions.join(", ") : "None"}
    - Meal type: ${mealType && mealType.length > 0 ? mealType.join(", ") : "Any"}
    
    Use the provided restaurant database to suggest 3-5 suitable options that match these criteria.
    For each suggestion, provide:
    1. Restaurant name
    2. Why it's a good match
    3. Recommended dishes from their menu based on meal type (Breakfast, Lunch, Dinner, or Snacks)
    4. Price range
  `;
};