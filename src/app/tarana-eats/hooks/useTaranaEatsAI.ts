import { useState } from 'react';
import { TaranaEatsFormValues, ResultMatch } from '@/types/tarana-eats';
import { combinedFoodData, createFoodPrompt, FullMenu } from '../data/taranaEatsData';

// Extended ResultMatch to include full menu
export interface ExtendedResultMatch extends ResultMatch {
  fullMenu?: FullMenu;
  reason?: string;
}

export const useTaranaEatsAI = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Generate AI-powered food recommendations based on user preferences
   */
  const generateRecommendations = async (preferences: TaranaEatsFormValues) => {
    try {
      setLoading(true);
      setError(null);

      // Create a prompt for Gemini API
      const prompt = createFoodPrompt(preferences);
      
      // Prepare the request payload
      const payload = {
        prompt,
        foodData: combinedFoodData
      };

      // Call the Gemini API
      const response = await fetch('/api/gemini/food-recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate recommendations');
      }

      const data = await response.json();
      
      // Transform the AI response to match the expected ResultMatch format
      const recommendations = transformGeminiResponse(data, preferences);
      
      setLoading(false);
      return recommendations;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setLoading(false);
      console.error('Error generating AI recommendations:', err);
      return null;
    }
  };

  /**
   * Transform the Gemini API response to the format expected by the UI
   */
  const transformGeminiResponse = (response: any, preferences: TaranaEatsFormValues): ExtendedResultMatch[] => {
    try {
      const placeholderImage = "/images/placeholders/hero-placeholder.svg";
      
      // If we already have properly structured data, use it directly and enhance with full menu data
      if (response.matches && Array.isArray(response.matches)) {
        return response.matches.map((match: { name: string; [key: string]: any }) => {
          // Find the corresponding restaurant to get its full menu
          const restaurant = combinedFoodData.restaurants.find(r => r.name === match.name);
          if (restaurant) {
            return {
              ...match,
              fullMenu: restaurant.fullMenu,
              image: (match.image && match.image !== "") ? match.image : 
                     (restaurant.image && restaurant.image !== "") ? restaurant.image : 
                     placeholderImage
            };
          }
          return {
            ...match,
            image: (match.image && match.image !== "") ? match.image : placeholderImage
          };
        });
      }
      
      // Otherwise, use restaurants from our data that match the user preferences
      return combinedFoodData.restaurants
        .filter(restaurant => {
          // Filter by cuisine if specified
          if (preferences.cuisine && preferences.cuisine !== "Show All") {
            if (!restaurant.cuisine.includes(preferences.cuisine)) {
              return false;
            }
          }
          
          // Filter by dietary restrictions
          if (preferences.restrictions && preferences.restrictions.length > 0) {
            const hasAllRestrictions = preferences.restrictions.every(restriction => 
              restaurant.dietaryOptions.includes(restriction)
            );
            if (!hasAllRestrictions) {
              return false;
            }
          }
          
          // Filter by meal type
          if (preferences.mealType && preferences.mealType.length > 0) {
            const hasMatchingMealType = preferences.mealType.some(mealType => 
              restaurant.popularFor.includes(mealType)
            );
            if (!hasMatchingMealType) {
              return false;
            }
          }
          
          return true;
        })
        .slice(0, 5) // Limit to 5 results
        .map(restaurant => ({
          name: restaurant.name,
          meals: preferences.pax || 2,
          price: restaurant.priceRange.max,
          image: (restaurant.image && restaurant.image !== "") ? restaurant.image : placeholderImage,
          fullMenu: restaurant.fullMenu,
          reason: `This restaurant offers ${restaurant.cuisine.join(', ')} cuisine and is popular for ${restaurant.popularFor.join(', ')}.`
        }));
    } catch (err) {
      console.error('Error transforming Gemini response:', err);
      return [];
    }
  };

  return {
    generateRecommendations,
    loading,
    error
  };
}; 