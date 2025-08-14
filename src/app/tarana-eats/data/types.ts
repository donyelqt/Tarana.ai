// ====================================================================
// TARANA EATS TYPE DEFINITIONS
// ====================================================================
//
// This file contains all type definitions for the Tarana Eats feature
// to maintain consistency across the application.
//
// ====================================================================

import { MenuItem } from "@/types/tarana-eats";

// Define the structure for categorized menu items
export interface FullMenu {
  Breakfast: MenuItem[];
  Lunch: MenuItem[];
  Dinner: MenuItem[];
  Snacks: MenuItem[];
  Drinks: MenuItem[];
}

// Extended MenuItem type with category
export interface MenuItemWithCategory extends MenuItem {
  category: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks';
}

// Full restaurant data with all details
export interface RestaurantData {
  name: string;
  cuisine: string[];
  priceRange: {
    min: number;
    max: number;
  };
  location: string;
  popularFor: string[];
  menuItems: MenuItem[];
  fullMenu: FullMenu;
  image: string;
  tags: string[];
  ratings?: number;
  dietaryOptions: string[];
  about?: string;
  hours?: string;
}

// Saved meal experience for AI processing
export interface SavedMealExperience {
  id: string;
  restaurant: string;
  mealType: string;
  price: number;
  goodFor: string[];
  location: string;
  image: string;
  cuisine: string[];
  tags: string[];
  ratings?: number;
  fullMenu: FullMenu;
}

// Form options data structure
export interface FormOptionsData {
  cuisineOptions: any[];
  paxOptions: any[];
  dietaryOptions: string[];
  mealTypeOptions: string[];
}

// Combined dataset for API
export interface CombinedFoodData {
  restaurants: RestaurantData[];
  savedMeals: SavedMealExperience[];
  formOptions: FormOptionsData;
}