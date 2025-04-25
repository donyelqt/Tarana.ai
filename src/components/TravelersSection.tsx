"use client"

import { useState } from "react"
import Image from "next/image"

interface TravelerType {
  title: string
  description: string
  image: string
}

const TravelersSection = () => {
  const [travelers] = useState<TravelerType[]>([
    {
      title: "Solo Traveler",
      description:
        "Go at your own pace and discover hidden gems, peaceful trails, and cozy cafés — all tailored to your vibe.",
      image: "/placeholder-solo.jpg",
    },
    {
      title: "Families",
      description:
        "Kid-friendly activities, safety-first recommendations, and flexible schedules perfect for family bonding.",
      image: "/placeholder-family.jpg",
    },
    {
      title: "Couples",
      description:
        "From scenic walks to hidden date spots, Tarana.ai helps you focus on each other while we take care of the route.",
      image: "/placeholder-couple.jpg",
    },
    {
      title: "Barkadas",
      description:
        "Whether it's food trips or thrill spots, Tarana.ai keeps your crew in sync. Real-time updates, shared plans, zero chaos.",
      image: "/placeholder-friends.jpg",
    },
  ])

  return (
    <section className="py-16 px-4 bg-gradient-to-b from-white">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-blue-500">Perfect for All Travelers</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {travelers.map((traveler, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow-lg overflow-hidden transition-transform hover:scale-105"
            >
              <div className="h-48 relative overflow-hidden">
                <Image
                  src={traveler.image || "/placeholder.svg?height=200&width=400"}
                  alt={traveler.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = "/placeholder.svg?height=200&width=400"
                  }}
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2">{traveler.title}</h3>
                <p className="text-gray-600">{traveler.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default TravelersSection
