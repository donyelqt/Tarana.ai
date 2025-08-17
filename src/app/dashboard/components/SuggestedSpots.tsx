"use client"

import Image from "next/image"
import { Button } from "@/components/ui/button"
import { MapPin, Clock, TrafficCone } from "lucide-react"

const spots = [
  {
    name: "Burnham Park",
    image: "/images/burnham.png",
    distance: "0.9km",
    time: "6 min",
    traffic: "Low",
  },
  {
    name: "Burnham Park",
    image: "/images/burnham.png",
    distance: "0.9km",
    time: "6 min",
    traffic: "Moderate",
  },
  {
    name: "Burnham Park",
    image: "/images/burnham.png",
    distance: "0.9km",
    time: "6 min",
    traffic: "High",
  },
]

const trafficStyles: { [key: string]: string } = {
  Low: "border-green-300 bg-green-50 text-green-600",
  Moderate: "border-yellow-300 bg-yellow-50 text-yellow-600",
  High: "border-red-300 bg-red-50 text-red-600",
}

const SpotCard = ({ spot }: { spot: (typeof spots)[0] }) => (
  <div className="bg-white border border-gray-200/40 rounded-2xl flex flex-col shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
    <div className="relative w-full h-40">
      <Image src={spot.image} alt={spot.name} layout="fill" objectFit="cover" />
    </div>
    <div className="p-3 flex flex-col flex-grow">
      <h3 className="font-medium text-lg text-gray-800 mb-2">{spot.name}</h3>
      <div className="flex items-center text-gray-500 text-sm mb-3 space-x-4">
        <div className="flex items-center">
          <MapPin size={16} className="mr-1.5" />
          <span>{spot.distance}</span>
        </div>
        <div className="flex items-center">
          <Clock size={16} className="mr-1.5" />
          <span>{spot.time}</span>
        </div>
      </div>
      <div
        className={`text-sm font-medium px-3 py-1 rounded-lg self-start mb-4 border flex items-center ${trafficStyles[spot.traffic]}`}>
        <TrafficCone size={14} className="mr-2" />
        {spot.traffic} Traffic
      </div>
      <Button className="w-full mt-auto bg-gradient-to-b from-blue-700 to-blue-500 hover:to-blue-700 text-white font-medium">
        Visit Spot
      </Button>
    </div>
  </div>
)

const SuggestedSpots = () => {
  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-6 px-1">
        <h2 className="font-medium text-xl text-gray-900">Suggested Spots</h2>
        <p className="text-sm text-gray-500">Optimized for low traffic and crowd</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {spots.map((spot, index) => (
          <SpotCard key={index} spot={spot} />
        ))}
      </div>
    </div>
  )
}

export default SuggestedSpots
