import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MenuItem, ResultMatch } from '@/types/tarana-eats';
import { SavedMeal } from '@/app/saved-meals/data';
import { FullMenu } from '../data/taranaEatsData';
import { ExtendedResultMatch } from './useTaranaEatsAI';
import { useToast } from '@/components/ui/use-toast';
import { useSession } from 'next-auth/react'
import { saveMeal } from '@/lib/data/supabaseMeals';
// Import uuid in a way that's compatible with Next.js
import { v4 as uuidv4 } from 'uuid';

// We'll use localStorage as a simple client-side storage mechanism
// In a real app, this would use API calls to a database

export const useTaranaEatsService = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { data: session } = useSession();

  // Generate a unique ID for a new saved meal - using a workaround for client-side only code
  const generateMealId = () => {
    // Make sure we're on the client side before using UUID
    if (typeof window !== 'undefined') {
      return uuidv4();
    }
    return Math.random().toString(36).substring(2, 15);
  };

  // Save the selected menu items to the saved meals
  const saveToMeals = async (
    restaurant: ResultMatch | ExtendedResultMatch, 
    selectedItems: MenuItem[], 
    mealType: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' = 'Dinner'
  ) => {
    if (!session?.user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to save meals.",
        variant: "destructive",
      });
      return null;
    }
    try {
      setLoading(true);
      setError(null);
      const totalPrice = selectedItems.reduce((sum, item) => sum + item.price, 0);
      const newSavedMeal = {
        cafeName: restaurant.name,
        mealType,
        price: totalPrice,
        goodFor: restaurant.meals,
        location: "Baguio City",
        image: restaurant.image
      };
      const newMealId = await saveMeal(session.user.id, newSavedMeal, selectedItems);
      setLoading(false);
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
  }

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