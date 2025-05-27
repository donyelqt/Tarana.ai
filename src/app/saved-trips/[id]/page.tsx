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
      <main className="md:pl-64 flex-1 p-6 md:p-8 pt-16 md:pt-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-2xl p-6 md:p-8 mb-8 shadow">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">Saved Itineraries &gt; 1 Day Itinerary</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 flex items-center justify-center bg-blue-50 rounded-full">
                  <span className="text-blue-500 text-sm">📅</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 font-medium">Duration</span>
                  <span className="font-semibold text-gray-800">{formatDateRange(dates.start, dates.end)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 flex items-center justify-center bg-blue-50 rounded-full">
                  <span className="text-blue-500 text-sm">👥</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 font-medium">Number of Person</span>
                  <span className="font-semibold text-gray-800">{pax || "-"} Person</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 flex items-center justify-center bg-blue-50 rounded-full">
                  <span className="text-blue-500 text-sm">💰</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 font-medium">Budget</span>
                  <span className="font-semibold text-gray-800">{budget || itinerary.budget}</span>
                </div>
              </div>
            </div>
            {/* Travel Interests */}
            <div className="mb-2">
              <span className="text-xs text-gray-500 font-medium block mb-2">Travel Interests</span>
              <div className="flex flex-wrap gap-3">
                {(selectedInterests.length > 0 ? selectedInterests : itinerary.tags).map((interest) => (
                  <span key={interest} className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full text-sm font-medium text-gray-700">
                    <span>{interestIcons[interest] || ""}</span>
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Day-by-day breakdown */}
          {itineraryData.items.map((period, dayIdx) => (
            <div key={dayIdx} className="mb-10">
              <div className="mb-4">
                <Button variant="outline" className="rounded-full px-6 py-2 font-semibold text-gray-700 bg-white border border-gray-200 cursor-default">
                  Day {dayIdx + 1} <span className="ml-2 text-gray-400 font-normal">{formatDateRange(dates.start, dates.end).split("-")[dayIdx]?.trim() || ""}</span>
                </Button>
              </div>
              <div className="flex flex-col gap-6">
                {period.activities.map((activity, idx) => (
                  <div key={idx} className="flex flex-col md:flex-row bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="relative w-full md:w-60 h-40 md:h-auto flex-shrink-0">
                      <Image src={activity.image} alt={activity.title} fill className="object-cover" />
                    </div>
                    <div className="flex-1 p-6 flex flex-col gap-2">
                      <div className="flex flex-col md:flex-row md:items-center md:gap-4 mb-1">
                        <span className="text-blue-700 font-semibold text-sm md:text-base">{activity.time}</span>
                        <span className="font-bold text-lg text-gray-900">{activity.title}</span>
                      </div>
                      <div className="text-gray-700 text-sm mb-2">{activity.desc}</div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {activity.tags.map((tag, i) => (
                          <span key={i} className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full text-xs text-gray-600">
                            <span>{interestIcons[tag] || ""}</span>
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between mt-auto">
                        <div className="flex gap-2">
                          <Button variant="outline" className="text-xs text-gray-600 border-gray-200 rounded-full px-3 py-1 h-auto">Check In</Button>
                          <Button variant="outline" className="text-xs text-gray-600 border-gray-200 rounded-full px-3 py-1 h-auto">View on Map</Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                          <span className="text-xs text-gray-500">Ongoing</span>
                          <div className="w-2 h-2 rounded-full bg-gray-300 ml-2"></div>
                          <span className="text-xs text-gray-500">Not Started</span>
                        </div>
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