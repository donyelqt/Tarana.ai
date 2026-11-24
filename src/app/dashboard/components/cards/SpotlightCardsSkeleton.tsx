interface SpotlightCardsSkeletonProps {
  label: string
  showTraffic?: boolean
}

const SpotlightCardsSkeleton = ({ label, showTraffic = false }: SpotlightCardsSkeletonProps) => (
  <div role="status">
    <span className="sr-only">{label}</span>
    <div
      aria-hidden="true"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse"
    >
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="bg-white border border-gray-200 rounded-2xl flex flex-col shadow-sm overflow-hidden"
        >
          <div className="h-40 w-full bg-gray-200" />
          <div className="p-3 flex flex-col flex-grow">
            <div className="h-7 w-3/4 rounded-md bg-gray-200 mb-2" />
            <div className="flex items-center gap-4 mb-3">
              <div className="h-5 w-24 rounded bg-gray-200" />
              <div className="h-5 w-16 rounded bg-gray-200" />
            </div>
            {showTraffic && <div className="h-[30px] w-28 rounded-lg bg-gray-100 mb-4" />}
            <div className="mt-auto h-11 w-full rounded-xl bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  </div>
)

export default SpotlightCardsSkeleton
