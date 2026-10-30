
import { MenuItem } from "@/types/tarana-eats";

export interface FullMenu {
  Breakfast: MenuItem[];
  Lunch: MenuItem[];
  Dinner: MenuItem[];
  Snacks: MenuItem[];
  Drinks: MenuItem[];
}

export interface MenuItemWithCategory extends MenuItem {
  category: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks';
}

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

export interface FormOptionsData {
  cuisineOptions: any[];
  paxOptions: any[];
  dietaryOptions: string[];
  mealTypeOptions: string[];
}

export interface CombinedFoodData {
  restaurants: RestaurantData[];
  savedMeals: SavedMealExperience[];
  formOptions: FormOptionsData;
}