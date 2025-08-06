// ====================================================================
// AI DATA PREPARATION
// ====================================================================
//
// This file prepares data for AI recommendations by combining
// restaurant data with saved meals and form options.
//
// ====================================================================

import { SavedMeal } from "@/app/saved-meals/data";
import { savedMeals } from "@/app/saved-meals/data";
import { RestaurantData, SavedMealExperience, CombinedFoodData } from "./types";
import { getEmptyFullMenu } from "./helpers";
import { 
  cuisineOptions, 
  paxOptions, 
  dietaryOptions, 
  mealTypeOptions
} from "./formOptions";
import { restaurants } from "./restaurants";

// Convert saved meals to additional data for AI processing
export const savedMealExperiences: SavedMealExperience[] = savedMeals.map(meal => {
  // Find the corresponding restaurant in our data
  const restaurant = restaurants.find(r => r.name === meal.cafeName) || {
    name: meal.cafeName,
    cuisine: [],
    priceRange: { min: meal.price * 0.8, max: meal.price * 1.2 },
    location: meal.location,
    popularFor: [meal.mealType],
    menuItems: [],
    fullMenu: getEmptyFullMenu(),
    image: meal.image,
    tags: [],
    dietaryOptions: []
  };

  // Convert goodFor number to string array based on common categories
  const goodForCategories: string[] = [];
  if (meal.goodFor === 1) {
    goodForCategories.push('Solo');
  } else if (meal.goodFor === 2) {
    goodForCategories.push('Couple');
  } else if (meal.goodFor >= 3 && meal.goodFor <= 4) {
    goodForCategories.push('Small Group');
  } else if (meal.goodFor >= 5) {
    goodForCategories.push('Large Group');
  }

  return {
      id: meal.id,
      restaurant: restaurant.name,
      mealType: meal.mealType,
      price: meal.price,
      goodFor: goodForCategories,
      location: meal.location,
      image: meal.image,
      cuisine: restaurant.cuisine,
      tags: restaurant.tags,
      ratings: restaurant.ratings,
      fullMenu: restaurant.fullMenu
    };
});

// Form options for Gemini API to understand user preferences
export const formOptionsData = {
  cuisineOptions,
  paxOptions,
  dietaryOptions: dietaryOptions.map(opt => opt.label),
  mealTypeOptions: mealTypeOptions.map(opt => opt.label)
};

// Export a combined dataset for the Gemini API
export const combinedFoodData: CombinedFoodData = {
  restaurants,
  savedMeals: savedMealExperiences,
  formOptions: formOptionsData
};