/**
 * Loading Skeleton for Itinerary Detail Page
 * Provides visual feedback while data loads
 */
export function ItinerarySkeleton() {
  return (
    <div className="min-h-screen bg-[#f7f9fb] animate-pulse">
      <div className="md:pl-72 flex-1 px-4 sm:px-6 md:px-8 py-6 md:py-8">
        <div className="max-w-6xl mx-auto w-full">
          {/* Header Skeleton */}
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="bg-white w-full md:w-auto rounded-3xl px-5 sm:px-6 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-200/60">
              <div className="h-8 w-64 bg-gray-200 rounded"></div>
            </div>
            <div className="h-10 w-32 bg-gray-200 rounded-xl"></div>
          </div>

          {/* Info Cards Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-4 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-200/60"
              >
                <div className="h-5 w-20 bg-gray-200 rounded mb-2"></div>
                <div className="h-6 w-32 bg-gray-300 rounded"></div>
              </div>
            ))}
          </div>

          {/* Days Skeleton */}
          <div className="space-y-6">
            {[1, 2, 3].map((day) => (
              <div key={day} className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
                <div className="h-7 w-32 bg-gray-300 rounded mb-6"></div>
                
                {/* Activities Skeleton */}
                <div className="space-y-4">
                  {[1, 2].map((activity) => (
                    <div
                      key={activity}
                      className="flex gap-4 bg-white rounded-2xl border border-gray-200/60 overflow-hidden"
                    >
                      {/* Time Badge */}
                      <div className="hidden md:flex items-center justify-center w-20 bg-gray-100">
                        <div className="h-4 w-12 bg-gray-200 rounded"></div>
                      </div>
                      
                      {/* Image */}
                      <div className="w-32 h-32 bg-gray-200"></div>
                      
                      {/* Content */}
                      <div className="flex-1 p-4">
                        <div className="h-6 w-3/4 bg-gray-300 rounded mb-2"></div>
                        <div className="h-4 w-full bg-gray-200 rounded mb-3"></div>
                        <div className="flex gap-2 mb-3">
                          <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
                          <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
                        </div>
                        <div className="flex gap-2">
                          <div className="h-8 w-24 bg-gray-200 rounded-lg"></div>
                          <div className="h-8 w-20 bg-gray-200 rounded-lg"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
