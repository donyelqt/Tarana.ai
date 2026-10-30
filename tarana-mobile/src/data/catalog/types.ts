
export type MenuItem = {
  name: string;
  description: string;
  price: number;
  image: string;
  tags?: string[];
  quantity?: number;
};

export type FullMenu = {
  Breakfast: MenuItem[];
  Lunch: MenuItem[];
  Dinner: MenuItem[];
  Snacks: MenuItem[];
  Drinks: MenuItem[];
};

export const EMPTY_MENU: FullMenu = {
  Breakfast: [],
  Lunch: [],
  Dinner: [],
  Snacks: [],
  Drinks: [],
};

export function menuDishCount(menu: FullMenu): number {
  return menu.Breakfast.length + menu.Lunch.length + menu.Dinner.length + menu.Snacks.length + menu.Drinks.length;
}

export type Cafe = {
  name: string;
  cuisine: string[];
  priceRange: { min: number; max: number };
  location: string;
  popularFor: string[];
  about: string;
  hours: string;
  dietaryOptions: string[];
  tags: string[];
  fullMenu: FullMenu;
  hasMenu: boolean;
  image: string | null;
};
