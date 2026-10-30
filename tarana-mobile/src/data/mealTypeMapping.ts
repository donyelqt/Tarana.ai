
export type WebMealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

export type MobileMealTab = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks' | 'Drinks';

const TAB_TO_WEB: Record<MobileMealTab, WebMealType> = {
  Breakfast: 'Breakfast',
  Lunch: 'Lunch',
  Dinner: 'Dinner',
  Snacks: 'Snack',
  Drinks: 'Snack',
};

const WEB_TYPES: readonly WebMealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

export function toWebMealType(mealType: string | null | undefined): WebMealType | null {
  if (typeof mealType !== 'string') return null;
  for (const [tab, webType] of Object.entries(TAB_TO_WEB)) {
    if (tab === mealType) return webType;
  }
  const webValue = WEB_TYPES.find((t) => t === mealType);
  if (webValue !== undefined) return webValue;
  return null;
}
