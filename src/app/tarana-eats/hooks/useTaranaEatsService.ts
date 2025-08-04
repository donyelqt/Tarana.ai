import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MenuItem, ResultMatch } from '@/types/tarana-eats';
import { SavedMeal } from '@/app/saved-meals/data';
import { FullMenu } from '../data/taranaEatsData';
import { ExtendedResultMatch } from './useTaranaEatsAI';
import { useToast } from '@/components/ui/use-toast';
// Import uuid in a way that's compatible with Next.js
import { v4 as uuidv4 } from 'uuid';

// We'll use localStorage as a simple client-side storage mechanism
// In a real app, this would use API calls to a database

export const useTaranaEatsService = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Generate a unique ID for a new saved meal - using a workaround for client-side only code
  const generateMealId = () => {
    // Make sure we're on the client side before using UUID
    if (typeof window !== 'undefined') {
      return uuidv4();
    }
    return Math.random().toString(36).substring(2, 15);
  };

  // Save the selected menu items to the saved meals
  const saveToMeals = (
    restaurant: ResultMatch | ExtendedResultMatch, 
    selectedItems: MenuItem[], 
    mealType: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' = 'Dinner'
  ) => {
    try {
      if (typeof window === 'undefined') {
        toast({
          title: "Error",
          description: "Cannot save meals on server side",
          variant: "destructive",
        });
        return null;
      }
      
      setLoading(true);
      setError(null);
      
      // Calculate the total price
      const totalPrice = selectedItems.reduce((sum, item) => sum + item.price, 0);
      
      // Get the existing saved meals from localStorage or create an empty array
      const existingSavedMeals: SavedMeal[] = JSON.parse(localStorage.getItem('savedMeals') || '[]');
      
      // Create a new saved meal
      const newMealId = generateMealId();
      const newSavedMeal: SavedMeal = {
        id: newMealId,
        cafeName: restaurant.name,
        mealType,
        price: totalPrice,
        goodFor: restaurant.meals,
        location: "Baguio City", // Default location, could be more specific in a real app
        image: restaurant.image
      };
      
      // Add the new meal to the existing ones
      const updatedSavedMeals = [...existingSavedMeals, newSavedMeal];
      
      // Store in localStorage
      localStorage.setItem('savedMeals', JSON.stringify(updatedSavedMeals));
      
      // Also save the detailed meal data for the meal detail page
      const mealDetailsData = JSON.parse(localStorage.getItem('mealDetailsData') || '{}');
      
      // Get the full menu from the restaurant if available
      const fullMenu = (restaurant as ExtendedResultMatch).fullMenu;
      
      mealDetailsData[newMealId] = {
        name: restaurant.name,
        location: "Baguio City", // Default location
        hours: "9AM - 9PM", // Default hours
        priceRange: `₱${Math.floor(restaurant.price * 0.8)}-₱${Math.ceil(restaurant.price * 2)}`,
        about: `${restaurant.name} offers a variety of delicious meals in Baguio City.`,
        image: restaurant.image,
        savedMeals: [
          {
            id: `meal-${newMealId}`,
            name: `${mealType} Set`,
            type: mealType,
            items: selectedItems.map(item => ({ 
              name: item.name, 
              price: item.price, 
              quantity: 1,
              image: item.image
            })),
            totalPrice,
            goodFor: restaurant.meals
          }
        ],
        menuItems: selectedItems.map(item => ({
          name: item.name,
          type: mealType,
          price: item.price,
          image: item.image,
          goodFor: 1
        })),
        // Add full menu information
        fullMenu: fullMenu || {
          Breakfast: [],
          Lunch: [],
          Dinner: [],
          Snacks: [],
          Drinks: []
        },
        reason: (restaurant as ExtendedResultMatch).reason || "Recommended based on your preferences"
      };
      
      localStorage.setItem('mealDetailsData', JSON.stringify(mealDetailsData));
      
      setLoading(false);
      
      // Return the ID so we can navigate to it
      return newMealId;
    } catch (err) {
      setError('Failed to save meal');
      setLoading(false);
      console.error('Error saving meal:', err);
      
      toast({
        title: "Error",
        description: "Failed to save meal. Please try again.",
        variant: "destructive",
      });
      
      return null;
    }
  };

  // Navigate to the saved meal detail page
  const navigateToSavedMeal = (mealId: string) => {
    router.push(`/saved-meals/${mealId}`);
  };

  return {
    saveToMeals,
    navigateToSavedMeal,
    loading,
    error
  };
};