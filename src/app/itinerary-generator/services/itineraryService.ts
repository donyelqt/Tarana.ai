import { WeatherData } from "@/lib/utils";
import { ItineraryData, FormData } from "../types";
import { sampleItinerary } from "../data/itineraryData";

/**
 * Generates an itinerary by calling the Gemini API
 * @param formData The form data for generating the itinerary
 * @param weatherData Current weather data for Baguio
 * @returns The generated itinerary or error
 */
export const generateItinerary = async (
  formData: FormData,
  weatherData: WeatherData | null
): Promise<{ itinerary: ItineraryData | null; error: string | null }> => {
  try {
    const prompt = `Create a personalized ${formData.duration}-day itinerary for Baguio City, Philippines based on the user preferences and current weather conditions.`;

    // Call Gemini API via backend route
    const response = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        weatherData,
        interests: formData.selectedInterests.length > 0 ? formData.selectedInterests : ["Random"],
        duration: formData.duration,
        budget: formData.budget,
        pax: formData.pax,
        sampleItinerary,
      }),
    });

    const { text, error } = await response.json();

    if (error || !text) {
      console.error("Gemini API Error:", error || "No text returned");
      throw new Error(error || "Gemini API returned an empty response");
    }

    let parsedData;
    try {
      parsedData = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse JSON from Gemini API:", e);
      throw new Error("Failed to parse JSON from Gemini API");
    }

    if (!parsedData || !parsedData.items || !Array.isArray(parsedData.items)) {
      console.error("Invalid itinerary structure");
      return { 
        itinerary: null, 
        error: "The generated itinerary has an invalid structure. Using sample data instead." 
      };
    }

    return { itinerary: parsedData, error: null };
  } catch (error: any) {
    console.error("Error generating itinerary:", error);
    return { 
      itinerary: null, 
      error: error.message || "An unexpected error occurred" 
    };
  }
};

/**
 * Enhances the itinerary with images and weather-appropriate tags
 * @param itinerary The raw itinerary data
 * @param weatherData Current weather data for appropriate tagging
 * @returns Enhanced itinerary with matching images and weather tags
 */
export const enhanceItinerary = (
  itinerary: ItineraryData,
  weatherData: WeatherData | null
): ItineraryData => {
  return {
    ...itinerary,
    items: itinerary.items.map((section: any) => ({
      ...section,
      activities: section.activities.map((activity: any) => {
        // Use the image provided by the backend if present; otherwise attempt to find a match in the local sample DB.
        let matchingImage: any = activity.image || "burnham";
        let bestMatchScore = 0;
        for (const sampleSection of sampleItinerary.items) {
          for (const sampleActivity of sampleSection.activities) {
            let currentScore = 0;
            if (activity.title && sampleActivity.title) {
              const activityTitle = activity.title.toLowerCase();
              const sampleTitle = sampleActivity.title.toLowerCase();
              if (activityTitle === sampleTitle) currentScore += 10;
              else if (activityTitle.includes(sampleTitle) || sampleTitle.includes(activityTitle)) currentScore += 5;
              else {
                const activityWords = activityTitle.split(/\s+/);
                const sampleWords = sampleTitle.split(/\s+/);
                for (const word of activityWords) {
                  if (word.length > 3 && sampleWords.includes(word)) currentScore += 2;
                }
              }
            }
            if (activity.tags && sampleActivity.tags) {
              for (const tag of activity.tags) {
                if (sampleActivity.tags.includes(tag)) currentScore += 3;
              }
            }
            if (currentScore > bestMatchScore) {
              bestMatchScore = currentScore;
              matchingImage = sampleActivity.image || matchingImage;
            }
          }
        }
        
        // Add weather-appropriate tags
        const tags = [...(activity.tags || [])];
        const weatherCondition = weatherData?.weather?.[0]?.main?.toLowerCase() || "";
        if (weatherCondition.includes("rain") && !tags.includes("Indoor-Friendly")) {
          tags.push("Indoor-Friendly");
        } else if (weatherCondition.includes("clear") && !tags.includes("Outdoor-Friendly")) {
          tags.push("Outdoor-Friendly");
        } else if (!tags.includes("Weather-Flexible")) {
          tags.push("Weather-Flexible");
        }
        
        return { ...activity, image: matchingImage, tags };
      }),
    })),
  };
};