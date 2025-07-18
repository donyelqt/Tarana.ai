import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';
import { FormData, ItineraryData } from '../types';
import { WeatherData } from '@/lib/utils';
import { saveItinerary } from '@/lib/savedItineraries';
import { generateItinerary, enhanceItinerary } from '../services/itineraryService';
import { sampleItinerary } from '../data/itineraryData';
import { burnham } from '../../../../public';

export const useItineraryGenerator = () => {
  const [generatedItinerary, setGeneratedItinerary] = useState<ItineraryData | null>(null);
  const [formSnapshot, setFormSnapshot] = useState<FormData | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  /**
   * Generate an itinerary based on form data and weather information
   */
  const handleGenerateItinerary = useCallback(async (
    formData: FormData, 
    weatherData: WeatherData | null, 
    callbacks: { 
      onStart?: () => void, 
      onComplete?: () => void,
      onError?: (error: string) => void
    } = {}
  ) => {
    const { onStart, onComplete, onError } = callbacks;
    
    // Save a snapshot of the form data
    setFormSnapshot(formData);
    
    // Trigger start callback
    if (onStart) onStart();

    try {
      // Call the API service to generate the itinerary
      const { itinerary, error } = await generateItinerary(formData, weatherData);

      // Handle API error
      if (error || !itinerary) {
        console.error("Error from generateItinerary:", error);
        if (onError) onError(error || "Unknown error generating itinerary");
        
        // Use sample itinerary as fallback
        const enhancedSampleItinerary = enhanceItinerary(sampleItinerary, weatherData);
        setGeneratedItinerary(enhancedSampleItinerary);
        
        toast({
          title: "Using Sample Data",
          description: error || "An error occurred. Using sample data instead.",
          variant: "destructive",
        });
        return;
      }

      // Enhance the generated itinerary with images and weather-appropriate tags
      const enhancedItinerary = enhanceItinerary(itinerary, weatherData);
      setGeneratedItinerary(enhancedItinerary);

    } catch (error: any) {
      console.error("Unhandled error in handleGenerateItinerary:", error);
      if (onError) onError(error.message || "An unexpected error occurred");

      // Use sample itinerary as fallback
      const enhancedSampleItinerary = enhanceItinerary(sampleItinerary, weatherData);
      setGeneratedItinerary(enhancedSampleItinerary);
      
      toast({
        title: "Error",
        description: "An unexpected error occurred. Using sample data instead.",
        variant: "destructive",
      });
    } finally {
      // Always trigger complete callback
      if (onComplete) onComplete();
    }
  }, [toast]);

  /**
   * Save the generated itinerary to the database
   */
  const handleSaveItinerary = useCallback(async (weatherData: WeatherData | null) => {
    if (!formSnapshot || !generatedItinerary) {
      toast({
        title: "Error",
        description: "Cannot save itinerary. Form data or itinerary data is missing.",
        variant: "destructive",
      });
      return;
    }

    try {
      const itineraryToSave = {
        title: formSnapshot.duration ? `Your ${formSnapshot.duration} Itinerary` : "Your Itinerary",
        date: formSnapshot.dates.start && formSnapshot.dates.end 
          ? `${new Date(formSnapshot.dates.start).toLocaleDateString()} - ${new Date(formSnapshot.dates.end).toLocaleDateString()}`
          : "Date not specified",
        budget: formSnapshot.budget,
        image: generatedItinerary?.items[0]?.activities[0]?.image || burnham,
        tags: formSnapshot.selectedInterests.length > 0 
          ? formSnapshot.selectedInterests 
          : (generatedItinerary?.items.flatMap(i => i.activities.flatMap(a => a.tags || [])) || []),
        formData: {
          ...formSnapshot,
          dates: {
            start: formSnapshot.dates.start ? new Date(formSnapshot.dates.start).toISOString() : "",
            end: formSnapshot.dates.end ? new Date(formSnapshot.dates.end).toISOString() : "",
          },
        },
        weatherData: weatherData || undefined,
        itineraryData: generatedItinerary,
      };

      await saveItinerary(itineraryToSave);
      
      toast({
        title: "Success",
        description: "Itinerary saved!",
        variant: "success",
      });

      // Navigate to saved trips after a short delay
      setTimeout(() => {
        router.push("/saved-trips");
      }, 1200);
    } catch (error: any) {
      console.error("Failed to save itinerary:", error);
      toast({
        title: "Error",
        description: "Failed to save itinerary. Please try again.",
        variant: "destructive",
      });
    }
  }, [formSnapshot, generatedItinerary, router, toast]);

  return {
    generatedItinerary,
    formSnapshot,
    handleGenerateItinerary,
    handleSaveItinerary,
    setGeneratedItinerary,
    setFormSnapshot
  };
}; 