"use client"

import { useState } from "react"
import Image from "next/image"
import MapView from "./MapView"
import Reviews from "./Reviews"
import { Button } from "./ui/button"

interface PlaceDetailProps {
  place: {
    id: string
    name: string
    rating: number
    totalReviews: number
    description: string
    address: string
    location: {
      lat: number
      lng: number
    }
    images: string[]
    amenities: Array<{
      icon: string
      name: string
    }>
    reviews: Array<{
      id: string
      author: string
      avatar: string
      rating: number
      date: string
      content: string
    }>
  }
  initialTab?: 'description' | 'map' | 'reviews'
}

const PlaceDetail = ({ place, initialTab = 'description' }: PlaceDetailProps) => {
  const [activeTab, setActiveTab] = useState<'description' | 'map' | 'reviews'>(initialTab)
  const hasReviews = place.reviews && place.reviews.length > 0

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 lg:px-6 xl:px-0">
      {/* Header */}
      <div className="group relative mb-4 sm:mb-6 lg:mb-8 overflow-hidden rounded-xl sm:rounded-2xl lg:rounded-3xl border border-gray-200/60 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-300 hover:shadow-[0_20px_60px_rgb(0,0,0,0.08)] p-3 sm:p-4 lg:p-6">
        <div className="flex flex-col md:flex-row gap-4 sm:gap-6">
          {/* Logo */}
          <div className="w-full md:w-1/3 flex justify-center items-center">
            <div className="relative w-full max-w-[240px] sm:max-w-[300px] h-[160px] sm:h-[200px]">
              <Image 
                src={place.images[0] || '/images/placeholder.png'} 
                alt={place.name}
                fill
                className="object-contain"
              />
            </div>
          </div>
          
          {/* Details */}
          <div className="flex-1">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold leading-tight">{place.name}</h1>
              
              {/* Show rating and reviews when available, otherwise show placeholder */}
              {hasReviews ? (
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg
                        key={star}
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill={star <= place.rating ? "#FFD700" : "#E5E7EB"}
                        className="w-5 h-5"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ))}
                  </div>
                  <span className="text-xs sm:text-sm text-gray-500">{place.totalReviews} reviews</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-slate-100 to-blue-50 px-4 py-2 shadow-sm border border-slate-200/60">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-blue-500"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  <span className="text-xs font-semibold text-slate-700">Reviews Coming Soon</span>
                </div>
              )}
            </div>
            
            <p className="text-xs sm:text-sm text-gray-700 mb-4 sm:mb-6 leading-relaxed">{place.address}</p>
            
            {/* Gallery */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
              {place.images.slice(1, 4).map((image, index) => (
                <div key={index} className="relative h-20 sm:h-24 lg:h-28 rounded-xl sm:rounded-2xl overflow-hidden border border-gray-200/40 shadow-sm transition-all duration-300 hover:shadow-md active:scale-95 sm:hover:scale-[1.02] touch-manipulation">
                  <Image 
                    src={image} 
                    alt={`${place.name} image ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/40 active:scale-95 sm:hover:-translate-y-0.5 rounded-xl py-2.5 sm:py-2 text-sm font-medium touch-manipulation">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </Button>
              <Button variant="outline" className="w-full sm:w-auto border-gray-300 hover:bg-gray-50 transition-all duration-300 hover:border-gray-400 active:scale-95 sm:hover:-translate-y-0.5 rounded-xl shadow-sm py-2.5 sm:py-2 text-sm font-medium touch-manipulation">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b border-gray-200/60 mb-4 sm:mb-6 bg-white/50 backdrop-blur-sm rounded-t-xl sm:rounded-t-2xl overflow-x-auto scrollbar-hide touch-pan-x -mx-2 px-2 sm:mx-0 sm:px-0">
        <button
          className={`flex-shrink-0 px-4 sm:px-6 py-3 font-semibold text-xs sm:text-sm transition-all duration-300 touch-manipulation active:scale-95 ${activeTab === 'description' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'}`}
          onClick={() => setActiveTab('description')}
        >
          Description
        </button>
        <button
          className={`flex-shrink-0 px-4 sm:px-6 py-3 font-semibold text-xs sm:text-sm transition-all duration-300 touch-manipulation active:scale-95 ${activeTab === 'map' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'}`}
          onClick={() => setActiveTab('map')}
        >
          View on Map
        </button>
        <button
          className={`flex-shrink-0 px-4 sm:px-6 py-3 font-semibold text-xs sm:text-sm transition-all duration-300 touch-manipulation active:scale-95 ${activeTab === 'reviews' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'}`}
          onClick={() => setActiveTab('reviews')}
        >
          Reviews
        </button>
      </div>
      
      {/* Tab Content */}
      {activeTab === 'description' && (
        <div className="group relative mb-4 sm:mb-6 lg:mb-8 overflow-hidden rounded-xl sm:rounded-2xl lg:rounded-3xl border border-gray-200/60 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-300 hover:shadow-[0_20px_60px_rgb(0,0,0,0.08)] p-3 sm:p-4 lg:p-6">
          <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Description</h2>
          <p className="text-sm sm:text-base text-gray-700 leading-relaxed">{place.description}</p>
        </div>
      )}
      
      {activeTab === 'map' && (
        <MapView 
          title={place.name} 
          address={place.address} 
          lat={place.location.lat} 
          lng={place.location.lng} 
        />
      )}
      
      {activeTab === 'reviews' && (
        <Reviews 
          placeName={place.name}
          overallRating={place.rating}
          totalReviews={place.totalReviews}
          amenities={place.amenities}
          reviews={place.reviews}
        />
      )}
    </div>
  )
}

export default PlaceDetail