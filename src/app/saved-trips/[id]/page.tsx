"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Sidebar from "../../../components/Sidebar"
import { Button } from "@/components/ui/button"
import { Calendar, Users, Wallet, Mountain, Utensils, Palette, ShoppingBag, Compass, TrafficCone } from "lucide-react"
import {
  getSavedItineraries,
  SavedItinerary,
  formatDateRange,
  updateItinerary,
  ItineraryPeriod,
  ItineraryActivity,
} from "@/lib/data";
import { WeatherData } from "@/lib/core";
import Image from "next/image"
import PlaceDetail from "@/components/PlaceDetail"
import { useToast } from "@/components/ui/use-toast"
import { useModernToast } from "@/hooks/useModernToast"
import { getFallbackImage, isValidImagePath } from "@/lib/images/imageUtils"

// import usePuter from "../../../hooks/usePuter";
// import { puterConfig } from "../../../config/puter";

const interestIcons: Record<string, React.ReactElement> = {
  "Nature & Scenery": <Mountain className="w-4 h-4" />,
  "Food & Culinary": <Utensils className="w-4 h-4" />,
  "Culture & Arts": <Palette className="w-4 h-4" />,
  "Shopping & Local Finds": <ShoppingBag className="w-4 h-4" />,
  "Adventure": <Compass className="w-4 h-4" />,
}

const SavedItineraryDetail = () => {
  const router = useRouter()
  const params = useParams()
  const { id } = params as { id: string }
  const [itinerary, setItinerary] = useState<SavedItinerary | null>(null);
  // Removed unused weatherData state
  const [selectedActivity, setSelectedActivity] = useState<ItineraryActivity | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showChangeSummary, setShowChangeSummary] = useState(false)
  const [changeSummary, setChangeSummary] = useState<string>('')
  const [refreshEvaluation, setRefreshEvaluation] = useState<any>(null)
  const { toast } = useToast()
  const modernToast = useModernToast()
  // Load the Puter SDK once
  // const puter = usePuter(); // removed – using backend Gemini API instead

  useEffect(() => {
    const fetchItinerary = async () => {
      const all = await getSavedItineraries();
      // Ensure 'all' is an array before calling find
      const found = Array.isArray(all) ? all.find((i: SavedItinerary) => i.id === id) : null;
      setItinerary(found || null);
    };
    if (id) {
      fetchItinerary();
    }
  }, [id]);

  const handleViewOnMap = (activity: ItineraryActivity, e: React.MouseEvent) => {
    e.preventDefault()
    setSelectedActivity(activity)
    setShowDetailModal(true)
  }

  const handleViewReviews = (activity: ItineraryActivity, e: React.MouseEvent) => {
    e.preventDefault()
    setSelectedActivity(activity)
    setShowDetailModal(true)
  }

  const getActivityImageSrc = (activity: ItineraryActivity): string => {
    const tags = Array.isArray(activity.tags) ? activity.tags : []
    const fallback = getFallbackImage(tags)

    const rawImage = activity.image
    let candidate: string | undefined

    if (typeof rawImage === "string" && rawImage.trim() !== "") {
      candidate = rawImage.trim()
    } else if (rawImage && typeof rawImage === "object" && "src" in rawImage) {
      const src = (rawImage as { src: string }).src
      if (typeof src === "string") {
        candidate = src.trim()
      }
    }

    if (!candidate) {
      return fallback
    }

    const normalized =
      candidate.startsWith("http://") ||
      candidate.startsWith("https://") ||
      candidate.startsWith("/")
        ? candidate
        : `/${candidate.replace(/^\/+/, "")}`

    return isValidImagePath(normalized) ? normalized : fallback
  }

  // Helper function to refetch fresh itinerary data from database
  const refetchItinerary = async () => {
    try {
      const all = await getSavedItineraries();
      const found = Array.isArray(all) ? all.find((i: SavedItinerary) => i.id === id) : null;
      if (found) {
        setItinerary(found);
        console.log('✅ UI State refreshed with latest database data');
      }
    } catch (error) {
      console.error('❌ Error refetching itinerary:', error);
    }
  };

  const handleRefreshItinerary = async (force: boolean = false) => {
    if (!itinerary) return;
    setIsRefreshing(true);
    
    try {
      // Step 1: Evaluate if refresh is needed (unless forced)
      if (!force) {
        const evalResponse = await fetch(`/api/saved-itineraries/${id}/refresh`, {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });

        if (!evalResponse.ok) {
          const errorData = await evalResponse.json().catch(() => ({ error: 'Evaluation failed' }));
          console.error('❌ Evaluation failed:', errorData);
          modernToast.error("Evaluation Failed", errorData.error || "Please try again");
          setIsRefreshing(false);
          return;
        }

        const evalResult = await evalResponse.json();
        
        // If changes detected, automatically trigger regeneration
        if (evalResult.evaluation && evalResult.evaluation.needsRefresh) {
          console.log('🔄 Changes detected, automatically regenerating itinerary...');
          modernToast.processing(
            "Analyzing Changes",
            "Updating with live data..."
          );
          
          // Automatically proceed to POST (regeneration)
          force = true;
        } else {
          // No changes needed
          modernToast.optimized(
            "Already Optimized",
            "No changes needed"
          );
          setIsRefreshing(false);
          return;
        }
      }
      
      // Step 2: Regenerate itinerary (if forced or changes detected)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s client timeout
      
      const response = await fetch(`/api/saved-itineraries/${id}/refresh`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({ force: true }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const result = await response.json();
      
      if (result.success) {
        // ✅ CRITICAL: Always refetch from database to ensure UI reflects latest state
        console.log('🔄 Refetching updated itinerary from database...');
        await refetchItinerary();
        
        // Show change summary if available
        if (result.changeSummary) {
          setChangeSummary(result.changeSummary);
          setShowChangeSummary(true);
        }
        
        // Modern success notification
        modernToast.success(
          "Refresh Complete",
          "Optimized with live data"
        );
        
        console.log('✅ Refresh completed successfully - UI updated with latest data');
      } else {
        // Handle API error response
        const errorMessage = result.error || result.message || "Update failed";
        console.error('❌ Refresh failed:', result);
        modernToast.error(
          "Update Failed",
          errorMessage.substring(0, 50) // Limit error message length
        );
      }
    } catch (error) {
      console.error('❌ Error refreshing itinerary:', error);
      
      if (error instanceof Error && error.name === 'AbortError') {
        modernToast.error(
          "Request Timeout",
          "Taking too long - try again"
        );
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        modernToast.connectionError(
          "Connection Error",
          "Check your internet"
        );
      } else {
        modernToast.error(
          "Update Failed",
          "Please try again"
        );
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Helper function to parse duration string (e.g., "1 Day", "2 Days") and calculate end date
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _calculateAndFormatDateRange = (startDateString: string, durationString: string): string => {
    if (!startDateString || !durationString) return 'Date not specified';
  
    const startDate = new Date(startDateString);
    if (isNaN(startDate.getTime())) return 'Invalid start date';
  
    let durationDays = 0;
    const durationMatch = durationString.match(/^(\d+)\s*Day/i);
    if (durationMatch && durationMatch[1]) {
      durationDays = parseInt(durationMatch[1], 10);
    } else if (durationString.toLowerCase().includes('day')) { // Fallback for less specific formats like "4-5 Days"
      // For ranges like "4-5 Days", we'll take the smaller number for simplicity or decide on a convention.
      // Here, let's assume it implies the trip *spans* that many days, so a "1 Day" trip starting June 13 ends June 13 for display purposes of the *day itself*,
      // but the user wants to see June 13 - June 14 for a 1-day trip. So, we add durationDays - 1 to get the end date of the period.
      // If it's "1 Day", we add 0 to get the end date as the same day for the *period*, but the display range should be start to start + 1.
      // Let's adjust to match the user's example: "June 13 - June 14, 2025" for a 1-day trip.
      // This means if duration is X days, the end date of the range is start_date + (X) days.
      // So for "1 Day", end date is start_date + 1 day.
      // For "2 Days", end date is start_date + 2 days.
      // The original request was: "if the user input 1 day and the date today is june 13, 2025 it should be the reflecting in the saved itineraries is june 13 - june 14, 2025"
      // This means the *end* of the range is `startDate` + `durationDays`.
      // However, a typical interpretation of a "1-day trip" on June 13 means it *ends* on June 13.
      // The example "June 13 - June 14" for a 1-day trip implies the *range displayed* includes the start of the next day.
      // Let's stick to the user's explicit example: end date for display = startDate + (parsedDurationDays).
      // If duration is "1 Day", parsedDurationDays = 1. endDate = startDate + 1 day.
      const firstNumMatch = durationString.match(/^(\d+)/);
      if (firstNumMatch && firstNumMatch[1]) {
        durationDays = parseInt(firstNumMatch[1], 10);
      }
    }
  
    if (durationDays <= 0) {
      // If duration is 0 or invalid, just show the start date
      return startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
  
    // According to the user's example: for a 1-day trip starting June 13, display "June 13 - June 14"
    // This means the end date of the *displayed range* is startDate + durationDays.
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + durationDays);
  
    const options: Intl.DateTimeFormatOptions = { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    };
  
    // If the calculated end date is the same as the start date (e.g. if duration was 0, though we handle above)
    // or if duration is 1 day, and we want to show Start - Start+1
    // The user wants "June 13 - June 14" for a 1-day trip. So, start and end will be different.
    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
  };

  if (!itinerary) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f9fb]">
        <Sidebar />
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Itinerary Not Found</h2>
          <p className="mb-4 text-gray-500">We couldn&apos;t find this itinerary. It may have been deleted.</p>
          <Button onClick={() => router.push("/saved-trips")}>Back to Saved Trips</Button>
        </div>
      </div>
    )
  }

  // Guard: If formData is missing, show an error message
  if (!itinerary.formData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f9fb]">
        <Sidebar />
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Itinerary Data Error</h2>
          <p className="mb-4 text-gray-500">This itinerary is missing form data and cannot be displayed.</p>
          <Button onClick={() => router.push("/saved-trips")}>Back to Saved Trips</Button>
        </div>
      </div>
    )
  }

  const { formData, itineraryData } = itinerary
  const { selectedInterests, pax, dates, budget } = formData

  // Transform activity data for PlaceDetail component
  const transformActivityToPlace = (activity: ItineraryActivity) => {
    // Default Baguio coordinates
    const lat = activity.lat ?? 16.4023
    const lon = activity.lon ?? 120.596

    return {
      id: activity.title.toLowerCase().replace(/\s+/g, '-'),
      name: activity.title,
      rating: 4.2, // Default rating
      totalReviews: 120, // Default review count
      description: activity.desc,
      address: `Baguio City, Philippines`,
      location: {
        lat,
        lng: lon,
      },
      images: [getActivityImageSrc(activity)],
      amenities: [
        { icon: "🍽️", name: "Restaurant" },
        { icon: "🚻", name: "Restrooms" },
        { icon: "♿", name: "Wheelchair Accessible" },
        { icon: "🅿️", name: "Parking" },
        { icon: "🚭", name: "Non-smoking sections" },
        { icon: "🌡️", name: "Air-conditioned" },
      ],
      reviews: [], // Empty array - reviews unavailable for saved itineraries
    }
  }

  // Group itinerary periods into days. A new day starts with "Morning".
  const days: ItineraryPeriod[][] = []
  if (itineraryData && itineraryData.items) {
    let currentDay: ItineraryPeriod[] = []
    for (const period of itineraryData.items) {
      if (
        period.period?.toLowerCase().includes("morning") &&
        currentDay.length > 0
      ) {
        days.push(currentDay)
        currentDay = []
      }
      currentDay.push(period)
    }
    if (currentDay.length > 0) {
      days.push(currentDay)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      <Sidebar />
      <main className="md:pl-72 flex-1 px-4 sm:px-6 md:px-8 py-6 md:py-8">
        <div className="max-w-6xl mx-auto w-full">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="bg-white w-full md:w-auto rounded-3xl px-5 sm:px-6 py-3 inline-flex flex-col sm:flex-row sm:items-center gap-1 font-bold text-lg sm:text-xl md:text-2xl text-gray-900 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-200/60 transition-all duration-300 hover:shadow-[0_20px_60px_rgb(0,0,0,0.08)]">
              {`Saved Itineraries > ${itinerary.title}`}
            </div>
            <Button 
              onClick={() => handleRefreshItinerary(false)} 
              disabled={isRefreshing}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 w-full sm:w-auto justify-center shadow-lg shadow-blue-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5"
            >
              {isRefreshing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Refreshing...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Smart Refresh
                </>
              )}
            </Button>
          </div>
          {/* Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="flex items-center gap-3 bg-white rounded-3xl p-4 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-200/60 min-h-[92px] transition-all duration-300 hover:shadow-[0_20px_60px_rgb(0,0,0,0.08)] hover:-translate-y-0.5">
              <div className="w-10 h-10 flex items-center justify-center bg-blue-50 rounded-full">
                <Calendar className="text-blue-500 w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 font-medium">Duration</span>
                <span className="font-semibold text-gray-800 text-base">{formatDateRange(dates.start, dates.end)}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white rounded-3xl p-4 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-200/60 min-h-[92px] transition-all duration-300 hover:shadow-[0_20px_60px_rgb(0,0,0,0.08)] hover:-translate-y-0.5">
              <div className="w-10 h-10 flex items-center justify-center bg-blue-50 rounded-full">
                <Users className="text-blue-500 w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 font-medium">Number of Person</span>
                <span className="font-semibold text-gray-800 text-base">{pax || "-"} Person</span>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white rounded-3xl p-4 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-200/60 transition-all duration-300 hover:shadow-[0_20px_60px_rgb(0,0,0,0.08)] hover:-translate-y-0.5">
              <div className="w-10 h-10 flex items-center justify-center bg-blue-50 rounded-full">
                <Wallet className="text-blue-500 w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 font-medium">Budget</span>
                <span className="font-semibold text-gray-800 text-base">{budget || itinerary.budget}</span>
              </div>
            </div>
          </div>
          {/* Travel Interests */}
          <div className="bg-white rounded-3xl p-6 mb-8 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-200/60 transition-all duration-300 hover:shadow-[0_20px_60px_rgb(0,0,0,0.08)]">
            <span className="text-xs text-gray-500 font-medium block mb-3">Travel Interests</span>
            <div className="flex flex-wrap gap-3">
              {(selectedInterests.length > 0 ? selectedInterests : itinerary.tags).map((interest) => (
                <button
                  key={interest}
                  className="flex items-center gap-2 bg-[#f5f7fa] px-5 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-200 shadow-none cursor-default"
                  type="button"
                  tabIndex={-1}
                >
                  <span className="text-blue-500">{interestIcons[interest] || null}</span>
                  {interest}
                </button>
              ))}
            </div>
          </div>
          {/* Day-by-day breakdown */}
          {days.map((day, dayIdx) => {
            const dayDate = new Date(dates.start)
            dayDate.setDate(dayDate.getDate() + dayIdx)
            const formattedDate = dayDate.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })

            return (
              <div key={dayIdx} className="mb-10">
                <div className="mb-4 flex items-center gap-3">
                  <div className="bg-white rounded-2xl px-6 py-3 font-semibold text-gray-900 text-base border border-gray-200/60 shadow-[0_4px_20px_rgb(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
                    Day {dayIdx + 1}&nbsp;
                    <span className="text-gray-500 text-base font-medium">
                      {" "}
                      {formattedDate}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-6">
                  {day
                    .flatMap(period => period.activities)
                    .map((activity, idx) => {
                      const imageSrcToUse = getActivityImageSrc(activity)
                      return (
                        <div
                          key={idx}
                          className="flex flex-col md:flex-row bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden border border-gray-200/60 transition-all duration-300 hover:shadow-[0_20px_60px_rgb(0,0,0,0.08)] hover:-translate-y-0.5"
                        >
                          {/* Time column for desktop */}
                          <div className="hidden md:flex flex-col justify-center items-center w-40 bg-blue-50 border-r border-gray-100">
                            <span className="text-blue-700 text-lg p-8 items-center justify-center font-semibold">
                              {activity.time}
                            </span>
                          </div>
                          {/* Image */}
                          <div className="relative w-full md:w-60 h-48 sm:h-56 md:h-auto md:mt-8 md:mb-8 md:ml-8 flex-shrink-0">
                            {imageSrcToUse ? (
                              <Image
                                src={imageSrcToUse}
                                alt={activity.title || "Activity image"}
                                fill
                                className="object-center rounded-2xl md:rounded-l-2xl"
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded-2xl md:rounded-l-2xl">
                                <span className="text-gray-500 text-sm">
                                  No image available
                                </span>
                              </div>
                            )}
                          </div>
                          {/* Details */}
                          <div className="flex-1 p-6 flex flex-col gap-2">
                            {/* Time for mobile */}
                            <div className="flex md:hidden mb-1">
                              <span className="text-blue-700 font-semibold text-sm">
                                {activity.time}
                              </span>
                            </div>
                            <div className="flex flex-col md:flex-row md:items-center md:gap-4 mb-1">
                              <span className="font-bold text-lg text-gray-900 md:ml-0 ml-1">
                                {activity.title}
                              </span>
                            </div>
                            <p className="text-gray-600 text-sm leading-relaxed">{activity.desc}</p>
                            
                            {/* Tags - Non-traffic tags only */}
                            <div className="flex flex-wrap gap-2">
                              {activity.tags.slice(0, 4).filter((tag) => {
                                // Filter out traffic tags from main display
                                return tag !== 'low-traffic' && tag !== 'moderate-traffic';
                              }).map(
                                (tag, i) => {
                                  return (
                                    <span
                                      key={i}
                                      className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
                                    >
                                      <span className="text-blue-500">{interestIcons[tag] || null}</span>
                                      {tag}
                                    </span>
                                  );
                                }
                              )}
                            </div>
                            
                            {/* Bottom row: Traffic tags on left, action buttons on right */}
                            <div className="flex items-center justify-between mt-auto gap-3 flex-wrap">
                              {/* Traffic Tags - Left Side */}
                              <div className="flex items-center gap-2">
                                {activity.tags.map((tag, i) => {
                                  const isLowTraffic = tag === 'low-traffic';
                                  const isModerateTraffic = tag === 'moderate-traffic';
                                  const isTrafficTag = isLowTraffic || isModerateTraffic;
                                  
                                  if (!isTrafficTag) return null;
                                  
                                  // Format traffic text (e.g., "low-traffic" -> "Low Traffic")
                                  const trafficText = tag
                                    .split('-')
                                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                    .join(' ');
                                  
                                  return (
                                    <span
                                      key={i}
                                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-300 hover:scale-105 ${
                                        isLowTraffic
                                          ? 'bg-green-100 text-green-700 border-green-300'
                                          : 'bg-yellow-100 text-yellow-700 border-yellow-300'
                                      }`}
                                      style={{
                                        animation: isLowTraffic 
                                          ? 'glow-green 2s ease-in-out infinite' 
                                          : 'glow-yellow 2s ease-in-out infinite'
                                      }}
                                    >
                                      <TrafficCone size={12} />
                                      {trafficText}
                                    </span>
                                  );
                                })}
                              </div>
                              
                              {/* Action Buttons - Right Side */}
                              <div className="flex items-center gap-3">
                                <a
                                  href="#"
                                  className="relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-300 overflow-hidden group border border-yellow-400 bg-gradient-to-r from-yellow-50 to-amber-50 hover:from-yellow-100 hover:to-amber-100 text-yellow-700 hover:text-yellow-800 hover:border-yellow-500 shadow-sm hover:shadow-md hover:shadow-yellow-400/30 active:scale-95 sm:hover:-translate-y-0.5 touch-manipulation"
                                  onClick={(e) => handleViewReviews(activity, e)}
                                >
                                  <span className="absolute inset-0 bg-gradient-to-r from-yellow-300 to-amber-300 opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-xl"></span>
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                    className="w-3.5 h-3.5 relative z-10"
                                  >
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.175c.969 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 00-.364 1.118l1.287 3.966c.3.922-.755 1.688-1.54 1.118l-3.38-2.454a1 1 0 00-1.175 0l-3.38 2.454c-.784.57-1.838-.196-1.54-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.05 9.394c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 00.95-.69l1.286-3.967z" />
                                  </svg>
                                  <span className="relative z-10">Reviews</span>
                                </a>
                                <a
                                  href="#"
                                  className="relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-300 overflow-hidden group bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/50 active:scale-95 sm:hover:-translate-y-0.5 touch-manipulation"
                                  onClick={(e) => handleViewOnMap(activity, e)}
                                >
                                  <span className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-500 opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-xl"></span>
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    className="w-3.5 h-3.5 relative z-10"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"
                                    />
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                  </svg>
                                  <span className="relative z-10">View on Map</span>
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
        </div>
      </main>

      {/* Restaurant Detail Modal */}
      {showDetailModal && selectedActivity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-[0_20px_60px_rgb(0,0,0,0.15)] border border-gray-200/60 animate-in zoom-in-95 duration-300">
            <div className="sticky top-0 bg-white p-4 border-b border-gray-200 flex justify-between items-center z-10">
              <h2 className="text-xl font-bold">{selectedActivity.title}</h2>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <PlaceDetail 
                place={transformActivityToPlace(selectedActivity)} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SavedItineraryDetail