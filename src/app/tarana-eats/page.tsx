"use client"
import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import TaranaEatsForm from "./components/TaranaEatsForm";
import FoodMatchesPreview from "./components/FoodMatchesPreview";
import { useToast } from "@/components/ui/use-toast";
import { TaranaEatsFormValues, FoodMatchesData } from "@/types/tarana-eats";
import { combinedFoodData } from "./data/taranaEatsData";

export default function TaranaEatsPage() {
  const [results, setResults] = useState<FoodMatchesData | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleLoadingChange = (isLoading: boolean) => {
    setLoading(isLoading);
  };

  const handleGenerateResults = async (data: any) => {
    try {
      setLoading(true);
      
      // Check if we have AI-generated results already
      if (data.matches) {
        // Ensure all matches have valid images
        const validatedMatches = data.matches.map((match: any) => ({
          ...match,
          image: match.image && match.image !== "" ? match.image : "/images/placeholders/hero-placeholder.svg"
        }));
        
        setResults({ matches: validatedMatches });
        setLoading(false);
        return;
      }
      
      // If we received form values, use them to filter restaurants
      const formValues = data as TaranaEatsFormValues;
      
      // Filter restaurants based on form values
      const filteredRestaurants = combinedFoodData.restaurants
        .filter(restaurant => {
          // Filter by cuisine if specified
          if (formValues.cuisine && formValues.cuisine !== "Show All") {
            if (!restaurant.cuisine.includes(formValues.cuisine)) {
              return false;
            }
          }
          
          // Filter by dietary restrictions
          if (formValues.restrictions && formValues.restrictions.length > 0) {
            const hasAllRestrictions = formValues.restrictions.every(restriction => 
              restaurant.dietaryOptions.includes(restriction)
            );
            if (!hasAllRestrictions) {
              return false;
            }
          }
          
          // Filter by meal type
          if (formValues.mealType && formValues.mealType.length > 0) {
            const hasMatchingMealType = formValues.mealType.some(mealType => 
              restaurant.popularFor.includes(mealType)
            );
            if (!hasMatchingMealType) {
              return false;
            }
          }
          
          return true;
        })
        .map(restaurant => ({
          name: restaurant.name,
          meals: formValues.pax || 2,
          price: restaurant.priceRange.max,
          image: restaurant.image && restaurant.image !== "" ? restaurant.image : "/images/placeholders/hero-placeholder.svg",
          fullMenu: restaurant.fullMenu,
          reason: `This restaurant offers ${restaurant.cuisine.join(', ')} cuisine and is popular for ${restaurant.popularFor.join(', ')}.`
        }));
      
      if (filteredRestaurants.length === 0) {
        toast({
          title: "No matches found",
          description: "Try adjusting your preferences for more results.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }
      
      setResults({ matches: filteredRestaurants });
      
    } catch (error) {
      console.error("Error generating results:", error);
      toast({
        title: "Error",
        description: "Failed to generate food recommendations. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white">
      <Sidebar />
      <main className="md:h-screen md:overflow-hidden md:pl-64 flex flex-col md:flex-row">
        <div className="flex-1 md:overflow-y-auto">
          <TaranaEatsForm onGenerate={handleGenerateResults} isLoading={loading} onLoadingChange={handleLoadingChange} />
        </div>
        <div className="w-full md:w-[450px] border-l md:overflow-y-auto">
          <FoodMatchesPreview results={results} isLoading={loading} />
        </div>
      </main>
    </div>
  );
}