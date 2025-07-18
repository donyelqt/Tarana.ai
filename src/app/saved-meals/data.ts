export interface SavedMeal {
  id: string;
  cafeName: string;
  mealType: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  price: number;
  goodFor: number;
  location: string;
  image: string;
}

export const savedMeals: SavedMeal[] = [
  {
    id: '1',
    cafeName: 'Cafe Ysap',
    mealType: 'Breakfast',
    price: 300,
    goodFor: 2,
    location: 'Loakan, Baguio City',
    image: '/images/caferuins.png',
  },
  {
    id: '2',
    cafeName: 'Golden Wok Cafe',
    mealType: 'Dinner',
    price: 180,
    goodFor: 1,
    location: 'Upper QM, near Lourdes Grotto, City',
    image: '/images/goodtaste.png',
  },
  {
    id: '3',
    cafeName: 'Sakura Sip & Snack',
    mealType: 'Snack',
    price: 200,
    goodFor: 1,
    location: 'Military Cut-off Road, Baguio City',
    image: '/images/letai.png',
  },
];
