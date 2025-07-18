"use client";

import Sidebar from "../../components/Sidebar";
import { useState, useEffect } from "react";
import { taranaai } from "../../../public";
import { fetchWeatherData } from "./utils/weatherUtils";
import { useItineraryForm } from "./hooks/useItineraryForm";
import { useItineraryGenerator } from "./hooks/useItineraryGenerator";
import ItineraryForm from "./components/ItineraryForm";
import ItineraryPreview from "./components/ItineraryPreview";
import { 
  budgetOptions, 
  paxOptions, 
  durationOptions, 
  interests 
} from "./data/itineraryData";
import { FormData } from "./types";
import { WeatherData } from "@/lib/utils";

export default function ItineraryGenerator() {
  // Get weather data
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  
  // Initialize form state hook
  const {
    budget,
    setBudget,
    pax,
    setPax,
    duration,
    setDuration,
    dates,
    setDates,
    selectedInterests,
    setSelectedInterests,
    showPreview,
    setShowPreview,
    isGenerating,
    setIsGenerating,
    isLoadingItinerary,
    setIsLoadingItinerary,
    handleInterest,
  } = useItineraryForm({
    initialBudget: budgetOptions[0],
  });
  
  // Initialize itinerary generator hook
  const {
    generatedItinerary,
    handleGenerateItinerary,
    handleSaveItinerary
  } = useItineraryGenerator();
  
  // Fetch weather data on component mount
  useEffect(() => {
    const getWeather = async () => {
      const data = await fetchWeatherData();
      setWeatherData(data);
    };

    getWeather();
  }, []);
  
  // Handler for form submission
  const onSubmitItinerary = async (formData: FormData) => {
    setShowPreview(true);
    await handleGenerateItinerary(
      formData, 
      weatherData,
      {
        onStart: () => {
          setIsGenerating(true);
          setIsLoadingItinerary(true);
        },
        onComplete: () => {
          setIsGenerating(false);
          setIsLoadingItinerary(false);
        },
        onError: (error) => {
          console.error("Error in itinerary generation:", error);
        }
      }
    );
  };
  
  // Handler for saving the itinerary
  const onSaveItinerary = () => {
    handleSaveItinerary(weatherData);
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
            onSubmitItinerary={onSubmitItinerary}
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
            onSave={onSaveItinerary}
            taranaaiLogo={taranaai}
          />
        </div>
      </main>
    </div>
  );
}
