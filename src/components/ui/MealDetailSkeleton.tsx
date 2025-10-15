/**
 * Loading Skeleton for Meal Detail Page
 * Provides visual feedback while meal data loads
 */
export function MealDetailSkeleton() {
  return (
    <div className="min-h-screen bg-[#f7f9fb] animate-pulse">
      <div className="md:pl-72 flex-1">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-8">
          {/* Hero Image Skeleton */}
          <div className="relative h-64 sm:h-80 md:h-96 bg-gray-200 rounded-3xl mb-8"></div>

          {/* Header Skeleton */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div className="flex-1">
              <div className="h-10 w-3/4 bg-gray-300 rounded mb-3"></div>
              <div className="flex gap-4 flex-wrap">
                <div className="h-6 w-32 bg-gray-200 rounded-full"></div>
                <div className="h-6 w-28 bg-gray-200 rounded-full"></div>
                <div className="h-6 w-36 bg-gray-200 rounded-full"></div>
              </div>
            </div>
            <div className="h-12 w-32 bg-gray-200 rounded-xl"></div>
          </div>

          {/* Tabs Skeleton */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 w-28 bg-gray-200 rounded-xl flex-shrink-0"></div>
            ))}
          </div>

          {/* Menu Items Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-200/60 overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.04)]"
              >
                <div className="h-40 bg-gray-200"></div>
                <div className="p-4">
                  <div className="h-6 w-3/4 bg-gray-300 rounded mb-2"></div>
                  <div className="h-4 w-full bg-gray-200 rounded mb-3"></div>
                  <div className="flex justify-between items-center">
                    <div className="h-6 w-20 bg-gray-300 rounded"></div>
                    <div className="h-8 w-24 bg-gray-200 rounded-lg"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
