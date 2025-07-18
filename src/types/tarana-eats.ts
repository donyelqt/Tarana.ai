export interface MenuItem {
  name: string;
  description: string;
  price: number;
  image: string;
}

export interface ResultMatch {
  name: string;
  meals: number;
  price: number;
  image: string;
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