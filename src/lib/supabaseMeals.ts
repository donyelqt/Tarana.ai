import { supabase } from './supabaseClient';
import { SavedMeal } from '@/app/saved-meals/data';
import { allRestaurantMenus } from '@/app/tarana-eats/data/taranaEatsData';
import { restaurants } from '@/app/tarana-eats/data/taranaEatsData';

const TABLE_NAME = 'saved_meals';

export async function getSavedMeals(userId: string): Promise<SavedMeal[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error loading saved meals from Supabase:', error);
    return [];
  }
  // Map Supabase fields to SavedMeal interface
  return (data as any[]).map((meal) => ({
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
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('id', mealId)
    .single();
  if (error || !data) {
    console.error('Error loading meal by ID from Supabase:', error);
    return null;
  }
  
  // Find matching restaurant data
  const restaurant = restaurants.find(r => r.name === data.cafe_name);
  
  // Get all individual saved meals from this restaurant for the current user
  const { data: userData } = await supabase.auth.getUser();
  let individualSavedMeals: SavedMeal[] = [];
  
  if (userData.user) {
    const { data: allUserMeals } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('user_id', userData.user.id)
      .eq('cafe_name', data.cafe_name)
      .neq('id', mealId) // Exclude the current combined meal
      .order('created_at', { ascending: false });
    
    if (allUserMeals) {
      individualSavedMeals = allUserMeals.map((meal) => ({
        id: meal.id,
        cafeName: meal.cafe_name,
        mealType: meal.meal_type,
        price: meal.price,
        goodFor: meal.good_for,
        location: meal.location,
        image: meal.image,
        items: meal.menu_items || [{
          name: meal.meal_type,
          price: meal.price,
          quantity: 1,
          image: meal.image
        }]
      }));
    }
  }
  
  // Transform menu_items to match the expected savedMeals structure for combined meals
  const savedMealsData = (data.menu_items || []).map((item: any, index: number) => ({
    id: item.id || `${data.id}_item_${index}`,
    name: item.name || `${data.meal_type} Meal`,
    type: data.meal_type,
    items: Array.isArray(item.items) ? item.items.map((menuItem: any) => ({
      name: menuItem.name,
      price: menuItem.price,
      quantity: menuItem.quantity || 1,
      image: menuItem.image || data.image
    })) : [{
      name: item.name || `${data.meal_type} Meal`,
      price: item.price || data.price,
      quantity: 1,
      image: item.image || data.image
    }],
    totalPrice: data.price,
    goodFor: data.good_for,
    image: item.image || data.image
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
      image: data.image
    }],
    individualSavedMeals: individualSavedMeals,
    fullMenu: restaurant?.fullMenu || allRestaurantMenus[data.cafe_name] || {},
    menuItems: restaurant?.menuItems || [],
  };
}

export async function saveMeal(userId: string, meal: Omit<SavedMeal, 'id'>, menuItems?: any[]): Promise<string | null> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert({
      user_id: userId,
      cafe_name: meal.cafeName,
      meal_type: meal.mealType,
      price: meal.price,
      good_for: meal.goodFor ? meal.goodFor.toString() : null,
      location: meal.location,
      image: meal.image,
      tags: [], // Provide default empty array if not present
      menu_items: menuItems || [], // Store actual menu items if provided
    })
    .select('id')
    .single();
  if (error) {
    console.error('Error saving meal to Supabase:', error.message || error);
    return null;
  }
  return data.id;
}

export async function deleteMeal(userId: string, mealId: string): Promise<boolean> {
  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', mealId)
    .eq('user_id', userId);
  if (error) {
    console.error('Error deleting meal from Supabase:', error);
    return false;
  }
  return true;
}