import { WeatherData } from "@/lib/core";
import { ItineraryData, FormData, CityId } from "../types";
import { sampleItinerary } from "../data/itineraryData";

export const generateItinerary = async (
  formData: FormData,
  weatherData: WeatherData | null
): Promise<{ itinerary: ItineraryData | null; error: string | null }> => {
  try {
    const promptDetails = [];
    
    const cityLabelMap: Record<string, string> = {
      baguio: "Baguio City, Philippines",
      cebu: "Cebu City, Philippines",
      manila: "Manila, Philippines",
      davao: "Davao City, Philippines",
      boracay: "Boracay, Philippines",
      el_nido: "El Nido, Palawan, Philippines",
      "ph-wide": "the Philippines",
      world: "the selected destination",
    }
    const cityLabel = cityLabelMap[formData.cityId || "baguio"] || "Baguio City, Philippines"
    promptDetails.push(`Create a personalized ${formData.duration}-day itinerary for ${cityLabel}`);
    
    if (formData.selectedInterests.length > 0) {
      promptDetails.push(`focusing on ${formData.selectedInterests.join(", ")}`);
    }
    
    if (formData.budget) {
      promptDetails.push(`with a ${formData.budget} budget`);
    }
    
    if (formData.pax) {
      promptDetails.push(`for a ${formData.pax}`);
    }
    
    if (weatherData?.weather?.[0]?.main) {
      promptDetails.push(`considering the current ${weatherData.weather[0].main} weather`);
    }

    if (formData.peakHours) {
      promptDetails.push(`and avoiding peak hours`);
    }
    
    const prompt = promptDetails.join(" ");

    const response = await fetch("/api/gemini/itinerary-generator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        ...(weatherData ? { weatherData } : {}),
        interests: formData.selectedInterests.length > 0 ? formData.selectedInterests : ["Random"],
        duration: formData.duration,
        budget: formData.budget,
        pax: formData.pax,
        sampleItinerary,
        cityId: formData.cityId || "baguio",
        options: formData.trafficAware !== false ? { trafficAware: true } : { trafficAware: false },
      }),
    });

    const responseData = await response.json();
    const { text, error, details } = responseData;

    if (error || !text) {
      console.error("Gemini API Error:", error || "No text returned");
      if (details) {
        console.error("Error details:", details);
      }
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

export const enhanceItinerary = (
  itinerary: ItineraryData,
  weatherData: WeatherData | null,
  cityId?: CityId
): ItineraryData => {
  return {
    ...itinerary,
    items: itinerary.items.map((section: any) => ({
      ...section,
      activities: section.activities.map((activity: any) => {
        const relevanceScore = activity.relevanceScore !== undefined ? activity.relevanceScore : null;
        
        let matchingImage: any = activity.image || null;
        if (!matchingImage && cityId === "baguio") {
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
        }
        
        const tags = [...(activity.tags || [])];
        const weatherCondition = weatherData?.weather?.[0]?.main?.toLowerCase() || "";
        if (weatherCondition.includes("rain") && !tags.includes("Indoor-Friendly")) {
          tags.push("Indoor-Friendly");
        } else if (weatherCondition.includes("clear") && !tags.includes("Outdoor-Friendly")) {
          tags.push("Outdoor-Friendly");
        } else if (!tags.includes("Weather-Flexible")) {
          tags.push("Weather-Flexible");
        }
        
        const finalImage = matchingImage || "/images/taranaai.png";
        return relevanceScore !== null
          ? { ...activity, image: finalImage, tags, relevanceScore }
          : { ...activity, image: finalImage, tags };
      }),
    })),
  };
};