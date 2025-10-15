"use client"

import { useState, useMemo } from "react"
import Image from "next/image"
import Sidebar from "../../components/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getSavedItineraries, SavedItinerary, deleteItinerary } from "@/lib/data"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Trash2 } from "lucide-react"
import { useQuery, useQueryClient } from '@tanstack/react-query'



const SavedTrips = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [itineraryToDelete, setItineraryToDelete] = useState<SavedItinerary | null>(null)
  const { toast } = useToast()

  // React Query - Cached itineraries list
  const { data: savedItineraries = [], isLoading } = useQuery({
    queryKey: ['itineraries'],
    queryFn: getSavedItineraries,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Filtered itineraries based on search (memoized for performance)
  const filteredItineraries = useMemo(() => {
    if (searchQuery.trim() === "") {
      return savedItineraries
    }
    return savedItineraries.filter(itinerary =>
      itinerary.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      itinerary.id.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [savedItineraries, searchQuery])

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const handleDeleteClick = (itinerary: SavedItinerary, e: React.MouseEvent) => {
    e.stopPropagation()
    setItineraryToDelete(itinerary)
    setShowDeleteModal(true)
  }

  const handleConfirmDelete = async () => {
    if (!itineraryToDelete) return
    try {
      await deleteItinerary(itineraryToDelete.id)
      
      // Invalidate cache to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['itineraries'] })
      queryClient.invalidateQueries({ queryKey: ['itinerary', itineraryToDelete.id] })
      
      toast({
        title: "Success",
        description: `Itinerary "${itineraryToDelete.title}" deleted successfully!`,
        variant: "success"
      })
    } catch (error) {
      console.error('Error deleting itinerary:', error)
      toast({
        title: "Error",
        description: "Failed to delete itinerary. Please try again.",
        variant: "destructive"
      })
    }
    setShowDeleteModal(false)
    setItineraryToDelete(null)
  }

  const handleCancelDelete = () => {
    setShowDeleteModal(false)
    setItineraryToDelete(null)
  }

  return (
    <div className="p-8 min-h-screen bg-[#f7f9fb]">
      <Sidebar />
      <main className="md:pl-64 flex-1">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl bg-white p-4 rounded-3xl md:text-3xl font-bold border border-gray-200/60 text-gray-900 mb-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-300 hover:shadow-[0_20px_60px_rgb(0,0,0,0.08)]">Saved Itineraries</h1>

          {/* Search Bar */}
          <div className="relative max-w-full bg-white rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-gray-200/60 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
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
              className="pl-10 pr-4 py-3 w-full border-0 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-transparent"
            />
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="overflow-hidden rounded-3xl border border-gray-200/60 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] animate-pulse">
                <div className="h-48 w-full bg-gray-200"></div>
                <div className="p-6">
                  <div className="h-6 w-3/4 bg-gray-200 rounded mb-3"></div>
                  <div className="h-4 w-1/2 bg-gray-100 rounded mb-4"></div>
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-gray-100 rounded"></div>
                    <div className="h-4 w-5/6 bg-gray-100 rounded"></div>
                  </div>
                  <div className="mt-4 h-10 bg-gray-200 rounded-xl"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Itineraries Grid */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItineraries.map((itinerary) => (
            <div key={itinerary.id} className="group relative overflow-hidden rounded-3xl border border-gray-200/60 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-300 hover:shadow-[0_20px_60px_rgb(0,0,0,0.08)] hover:-translate-y-1">
              {/* Image */}
              <div className="relative h-48 w-full">
                <Image
                  src={itinerary.image}
                  alt={itinerary.title}
                  fill
                  className="object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/images/placeholders/default-itinerary.jpg';
                  }}
                />
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Title and ID */}
                <div className="mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{itinerary.title} <span className="text-sm text-gray-400 font-normal">#{itinerary.id}</span></h3>
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
                      <span
                        key={index}
                        className="inline-flex items-center rounded-lg border-2 bg-white px-2 py-2"
                      >
                        <span className="mr-1">
                          {/*{tag === "Food & Culinary" && "🍽️"}
                          {tag === "Nature & Scenery" && "🌿"}*/}
                        </span>
                        <span className="text-xs text-gray-600">{tag}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium py-2 px-4 rounded-xl transition-all duration-300 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5"
                    onClick={() => router.push(`/saved-trips/${itinerary.id}`)}
                  >
                    View Itinerary
                  </Button>
                  {/*<Button 
                    className="bg-gray-200 hover:bg-gray-300 text-black font-medium py-2 px-4 rounded-xl transition-colors"
                    onClick={(e) => handleDeleteClick(itinerary, e)}
                  >
                    Delete
                  </Button>*/}
                  <Button
                    onClick={(e) =>  handleDeleteClick(itinerary, e)}
                    variant="outline"
                    className="py-3 h-auto rounded-xl border-gray-300 text-red-500 hover:text-red-600 hover:bg-red-50 font-semibold px-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <Trash2 size={18} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredItineraries.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No itineraries found</h3>
            <p className="text-gray-500 mb-4">Try adjusting your search or create a new itinerary.</p>
            <Button
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-300 hover:-translate-y-0.5"
              onClick={() => router.push('/itinerary-generator')}
            >
              Create New Itinerary
            </Button>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && itineraryToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-3xl shadow-[0_20px_60px_rgb(0,0,0,0.15)] border border-gray-200/60 p-8 max-w-sm w-full animate-in zoom-in-95 duration-300">
              <h2 className="text-lg font-bold mb-4 text-gray-900">Delete Itinerary</h2>
              <p className="mb-6 text-gray-700">Are you sure you want to delete itinerary <span className="font-semibold">#{itineraryToDelete.id}</span>? This action cannot be undone.</p>
              <div className="flex justify-end gap-2">
                <Button className="bg-gray-200 hover:bg-gray-300 text-black rounded-xl transition-all duration-300 hover:-translate-y-0.5" onClick={handleCancelDelete}>Cancel</Button>
                <Button className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl transition-all duration-300 hover:-translate-y-0.5 shadow-lg shadow-red-500/30" onClick={handleConfirmDelete}>Delete</Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default SavedTrips