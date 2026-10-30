import { useState } from 'react';
import { TaranaEatsFormValues, ResultMatch } from '@/types/tarana-eats';
import { combinedFoodData, createFoodPrompt, FullMenu } from '../data/taranaEatsData';

export interface ExtendedResultMatch extends ResultMatch {
  fullMenu?: FullMenu;
  reason?: string;
}

export const useTaranaEatsAI = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const generateRecommendations = async (preferences: TaranaEatsFormValues) => {
    try {
      setLoading(true);
      setError(null);

      const prompt = createFoodPrompt(preferences);
      
      const payload = {
        prompt,
        preferences: {
          pax: preferences.pax,
          budget: preferences.budget,
          cuisine: preferences.cuisine,
          restrictions: preferences.restrictions,
          mealType: preferences.mealType
        }
      };
      const fingerprintSource = JSON.stringify({
        budget: preferences.budget ?? null,
        cuisine: preferences.cuisine ?? null,
        pax: preferences.pax ?? null,
        restrictions: [...(preferences.restrictions ?? [])].sort(),
        mealType: [...(preferences.mealType ?? [])].sort(),
      });
      let fingerprintHash = 0x811c9dc5;
      for (let i = 0; i < fingerprintSource.length; i++) {
        fingerprintHash ^= fingerprintSource.charCodeAt(i);
        fingerprintHash = Math.imul(fingerprintHash, 0x01000193);
      }
      const idempotencyKey = `eats:${(fingerprintHash >>> 0).toString(16).padStart(8, "0")}`;

      const response = await fetch('/api/gemini/food-recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate recommendations');
      }

      const data = await response.json();
      
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

  const transformGeminiResponse = (response: any, preferences: TaranaEatsFormValues): ExtendedResultMatch[] => {
    try {
      const placeholderImage = "/images/placeholders/hero-placeholder.svg";
      
      if (response.matches && Array.isArray(response.matches)) {
        return response.matches.map((match: { name: string; [key: string]: any }) => {
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
      
      return combinedFoodData.restaurants
        .filter(restaurant => {
          if (preferences.cuisine && preferences.cuisine !== "Show All") {
            if (!restaurant.cuisine.includes(preferences.cuisine)) {
              return false;
            }
          }
          
          if (preferences.restrictions && preferences.restrictions.length > 0) {
            const hasAllRestrictions = preferences.restrictions.every(restriction => 
              restaurant.dietaryOptions.includes(restriction)
            );
            if (!hasAllRestrictions) {
              return false;
            }
          }
          
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
        .map(restaurant => {
          const budgetNum = preferences.budget ? parseInt(preferences.budget.replace(/[^\d]/g, '')) : null;
          const finalPrice = budgetNum && budgetNum > 0 ? budgetNum : restaurant.priceRange.max;
          
          console.log("🔍 AI HOOK DEBUG:", {
            restaurantName: restaurant.name,
            userBudgetInput: preferences.budget,
            extractedBudgetNum: budgetNum,
            restaurantMaxPrice: restaurant.priceRange.max,
            finalPriceUsed: finalPrice,
            groupSize: preferences.pax || 2
          });
          
          return {
            name: restaurant.name,
            meals: preferences.pax || 2,
            price: finalPrice,
            image: (restaurant.image && restaurant.image !== "") ? restaurant.image : placeholderImage,
            fullMenu: restaurant.fullMenu,
            reason: `This restaurant offers ${restaurant.cuisine.join(', ')} cuisine and is popular for ${restaurant.popularFor.join(', ')}.`
          };
        });
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