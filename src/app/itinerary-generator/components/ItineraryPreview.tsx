"use client"

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ItineraryPreviewProps } from "../types";
import { sampleItinerary } from "../data/itineraryData";
import { getWeatherIconUrl, getWeatherDescription } from "../utils/weatherUtils";
import { TrafficCone } from "lucide-react";
import { isCurrentlyPeakHours } from "@/lib/peakHours";

// Traffic styles matching dashboard implementation
const trafficStyles: { [key: string]: string } = {
  Low: "border-green-300 bg-green-50 text-green-600",
  Moderate: "border-yellow-300 bg-yellow-50 text-yellow-600",
  High: "border-red-300 bg-red-50 text-red-600",
};

// Function to determine traffic level based on peak hours
const getTrafficLevel = (activity: any): "Low" | "Moderate" | "High" => {
  // If activity has isCurrentlyPeak flag, use that
  if (activity.isCurrentlyPeak !== undefined) {
    return activity.isCurrentlyPeak ? "High" : "Low";
  }
  
  // Fallback: check peak hours string if available
  if (activity.peakHours) {
    return isCurrentlyPeakHours(activity.peakHours) ? "High" : "Low";
  }
  
  // Default to LOW traffic since the system prioritizes low-traffic recommendations
  return "Low";
};

export default function ItineraryPreview({
  showPreview,
  isLoadingItinerary,
  generatedItinerary,
  weatherData,
  onSave,
  taranaaiLogo
}: ItineraryPreviewProps) {
  if (isLoadingItinerary) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-white/80 z-10 rounded-2xl shadow-md p-6">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-lg font-semibold text-gray-700">Generating your itinerary...</p>
        <p className="text-md font-semibold text-gray-700">Thinking mode...</p>
        <p className="text-sm text-gray-500">This might take a moment. Please wait.</p>
      </div>
    );
  }

  if (!showPreview || !generatedItinerary) {
    return (
      <aside className={cn(
        "w-full h-full",
        !showPreview ? "block" : "hidden"
      )}>
        <div className="bg-white rounded-2xl shadow-md p-6 h-full flex flex-col items-center justify-center">
          <Image src={taranaaiLogo} alt="Plan your trip icon" width={100} height={100} className="text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Plan Your Perfect Trip</h3>
          <p className="text-gray-500 text-center">Fill in the details on the left to generate your personalized Baguio itinerary.</p>
        </div>
      </aside>
    );
  }

  const displayItinerary = generatedItinerary || sampleItinerary;

  // Handle the case where the itinerary is valid but has no items (e.g., no activities found)
  if (displayItinerary && (!displayItinerary.items || displayItinerary.items.length === 0)) {
    return (
      <aside className={cn("w-full h-full", showPreview ? "block" : "hidden")}>
        <div className="bg-white rounded-2xl shadow-md p-6 h-full flex flex-col items-center justify-center text-center">
          <Image src={taranaaiLogo} alt="Tarana.ai Suggestion" width={80} height={80} className="mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">{displayItinerary.title}</h3>
          <p className="text-gray-600">{displayItinerary.subtitle}</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className={cn(
      "w-full h-full",
      showPreview ? "block" : "hidden"
    )}>
      <div className="bg-white rounded-2xl shadow-md p-4">
        <div className="mb-2 text-sm text-gray-900 font-bold">{displayItinerary.title}</div>
        <div className="mb-4 text-xs text-gray-700">{displayItinerary.subtitle}</div>

        {/* Weather information */}
        {weatherData && (
          <div className="mb-4 p-3 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center">
            <div className="flex-shrink-0 mr-2">
              <Image
                src={getWeatherIconUrl(weatherData)}
                alt={weatherData.weather[0].description}
                width={40}
                height={40}
              />
            </div>
            <div>
              <div className="text-sm font-medium text-white">Current Weather in Baguio</div>
              <div className="text-xs text-gray-100">
                {getWeatherDescription(weatherData)}
              </div>
              <div className="text-xs text-gray-200 italic mt-1">
                Itinerary adapted to current weather and traffic conditions
              </div>
            </div>
          </div>
        )}
        {displayItinerary.items.map((section, idx) => (
          <div key={idx} className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-semibold">{section.period}</span>
            </div>
            {section.activities && section.activities.length > 0 ? (
              section.activities.map((act, i) => {
                let imageSrc: string = "";
                if (typeof act.image === "string") {
                  // Ensure relative paths start with a leading slash
                  if (act.image.startsWith("images/")) {
                    imageSrc = `/${act.image}`;
                  } else {
                    imageSrc = act.image;
                  }
                } else if (act.image && typeof act.image === "object" && "src" in act.image) {
                  imageSrc = act.image.src;
                }
                return (
                  <div key={i} className="bg-white rounded-xl shadow-md mb-4 overflow-hidden border border-gray-100">
                    <Image src={imageSrc} alt={act.title} width={300} height={200} className="w-full h-[200px] object-cover" />
                    <div className="p-4">
                      <div className="font-semibold text-gray-900 text-base mb-1">{act.title}</div>
                      <div className="text-xs text-gray-500 mb-2">{act.time}</div>
                      <div className="text-sm text-gray-700 mb-3">
                        {act.desc}
                        {/* Add traffic timing hint */}
                        {act.peakHours && (
                          <div className="text-xs text-gray-500 mt-1 italic">
                            Peak hours: {act.peakHours}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap mb-3">
                        {/* Traffic Level Tag */}
                        {(() => {
                          const trafficLevel = getTrafficLevel(act);
                          return (
                            <span className={`text-xs font-medium px-3 py-1 rounded-lg border flex items-center ${trafficStyles[trafficLevel]}`}>
                              <TrafficCone size={12} className="mr-1.5" />
                              {trafficLevel} Traffic
                            </span>
                          );
                        })()}
                        
                        {/* Display relevance score if available */}
                        {act.relevanceScore !== undefined && (
                          <span className="inline-block bg-blue-100 rounded-lg px-2 py-1 text-xs font-medium text-blue-700 border border-blue-300">
                            Match: {(act.relevanceScore * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                      
                      {/* Activity Tags */}
                      <div className="flex gap-2 flex-wrap">
                        {act.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-block bg-white rounded-lg px-2 py-1 text-xs font-medium text-gray-500 border border-gray-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              section.reason && (
                <div className="bg-gradient-to-b from-blue-700 to-blue-500 rounded-3xl shadow-lg p-4 border border-gray-200">
                  <div className="flex items-center mb-2">
                    <span className="bg-white/20 text-white text-xs font-medium px-2 py-1 rounded-lg">Tarana-ai Suggestion</span>
                  </div>
                  <p className="text-sm italic text-white">{section.reason}</p>
                </div>
              )
            )}
          </div>
        ))}
        <Button
          className="w-full bg-gradient-to-b from-blue-700 to-blue-500 hover:to-blue-700 text-white font-semibold rounded-xl py-3 text-lg flex items-center justify-center gap-2 transition mt-4"
          onClick={onSave}
        >
          Save Itinerary
        </Button>
      </div>
    </aside>
  );
}