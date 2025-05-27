"use client"

import { useState } from "react"
import Image from "next/image"
import Sidebar from "../../components/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { burnham } from "../../../public"

// Sample saved itineraries data
const savedItineraries = [
  {
    id: "BC402",
    title: "1 Day Itinerary",
    date: "April 26 - 27, 2025 | 7:30AM - 8:00PM",
    budget: "₱3,000.00",
    image: burnham,
    tags: ["Food & Culinary", "Nature & Scenery"]
  }
]

const SavedTrips = () => {
  const [searchQuery, setSearchQuery] = useState("")
  const [filteredItineraries, setFilteredItineraries] = useState(savedItineraries)

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (query.trim() === "") {
      setFilteredItineraries(savedItineraries)
    } else {
      const filtered = savedItineraries.filter(itinerary =>
        itinerary.title.toLowerCase().includes(query.toLowerCase()) ||
        itinerary.id.toLowerCase().includes(query.toLowerCase())
      )
      setFilteredItineraries(filtered)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      <Sidebar />
      <main className="md:pl-64 flex-1 p-6 md:p-8 pt-16 md:pt-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">Saved Itineraries</h1>
          
          {/* Search Bar */}
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <Input
              type="text"
              placeholder="Search Itineraries..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Itineraries Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItineraries.map((itinerary) => (
            <div key={itinerary.id} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
              {/* Image */}
              <div className="relative h-48 w-full">
                <Image
                  src={itinerary.image}
                  alt={itinerary.title}
                  fill
                  className="object-cover"
                />
              </div>
              
              {/* Content */}
              <div className="p-6">
                {/* Title and ID */}
                <div className="mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{itinerary.title}</h3>
                  <p className="text-sm text-gray-500">#{itinerary.id}</p>
                </div>
                
                {/* Date and Time */}
                <div className="mb-3">
                  <div className="flex items-center text-sm text-gray-600">
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {itinerary.date}
                  </div>
                </div>
                
                {/* Budget */}
                <div className="mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                    Budget: {itinerary.budget}
                  </div>
                </div>
                
                {/* Tags */}
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2">
                    {itinerary.tags.map((tag, index) => (
                      <span key={index} className="inline-flex items-center">
                        <span className="mr-1">
                          {tag === "Food & Culinary" && "🍽️"}
                          {tag === "Nature & Scenery" && "🌿"}
                        </span>
                        <span className="text-xs text-gray-600">{tag}</span>
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* Action Button */}
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                  View Itinerary
                </Button>
              </div>
            </div>
          ))}
        </div>
        
        {/* Empty State */}
        {filteredItineraries.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No itineraries found</h3>
            <p className="text-gray-500 mb-4">Try adjusting your search or create a new itinerary.</p>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              Create New Itinerary
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}

export default SavedTrips