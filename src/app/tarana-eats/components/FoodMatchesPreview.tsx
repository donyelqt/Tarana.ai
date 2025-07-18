import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import MenuPopup from './MenuPopup';
import { MenuItem, ResultMatch } from '@/types/tarana-eats';
import { useTaranaEatsService } from '@/app/tarana-eats/hooks/useTaranaEatsService';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';

interface FoodMatchesPreviewProps {
  results: { matches: ResultMatch[] } | null;
}

export default function FoodMatchesPreview({ results }: FoodMatchesPreviewProps) {
  const [activeMatch, setActiveMatch] = useState<ResultMatch | null>(null);
  const [savedSelections, setSavedSelections] = useState<Record<string, MenuItem[]>>({});
  const { saveToMeals, loading } = useTaranaEatsService();
  const { toast } = useToast();
  const router = useRouter();

  const handleSaveSelection = (restaurantName: string, items: MenuItem[]) => {
    setSavedSelections(prev => ({ ...prev, [restaurantName]: items }));
  };

  const handleSaveAllMeals = () => {
    // Only run on client side
    if (typeof window === 'undefined') {
      return;
    }
    
    // Check if there are any selections to save
    const selectionEntries = Object.entries(savedSelections);
    if (selectionEntries.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select at least one meal before saving",
        variant: "destructive"
      });
      return;
    }

    // Track how many meals were saved
    let savedMealsCount = 0;
    let failedSavesCount = 0;
    
    // Save each selected restaurant's meals
    selectionEntries.forEach(([restaurantName, menuItems]) => {
      const restaurantMatch = results?.matches.find(match => match.name === restaurantName);
      
      if (!restaurantMatch || menuItems.length === 0) {
        failedSavesCount++;
        return;
      }
      
      // Determine meal type based on time of day (or could be selected by user)
      const hour = new Date().getHours();
      let mealType: 'Breakfast' | 'Dinner' | 'Snack';
      
      if (hour < 11) mealType = 'Breakfast';
      else if (hour < 16) mealType = 'Dinner';
      else mealType = 'Dinner';
      
      // Save the meal
      const savedMealId = saveToMeals(restaurantMatch, menuItems, mealType);
      
      if (savedMealId) {
        savedMealsCount++;
      } else {
        failedSavesCount++;
      }
    });
    
    // Show appropriate notification based on results
    if (savedMealsCount > 0) {
      toast({
        title: "Success",
        description: `${savedMealsCount} meal${savedMealsCount > 1 ? 's' : ''} saved!`,
        variant: "success"
      });
      
      // Navigate to the main saved meals page after a short delay
      setTimeout(() => {
        router.push("/saved-meals");
      }, 1200);
    } else {
      toast({
        title: "Error",
        description: "Failed to save meals. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <>
      {activeMatch && (
        <MenuPopup
          match={activeMatch}
          onClose={() => setActiveMatch(null)}
          onSave={(items) => handleSaveSelection(activeMatch.name, items)}
        />
      )}
      <div className="rounded-lg h-full p-6 w-full">
        {results ? (
          <>
            <h2 className="text-xl font-bold mb-2">Your Food Matches</h2>
            <p className="text-gray-500 mb-6">A preview of your matched meal plans!</p>
            <div className="space-y-4">
              {results.matches.map((match, idx) => {
                const selection = savedSelections[match.name];
                const total = selection?.reduce((sum, item) => sum + item.price, 0);
                const hasValidImage = match.image && match.image !== "";
                const placeholderImage = "/images/placeholders/hero-placeholder.svg";

                return (
                  <div key={idx} className="rounded-xl shadow border p-4">
                    <div className="relative w-full h-32 rounded-lg mb-4 overflow-hidden">
                      {hasValidImage ? (
                        <Image src={match.image} alt={match.name} fill style={{ objectFit: "cover" }} />
                      ) : (
                        <Image src={placeholderImage} alt={match.name} fill style={{ objectFit: "cover" }} />
                      )}
                    </div>
                    <div className="font-semibold text-lg">{match.name}</div>
                    <div className="text-gray-500 text-sm">{match.meals} meals under ₱{match.price}</div>
                    
                    {/* AI Recommendation Reason */}
                    {match.reason && (
                      <div className="mt-2 px-2 py-1 bg-blue-50 rounded text-sm text-blue-800 border border-blue-100">
                        <p className="italic">"{match.reason}"</p>
                      </div>
                    )}
                    
                    {selection && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <h4 className="font-semibold text-sm">Your Selection</h4>
                          <p className="font-bold text-sm">Total: ₱{total || 0}</p>
                        </div>
                        <ul className="list-disc pl-5 mt-2 text-sm text-gray-600">
                          {selection.map(item => <li key={item.name}>{item.name} - ₱{item.price}</li>)}
                        </ul>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between mt-4">
                      <Button onClick={() => setActiveMatch(match)}>
                        {selection ? 'Edit Menu' : 'View Menu'}
                      </Button>
                      <Button variant="outline" size="icon">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-3.125L5 18V4z" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                );
              })}
              <Button 
                className="w-full mt-4" 
                onClick={handleSaveAllMeals} 
                disabled={loading || Object.keys(savedSelections).length === 0}
              >
                {loading ? 'Saving...' : 'Save Meals'}
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center rounded-lg flex flex-col items-center justify-center h-[90vh]">
            <div className="mb-4 text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Find Your Next Meal</h3>
            <p className="text-gray-500">Your food matches will appear here.</p>
          </div>
        )}
      </div>
    </>
  );
} 