export interface SavedMeal {
  id: string;
  cafeName: string;
  mealType: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  price: number;
  goodFor: number;
  location: string;
  image: string;
  menuItems?: any[];
}

export const savedMeals: SavedMeal[] = [];
