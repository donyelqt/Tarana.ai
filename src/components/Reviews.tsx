"use client"

import { useState } from "react"
import { Button } from "./ui/button"
import Image from "next/image"

interface ReviewProps {
  id: string
  author: string
  avatar: string
  rating: number
  date: string
  content: string
}

interface AmenityProps {
  icon: string
  name: string
}

interface ReviewsProps {
  placeName: string
  overallRating: number
  totalReviews: number
  amenities: AmenityProps[]
  reviews: ReviewProps[]
}

const StarRating = ({ rating }: { rating: number }) => {
  return (
    <div className="flex items-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={star <= rating ? "#FFD700" : "#E5E7EB"}
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
  )
}

const Reviews = ({
  placeName,
  overallRating,
  totalReviews,
  amenities,
  reviews,
}: ReviewsProps) => {
  const [currentPage, setCurrentPage] = useState(1)
  const reviewsPerPage = 5
  const totalPages = Math.ceil(reviews.length / reviewsPerPage)
  
  const paginatedReviews = reviews.slice(
    (currentPage - 1) * reviewsPerPage,
    currentPage * reviewsPerPage
  )

  return (
    <div className="bg-white rounded-2xl p-6 mb-8 shadow border border-gray-100">
      {/* Rating Overview */}
      <div className="flex flex-col md:flex-row gap-6 mb-8 pb-8 border-b border-gray-200">
        <div className="flex flex-col items-center justify-center bg-blue-500 text-white p-4 rounded-lg w-24 h-24">
          <span className="text-2xl font-bold">{overallRating.toFixed(1)}</span>
          <span className="text-xs">Very good</span>
          <span className="text-xs">{totalReviews} reviews</span>
        </div>
        
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
          {["Food", "Service", "Value", "Atmosphere"].map((category) => (
            <div key={category} className="flex flex-col items-center">
              <StarRating rating={4} />
              <span className="text-xs text-gray-500 mt-1">{category}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Amenities */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Amenities</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4">
          {amenities.map((amenity, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-lg">{amenity.icon}</span>
              <span className="text-sm">{amenity.name}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Reviews */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">Reviews</h3>
          <Button className="bg-blue-500 hover:bg-blue-600">
            Write a review
          </Button>
        </div>
        
        <div className="space-y-6">
          {paginatedReviews.map((review) => (
            <div key={review.id} className="pb-6 border-b border-gray-100 last:border-0">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                  <Image 
                    src={review.avatar} 
                    alt={review.author} 
                    width={40} 
                    height={40} 
                    className="object-cover"
                  />
                </div>
                
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-2">
                    <span className="font-semibold">{review.author}</span>
                    <div className="flex items-center gap-2">
                      <StarRating rating={review.rating} />
                      <span className="text-xs text-gray-500">{review.date}</span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-700">{review.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Button>
            
            <span className="text-sm">
              {currentPage} of {totalPages}
            </span>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Reviews