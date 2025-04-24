import Image from "next/image"
import Link from "next/link"

const HeroSection = () => {
  return (
    <section className="w-full pt-8 pb-16 px-4 bg-gray-50 rounded-b-3xl">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 max-w-4xl">
            Plan Your Perfect <span className="text-blue-500">Baguio Trip</span> in Seconds
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mb-8">
            We craft your perfect itinerary — personalized to your budget, interests, group size, and real-time traffic
            conditions — so you can focus on the adventure, not the stress.
          </p>
          <Link
            href="#"
            className="inline-flex items-center justify-center bg-blue-500 text-white px-8 py-3 rounded-full text-lg font-medium hover:bg-blue-600 transition-colors"
          >
            Plan My Baguio Trip
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
        </div>

        <div className="rounded-xl overflow-hidden shadow-2xl relative h-[500px]">
          <Image
            src="/placeholder-baguio.jpg"
            alt="Baguio City Panorama"
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 1200px"
            priority
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.src = "/placeholder.svg?height=500&width=1200"
            }}
          />
        </div>
      </div>
    </section>
  )
}

export default HeroSection
