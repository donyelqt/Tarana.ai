"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Sidebar from "../../../components/Sidebar"
import { Button } from "@/components/ui/button"
import { getSavedItineraries, SavedItinerary, formatDateRange } from "@/lib/savedItineraries"
import Image from "next/image"
import PlaceDetail from "@/components/PlaceDetail"

const interestIcons: Record<string, string> = {
  "Nature & Scenery": "🌿",
  "Food & Culinary": "🍽️",
  "Culture & Arts": "🎨",
  "Shopping & Local Finds": "🛍️",
  "Adventure": "⚡",
}

const SavedItineraryDetail = () => {
  const router = useRouter()
  const params = useParams()
  const { id } = params as { id: string }
  const [itinerary, setItinerary] = useState<SavedItinerary | null>(null)
  const [selectedActivity, setSelectedActivity] = useState<Record<string, unknown> | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)


  useEffect(() => {
    const all = getSavedItineraries()
    const found = all.find((i) => i.id === id)
    setItinerary(found || null)
  }, [id])

  const handleViewOnMap = (activity: any, e: React.MouseEvent) => {
    e.preventDefault()
    setSelectedActivity(activity)
    setShowDetailModal(true)
  }

  const handleViewReviews = (activity: any, e: React.MouseEvent) => {
    e.preventDefault()
    setSelectedActivity(activity)
    setShowDetailModal(true)
  }

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

  const { formData, itineraryData } = itinerary
  const { selectedInterests, pax, dates, budget } = formData

  // Transform activity data for PlaceDetail component
  const transformActivityToPlace = (activity: Record<string, unknown>) => {
    return {
      id: (activity.title as string).toLowerCase().replace(/\s+/g, '-'),
      name: activity.title as string,
      rating: 4.2, // Default rating
      totalReviews: 120, // Default review count
      description: activity.desc as string,
      address: `Baguio City, Philippines`,
      location: {
        lat: 16.4023, // Default to Baguio coordinates
        lng: 120.5960,
      },
      images: [(activity.image as {src: string}).src], // Use the activity image
      amenities: [
        { icon: "🍽️", name: "Restaurant" },
        { icon: "🚻", name: "Restrooms" },
        { icon: "♿", name: "Wheelchair Accessible" },
        { icon: "🅿️", name: "Parking" },
        { icon: "🚭", name: "Non-smoking sections" },
        { icon: "🌡️", name: "Air-conditioned" },
      ],
      reviews: [
        {
          id: "1",
          author: "J.J. Mendoza",
          avatar: "/images/avatar-1.png",
          rating: 5,
          date: "2 months ago",
          content: "I couldn't believe how delicious the food was! The service was impeccable and the ambiance was perfect for our family dinner. Will definitely come back again.",
        },
        {
          id: "2",
          author: "Maria Santos",
          avatar: "/images/avatar-2.png",
          rating: 4,
          date: "3 months ago",
          content: "Great place for authentic Filipino cuisine. The portions are generous and prices are reasonable. The only downside was the waiting time during peak hours.",
        },
        {
          id: "3",
          author: "David Chen",
          avatar: "/images/avatar-3.png",
          rating: 4,
          date: "4 months ago",
          content: "Visited during our trip to Baguio and was not disappointed. The food was fresh and flavorful. Would recommend trying their specialty dishes.",
        },
        {
          id: "4",
          author: "Sarah Johnson",
          avatar: "/images/avatar-4.png",
          rating: 5,
          date: "5 months ago",
          content: "One of the best dining experiences in Baguio! The staff was friendly and attentive. The food came quickly and exceeded our expectations.",
        },
        {
          id: "5",
          author: "Michael Lee",
          avatar: "/images/avatar-5.png",
          rating: 3,
          date: "6 months ago",
          content: "The food was good but the place was quite crowded. Had to wait for about 30 minutes to get a table. The prices are reasonable though.",
        },
      ],
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      <Sidebar />
      <main className="md:pl-72 flex-1 p-8 md:p-8 pt-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="bg-[#f5f7fa] max-w-full rounded-xl px-6 py-3 inline-block font-bold text-xl md:text-2xl text-gray-900 shadow-none border border-gray-200">
              {`Saved Itineraries > ${itinerary.title}`}
            </div>
          </div>
          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow border border-gray-100">
              <div className="w-10 h-10 flex items-center justify-center bg-blue-50 rounded-full">
                <span className="text-blue-500 text-lg">📅</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 font-medium">Duration</span>
                <span className="font-semibold text-gray-800 text-base">{formatDateRange(dates.start, dates.end)}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow border border-gray-100">
              <div className="w-10 h-10 flex items-center justify-center bg-blue-50 rounded-full">
                <span className="text-blue-500 text-lg">👥</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 font-medium">Number of Person</span>
                <span className="font-semibold text-gray-800 text-base">{pax || "-"} Person</span>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow border border-gray-100">
              <div className="w-10 h-10 flex items-center justify-center bg-blue-50 rounded-full">
                <span className="text-blue-500 text-lg">💰</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 font-medium">Budget</span>
                <span className="font-semibold text-gray-800 text-base">{budget || itinerary.budget}</span>
              </div>
            </div>
          </div>
          {/* Travel Interests */}
          <div className="bg-white rounded-2xl p-6 mb-8 shadow border border-gray-100">
            <span className="text-xs text-gray-500 font-medium block mb-3">Travel Interests</span>
            <div className="flex flex-wrap gap-3">
              {(selectedInterests.length > 0 ? selectedInterests : itinerary.tags).map((interest) => (
                <button
                  key={interest}
                  className="flex items-center gap-2 bg-[#f5f7fa] px-5 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-200 shadow-none cursor-default"
                  type="button"
                  tabIndex={-1}
                >
                  <span>{interestIcons[interest] || ""}</span>
                  {interest}
                </button>
              ))}
            </div>
          </div>
          {/* Day-by-day breakdown */}
          {itineraryData.items.map((period, dayIdx) => (
            <div key={dayIdx} className="mb-10">
              <div className="mb-4 flex items-center gap-3">
                <div className="bg-white rounded-full px-6 py-2 font-semibold text-gray-900 text-base border border-gray-200 shadow-none">
                  Day {dayIdx + 1}
                </div>
                <span className="text-gray-500 text-base font-medium">{formatDateRange(dates.start, dates.end).split("-")[dayIdx]?.trim() || ""}</span>
              </div>
              <div className="flex flex-col gap-6">
                {period.activities.map((activity, idx) => (
                  <div key={idx} className="flex flex-col md:flex-row bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                    {/* Time column for desktop */}
                    <div className="hidden md:flex flex-col justify-center items-center w-32 bg-blue-50 border-r border-gray-100">
                      <span className="text-blue-700 font-semibold text-base">{activity.time}</span>
                    </div>
                    {/* Image */}
                    <div className="relative w-full md:w-60 h-40 md:h-auto md:mt-8 md:mb-8 md:ml-8 flex-shrink-0">
                      <Image src={activity.image as any} alt={(activity.title as string)} fill className="object-center rounded-2xl md:rounded-l-2xl" />
                    </div>
                    {/* Details */}
                    <div className="flex-1 p-6 flex flex-col gap-2">
                      {/* Time for mobile */}
                      <div className="flex md:hidden mb-1">
                        <span className="text-blue-700 font-semibold text-sm">{activity.time as string}</span>
                      </div>
                      <div className="flex flex-col md:flex-row md:items-center md:gap-4 mb-1">
                        <span className="font-bold text-lg text-gray-900 md:ml-0 ml-1">{activity.title as string}</span>
                      </div>
                      <div className="text-gray-700 text-sm mb-2">{activity.desc as string}</div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {((activity.tags as string[]) || []).map((tag, i) => (
                          <span key={i} className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full text-xs text-gray-600">
                            <span>{interestIcons[tag] || ""}</span>
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-end mt-auto gap-6">
                        <a 
                          href="#" 
                          className="flex items-center gap-1 text-yellow-500 text-sm font-medium hover:underline"
                          onClick={(e) => handleViewReviews(activity, e)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20" className="w-4 h-4"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.175c.969 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 00-.364 1.118l1.287 3.966c.3.922-.755 1.688-1.54 1.118l-3.38-2.454a1 1 0 00-1.175 0l-3.38 2.454c-.784.57-1.838-.196-1.54-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.05 9.394c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 00.95-.69l1.286-3.967z"/></svg>
                          Reviews
                        </a>
                        <a 
                          href="#" 
                          className="flex items-center gap-1 text-blue-600 text-sm font-medium hover:underline"
                          onClick={(e) => handleViewOnMap(activity, e)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          View on Map
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Restaurant Detail Modal */}
      {showDetailModal && selectedActivity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white p-4 border-b border-gray-200 flex justify-between items-center z-10">
              <h2 className="text-xl font-bold">{selectedActivity.title as string}</h2>
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