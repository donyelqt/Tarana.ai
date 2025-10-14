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
  placeName: string; // Add placeName property
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

  // Check if reviews are unavailable
  const reviewsUnavailable = !reviews || reviews.length === 0

  return (
    <>
      <style jsx>{`
        @keyframes starGlow {
          0%, 100% {
            filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.6)) drop-shadow(0 0 16px rgba(59, 130, 246, 0.4));
          }
          50% {
            filter: drop-shadow(0 0 12px rgba(59, 130, 246, 0.8)) drop-shadow(0 0 24px rgba(59, 130, 246, 0.6));
          }
        }
      `}</style>
      <div className="group relative mb-6 sm:mb-8 overflow-hidden rounded-2xl sm:rounded-3xl border border-gray-200/60 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-300 hover:shadow-[0_20px_60px_rgb(0,0,0,0.08)] p-4 sm:p-6">
      {/* Rating Overview - Only show when reviews are available */}
      {!reviewsUnavailable && (
        <div className="flex flex-col md:flex-row gap-4 sm:gap-6 mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-gray-200">
          <div className="flex flex-col items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-3 sm:p-4 rounded-2xl w-20 h-20 sm:w-24 sm:h-24 shadow-lg shadow-blue-500/30 mx-auto md:mx-0">
            <span className="text-xl sm:text-2xl font-bold">{overallRating.toFixed(1)}</span>
            <span className="text-xs">Very good</span>
            <span className="text-xs">{totalReviews} reviews</span>
          </div>
          
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {["Food", "Service", "Value", "Atmosphere"].map((category) => (
              <div key={category} className="flex flex-col items-center">
                <StarRating rating={4} />
                <span className="text-[10px] sm:text-xs text-gray-500 mt-1">{category}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Amenities - Only show when reviews are available */}
      {!reviewsUnavailable && (
        <div className="mb-6 sm:mb-8">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Amenities</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 sm:gap-y-4">
            {amenities.map((amenity, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-lg">{amenity.icon}</span>
                <span className="text-xs sm:text-sm">{amenity.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Reviews */}
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
          <h3 className="text-base sm:text-lg font-semibold">Reviews</h3>
          {!reviewsUnavailable && (
            <Button className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/40 active:scale-95 sm:hover:-translate-y-0.5 rounded-xl text-sm py-2.5 sm:py-2 touch-manipulation">
              Write a review
            </Button>
          )}
        </div>
        
        {reviewsUnavailable ? (
          /* Modern Empty State Placeholder */
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 border border-slate-200/60 px-4 sm:px-8 py-12 sm:py-16 text-center">
            {/* Decorative Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-400/5 rounded-full blur-3xl" />
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-400/5 rounded-full blur-3xl" />
            </div>
            
            {/* Content */}
            <div className="relative z-10 flex flex-col items-center justify-center space-y-6">
              {/* Icon Container with Glassmorphic Effect */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-indigo-500/30 rounded-full blur-xl animate-pulse" />
                <div className="relative flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm shadow-[0_8px_32px_rgba(59,130,246,0.25)] border border-white/60">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-10 w-10 sm:h-12 sm:w-12 text-blue-500"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    style={{
                      filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.6)) drop-shadow(0 0 16px rgba(59, 130, 246, 0.4))',
                      animation: 'starGlow 2s ease-in-out infinite'
                    }}
                  >
                    <path
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                </div>
              </div>
              
              {/* Text Content */}
              <div className="space-y-2 sm:space-y-3 max-w-md px-2">
                <h3 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
                  Reviews Unavailable
                </h3>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-medium">
                  We're working on gathering authentic reviews for this location
                </p>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Check back soon for verified visitor experiences and ratings
                </p>
              </div>
              
              {/* Status Badge */}
              <div className="inline-flex items-center gap-2 rounded-full bg-white/80 backdrop-blur-sm px-6 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.04)] border border-slate-200/60">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </div>
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Coming Soon
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {paginatedReviews.map((review) => (
              <div key={review.id} className="pb-4 sm:pb-6 border-b border-gray-200/60 last:border-0 transition-all duration-200 hover:bg-gray-50/50 rounded-xl px-1 sm:px-2">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 border-2 border-white shadow-sm">
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
                    
                    <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">{review.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Pagination */}
        {!reviewsUnavailable && totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-4 sm:mt-6">
            <Button
              variant="outline"
              className="rounded-xl transition-all duration-300 active:scale-95 sm:hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 touch-manipulation min-w-[40px] sm:min-w-[44px]"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Button>
            
            <span className="text-xs sm:text-sm px-2">
              {currentPage} of {totalPages}
            </span>
            
            <Button
              variant="outline"
              className="rounded-xl transition-all duration-300 active:scale-95 sm:hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 touch-manipulation min-w-[40px] sm:min-w-[44px]"
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
    </>
  )
}

export default Reviews