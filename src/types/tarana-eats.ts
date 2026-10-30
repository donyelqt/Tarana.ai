export interface MenuItem {
  name: string;
  description: string;
  price: number;
  image: string;
  tags?: string[];
  quantity?: number; 
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
  reason?: string; 
  fullMenu?: FullMenu; 
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