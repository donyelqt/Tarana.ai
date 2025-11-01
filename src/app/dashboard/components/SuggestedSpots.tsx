"use client"

import SpotlightCard from "./cards/SpotlightCard";

const spots = [
  {
    name: "Burnham Park",
    image: "/images/burnham.png",
    distance: "0.9km",
    time: "6 min",
    traffic: "Low" as const,
  },
  {
    name: "CJH - Yellow Trail",
    image: "/images/yellow_trail.png",
    distance: "1.2km",
    time: "8 min",
    traffic: "Moderate" as const,
    lat: 16.3994,
    lon: 120.6157,
    mapLabel: "Camp John Hay Yellow Trail",
  },
  {
    name: "SM City Baguio",
    image: "/images/smbaguio.jpg",
    distance: "0.9km",
    time: "6 min",
    traffic: "High" as const,
  },
];

const SuggestedSpots = () => {
  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-6 px-1">
        <h2 className="font-medium text-xl text-gray-900">Suggested Spots</h2>
        <p className="text-sm text-gray-500">Optimized for low traffic and crowd</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {spots.map((spot, index) => (
          <SpotlightCard key={index} {...spot} ctaText="Visit Spot" />
        ))}
      </div>
    </div>
  )
}

export default SuggestedSpots;
