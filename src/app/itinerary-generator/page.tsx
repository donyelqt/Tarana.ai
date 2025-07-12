"use client";

import Sidebar from "../../components/Sidebar";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { fetchWeatherFromAPI, WeatherData } from "@/lib/utils";
import { saveItinerary } from "@/lib/savedItineraries";
import ItineraryForm, { FormData as ItineraryFormData } from "./components/ItineraryForm";
import ItineraryPreview from "./components/ItineraryPreview";
import { 
  sampleItinerary, 
  ItineraryData, 
  burnham, 
  taranaai, 
  budgetOptions, 
  paxOptions, 
  durationOptions, 
  interests 
} from "./components/itineraryData";
// import usePuter from "../../hooks/usePuter";
// import { puterConfig } from "../../config/puter";

export default function ItineraryGenerator() {
  // State for form inputs will be managed within ItineraryForm, 
  // but we need a snapshot here for API call and saving.
  const [formSnapshot, setFormSnapshot] = useState<ItineraryFormData | null>(null);
  // These states are still needed for the handleSubmit and handleSave logic in this file.
  const [budget, setBudget] = useState(budgetOptions[0]);
  const [pax, setPax] = useState("");
  const [duration, setDuration] = useState("");
  const [dates, setDates] = useState<{ start: Date | undefined; end: Date | undefined }>({ start: undefined, end: undefined });
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]); // Still needed for handleSubmit
  const [showPreview, setShowPreview] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingItinerary, setIsLoadingItinerary] = useState<boolean>(false);
  const [generatedItinerary, setGeneratedItinerary] = useState<ItineraryData | null>(null); // Uses ItineraryData from itineraryData.ts
  const router = useRouter();
  const { toast } = useToast();
  // Load the free key-less Gemini client
  // const puter = usePuter(); // removed – using backend Gemini API instead

  useEffect(() => {
    const getWeather = async () => {
      try {
        const data = await fetchWeatherFromAPI();
        setWeatherData(data);
        console.log("Weather data fetched:", data);
      } catch (error) {
        console.error("Failed to fetch weather data:", error);
      }
    };

    getWeather();
  }, []);

  // This function is now passed to ItineraryForm but defined here
  // as it uses state (selectedInterests) also used by handleSubmit.
  // Alternatively, selectedInterests could be fully managed by ItineraryForm 
  // and passed up only on submit.
  const handleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  // Renamed from handleSubmit to handleGenerateItinerary to be more specific
  // It now takes formData from the ItineraryForm component
  const handleGenerateItinerary = async (formData: ItineraryFormData) => {
    // Update local state based on formData for API call and saving
    setBudget(formData.budget);
    setPax(formData.pax);
    setDuration(formData.duration);
    if (formData.dates.start && formData.dates.end) {
      setDates({ start: new Date(formData.dates.start), end: new Date(formData.dates.end) });
    }
    setSelectedInterests(formData.selectedInterests); // Ensure this is updated if handleInterest is moved
    setFormSnapshot(formData); // Save the complete form data snapshot

    setIsGenerating(true);
    setIsLoadingItinerary(true);

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
        toast({
          title: "Structure Error",
          description: "The generated itinerary has an invalid structure. Using sample data instead.",
          variant: "destructive",
        });
        parsedData = sampleItinerary;
      }

      const processedItinerary: ItineraryData = {
        ...parsedData,
        items: parsedData.items.map((section: any) => ({
          ...section,
          activities: section.activities.map((activity: any) => {
            // Use the image provided by the backend if present; otherwise attempt to find a match in the local sample DB.
            let matchingImage: any = activity.image || burnham;
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
            const tags = [...(activity.tags || [])];
            const weatherCondition = weatherData?.weather?.[0]?.main?.toLowerCase() || "";
            if (weatherCondition.includes("rain") && !tags.includes("Indoor-Friendly")) tags.push("Indoor-Friendly");
            else if (weatherCondition.includes("clear") && !tags.includes("Outdoor-Friendly")) tags.push("Outdoor-Friendly");
            else if (!tags.includes("Weather-Flexible")) tags.push("Weather-Flexible");
            return { ...activity, image: matchingImage, tags };
          }),
        })),
      };

      setGeneratedItinerary(processedItinerary);
      setShowPreview(true);
    } catch (error) {
      console.error("Error generating itinerary:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Using sample data instead.",
        variant: "destructive",
      });
      setGeneratedItinerary(sampleItinerary);
      setShowPreview(true);
    } finally {
      setIsGenerating(false);
      setIsLoadingItinerary(false);
    }
  };

  const handleSaveItinerary = () => {
    if (!formSnapshot || (!generatedItinerary && !sampleItinerary)) {
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
        date: formSnapshot.dates.start && formSnapshot.dates.end ? `${new Date(formSnapshot.dates.start).toLocaleDateString()} - ${new Date(formSnapshot.dates.end).toLocaleDateString()}` : "Date not specified",
        budget: formSnapshot.budget,
        image: (generatedItinerary || sampleItinerary)?.items[0]?.activities[0]?.image || burnham, // Default image if none found
        tags: formSnapshot.selectedInterests.length > 0 ? formSnapshot.selectedInterests : ((generatedItinerary || sampleItinerary)?.items.flatMap(i => i.activities.flatMap(a => a.tags || [])) || []),
        formData: {
          ...formSnapshot,
          dates: {
            start: formSnapshot.dates.start ? new Date(formSnapshot.dates.start).toISOString() : "",
            end: formSnapshot.dates.end ? new Date(formSnapshot.dates.end).toISOString() : "",
          },
        },
        weatherData: weatherData || undefined,
        itineraryData: generatedItinerary || sampleItinerary,
      };
      saveItinerary(itineraryToSave);
      toast({
        title: "Success",
        description: "Itinerary saved!",
        variant: "success",
      });
      setTimeout(() => {
        router.push("/saved-trips");
      }, 1200);
    } catch (error) {
      console.error("Failed to save itinerary:", error);
      toast({
        title: "Error",
        description: "Failed to save itinerary. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="bg-white">
      <Sidebar />
      <main className="md:h-screen md:overflow-hidden md:pl-64 flex flex-col md:flex-row">
        <div className="flex-1 md:overflow-y-auto">
          <ItineraryForm
            showPreview={showPreview}
            isGenerating={isGenerating}
            isLoadingItinerary={isLoadingItinerary}
            onSubmitItinerary={handleGenerateItinerary}
            weatherData={weatherData}
            budget={budget}
            setBudget={setBudget}
            pax={pax}
            setPax={setPax}
            duration={duration}
            setDuration={setDuration}
            dates={dates}
            setDates={setDates}
            selectedInterests={selectedInterests}
            setSelectedInterests={setSelectedInterests}
            handleInterest={handleInterest}
            interests={interests}
            budgetOptions={budgetOptions}
            paxOptions={paxOptions}
            durationOptions={durationOptions}
          />
        </div>
        <div className="w-full md:w-[450px] border-l md:overflow-y-auto">
          <ItineraryPreview
            showPreview={showPreview}
            isLoadingItinerary={isLoadingItinerary}
            generatedItinerary={generatedItinerary}
            weatherData={weatherData}
            onSave={handleSaveItinerary}
            taranaaiLogo={taranaai} // Pass taranaai logo
          />
        </div>
      </main>
    </div>
  );
}
