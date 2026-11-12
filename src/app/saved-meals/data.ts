export interface SavedMealNotes {
  title: string | null;
  notes: string | null;
}

export interface SavedMeal {
  id: string;
  cafeName: string;
  mealType: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  price: number;
  goodFor: number;
  location: string;
  image: string;
  menuItems?: any[];
  notes?: SavedMealNotes | null;
}

export const savedMeals: SavedMeal[] = [];
