export interface SavedMeal {
  id: string;
  cafeName: string;
  mealType: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  price: number;
  goodFor: number;
  location: string;
  image: string;
}

export const savedMeals: SavedMeal[] = [];
