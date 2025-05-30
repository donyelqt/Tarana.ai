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
}

const PlaceDetail = ({ place }: PlaceDetailProps) => {
  const [activeTab, setActiveTab] = useState<'description' | 'map' | 'reviews'>('description')

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 mb-8 shadow border border-gray-100">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Logo */}
          <div className="w-full md:w-1/3 flex justify-center">
            <div className="relative w-full max-w-[300px] h-[200px]">
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <h1 className="text-2xl font-bold">{place.name}</h1>
              
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
                <span className="text-sm text-gray-500">{place.totalReviews} reviews</span>
              </div>
            </div>
            
            <p className="text-sm text-gray-700 mb-6">{place.address}</p>
            
            {/* Gallery */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {place.images.slice(1, 4).map((image, index) => (
                <div key={index} className="relative h-24 rounded-lg overflow-hidden">
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
            <div className="flex flex-wrap gap-2">
              <Button className="bg-blue-500 hover:bg-blue-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </Button>
              <Button variant="outline">
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
      <div className="flex border-b border-gray-200 mb-6">
        <button
          className={`px-4 py-2 font-medium text-sm ${activeTab === 'description' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('description')}
        >
          Description
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm ${activeTab === 'map' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('map')}
        >
          View on Map
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm ${activeTab === 'reviews' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('reviews')}
        >
          Reviews
        </button>
      </div>
      
      {/* Tab Content */}
      {activeTab === 'description' && (
        <div className="bg-white rounded-2xl p-6 mb-8 shadow border border-gray-100">
          <h2 className="text-xl font-bold mb-4">Description</h2>
          <p className="text-gray-700">{place.description}</p>
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