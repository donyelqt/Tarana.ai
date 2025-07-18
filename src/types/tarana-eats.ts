export interface MenuItem {
  name: string;
  description: string;
  price: number;
  image: string;
}

export interface FullMenu {
  Breakfast: MenuItem[];
  Lunch: MenuItem[];
  Dinner: MenuItem[];
  Snacks: MenuItem[];
  Drinks: MenuItem[];
}

export interface ResultMatch {
  name: string;
  meals: number;
  price: number;
  image: string;
  reason?: string; // Added reason field for AI explanations
  fullMenu?: FullMenu; // Added full menu data
}

export interface TaranaEatsFormValues {
  budget: string;
  cuisine: string;
  pax: number | null;
  restrictions: string[];
  mealType: string[];
}

export interface FoodMatchesData {
  matches: ResultMatch[];
} 