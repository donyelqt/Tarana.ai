"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Sidebar from "../../../components/Sidebar"
import { Button } from "@/components/ui/button"
import { getSavedItineraries, SavedItinerary, formatDateRange } from "@/lib/savedItineraries"
import Image from "next/image"

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

  useEffect(() => {
    const all = getSavedItineraries()
    const found = all.find((i) => i.id === id)
    setItinerary(found || null)
  }, [id])

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

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      <Sidebar />
      <main className="md:pl-64 flex-1 p-6 md:p-8 pt-8">
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
                    <div className="hidden md:flex flex-col justify-center items-center w-32 bg-[#f7f9fb] border-r border-gray-100">
                      <span className="text-blue-700 font-semibold text-base">{activity.time}</span>
                    </div>
                    {/* Image */}
                    <div className="relative w-full md:w-60 h-40 md:h-auto flex-shrink-0">
                      <Image src={activity.image} alt={activity.title} fill className="object-cover rounded-2xl md:rounded-none md:rounded-l-2xl" />
                    </div>
                    {/* Details */}
                    <div className="flex-1 p-6 flex flex-col gap-2">
                      {/* Time for mobile */}
                      <div className="flex md:hidden mb-1">
                        <span className="text-blue-700 font-semibold text-sm">{activity.time}</span>
                      </div>
                      <div className="flex flex-col md:flex-row md:items-center md:gap-4 mb-1">
                        <span className="font-bold text-lg text-gray-900 md:ml-0 ml-1">{activity.title}</span>
                      </div>
                      <div className="text-gray-700 text-sm mb-2">{activity.desc}</div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {activity.tags.map((tag, i) => (
                          <span key={i} className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full text-xs text-gray-600">
                            <span>{interestIcons[tag] || ""}</span>
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-end mt-auto gap-6">
                        <a href="#" className="flex items-center gap-1 text-yellow-500 text-sm font-medium hover:underline">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20" className="w-4 h-4"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.175c.969 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 00-.364 1.118l1.287 3.966c.3.922-.755 1.688-1.54 1.118l-3.38-2.454a1 1 0 00-1.175 0l-3.38 2.454c-.784.57-1.838-.196-1.54-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.05 9.394c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 00.95-.69l1.286-3.967z"/></svg>
                          Reviews
                        </a>
                        <a href="#" className="flex items-center gap-1 text-blue-600 text-sm font-medium hover:underline">
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
    </div>
  )
}

export default SavedItineraryDetail