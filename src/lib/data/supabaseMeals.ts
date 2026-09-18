import { SavedMeal } from '@/app/saved-meals/data';
import { allRestaurantMenus } from '@/app/tarana-eats/data/taranaEatsData';
import { restaurants } from '@/app/tarana-eats/data/taranaEatsData';

/**
 * Saved-meals data access — authenticated server routes only.
 *
 * RLS remediation 2026-09-19: this module previously queried `saved_meals`
 * through the anon-key client (getSupabase()), relying on permissive RLS
 * policies that were removed (prod had USING(true) — any anon client could
 * read/write all users' rows). Authorization now lives server-side exactly
 * like savedItineraries.ts: the API route reads the NextAuth session cookie
 * and queries with the service-role admin client. The client never sends a
 * userId it could forge; the server derives identity from the session.
 */

const TABLE_NAME = 'saved_meals' as const;

async function authedFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error || `Request failed (${res.status})`);
  }
  return body as T;
}

export async function getSavedMeals(): Promise<SavedMeal[]> {
  const { data } = await authedFetch<{ data: SavedMeal[] }>('/api/saved-meals', {
    method: 'GET',
  });
  // Map Supabase fields to SavedMeal interface
  return (data || []).map((meal: any) => ({
    id: meal.id,
    cafeName: meal.cafe_name,
    mealType: meal.meal_type,
    price: meal.price,
    goodFor: meal.good_for,
    location: meal.location,
    image: meal.image,
    menuItems: meal.menu_items || [],
  })) as SavedMeal[];
}

export async function getSavedMealById(mealId: string): Promise<any | null> {
  try {
    const { data } = await authedFetch<{ data: any }>(`/api/saved-meals/${mealId}`, {
      method: 'GET',
    });
    if (!data) return null;
    return buildMealDetail(data, await getIndividualSavedMeals(data));
  } catch (error) {
    console.error('Error loading meal by ID:', error);
    return null;
  }
}

async function getIndividualSavedMeals(data: any): Promise<SavedMeal[]> {
  try {
    const meals = await getSavedMeals();
    return meals
      .filter((meal) => meal.cafeName === data.cafe_name && meal.id !== data.id)
      .map((meal) => ({
        id: meal.id,
        cafeName: meal.cafeName,
        mealType: meal.mealType,
        price: meal.price,
        goodFor: meal.goodFor,
        location: meal.location,
        image: meal.image,
        items: meal.menuItems?.length ? meal.menuItems : [{
          name: meal.mealType,
          price: meal.price,
          quantity: 1,
          image: meal.image,
        }],
      }));
  } catch (error) {
    console.error('Error loading individual meals:', error);
    return [];
  }
}

function buildMealDetail(data: any, individualSavedMeals: SavedMeal[]) {
  const restaurant = restaurants.find(r => r.name === data.cafe_name);

  // Transform menu_items to match the expected savedMeals structure for combined meals
  const savedMealsData = (data.menu_items || []).map((item: any, index: number) => ({
    id: item.id || `${data.id}_item_${index}`,
    name: item.name || `${data.meal_type} Meal`,
    type: data.meal_type,
    items: Array.isArray(item.items) ? item.items.map((menuItem: any) => ({
      name: menuItem.name,
      price: menuItem.price,
      quantity: menuItem.quantity || 1,
      image: menuItem.image || data.image,
    })) : [{
      name: item.name || `${data.meal_type} Meal`,
      price: item.price || data.price,
      quantity: 1,
      image: item.image || data.image,
    }],
    totalPrice: data.price,
    goodFor: data.good_for,
    image: item.image || data.image,
  }));

  return {
    id: data.id,
    cafeName: data.cafe_name,
    mealType: data.meal_type,
    price: data.price,
    goodFor: data.good_for,
    location: data.location,
    image: data.image,
    about: restaurant?.about || '',
    hours: restaurant?.hours || '',
    priceRange: restaurant?.priceRange ? `₱${restaurant.priceRange.min} - ₱${restaurant.priceRange.max}` : '',
    reason: data.reason || '',
    savedMeals: savedMealsData.length > 0 ? savedMealsData : [{
      id: data.id,
      name: `${data.cafe_name} - ${data.meal_type}`,
      type: data.meal_type,
      items: [{ name: `${data.cafe_name} - ${data.meal_type}`, price: data.price, quantity: 1, image: data.image }],
      totalPrice: data.price,
      goodFor: data.good_for,
      image: data.image,
    }],
    individualSavedMeals,
    fullMenu: restaurant?.fullMenu || allRestaurantMenus[data.cafe_name] || {},
    menuItems: restaurant?.menuItems || [],
  };
}

export async function saveMeal(meal: Omit<SavedMeal, 'id'>, menuItems?: any[]): Promise<string | null> {
  try {
    const { data } = await authedFetch<{ data: { id: string } }>('/api/saved-meals', {
      method: 'POST',
      body: JSON.stringify({
        cafe_name: meal.cafeName,
        meal_type: meal.mealType,
        price: meal.price,
        good_for: meal.goodFor ? meal.goodFor.toString() : null,
        location: meal.location,
        image: meal.image,
        tags: [],
        menu_items: menuItems || [],
      }),
    });
    return data.id;
  } catch (error) {
    console.error('Error saving meal:', error);
    return null;
  }
}

export async function deleteMeal(mealId: string): Promise<boolean> {
  try {
    const { success } = await authedFetch<{ success: boolean }>(`/api/saved-meals/${mealId}`, {
      method: 'DELETE',
    });
    return !!success;
  } catch (error) {
    console.error('Error deleting meal:', error);
    return false;
  }
}