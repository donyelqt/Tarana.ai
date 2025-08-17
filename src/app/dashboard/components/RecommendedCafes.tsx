"use client"

import SpotlightCard from "./cards/SpotlightCard";

const cafes = [
  {
    name: "Cafe Ysap",
    image: "/images/taranaai.png",
    distance: "0.9km",
    time: "6 min",
    traffic: "Low" as const,
  },
  {
    name: "Cafe Ysap",
    image: "/images/taranaai.png",
    distance: "0.9km",
    time: "6 min",
    traffic: "Low" as const,
  },
  {
    name: "Cafe Ysap",
    image: "/images/taranaai.png",
    distance: "0.9km",
    time: "6 min",
    traffic: "Low" as const,
  },
];

export const RecommendedCafes = () => {
  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-6 px-1">
        <h2 className="font-medium text-xl text-gray-900">Recommended Cafes</h2>
        <p className="text-sm text-gray-500">Matched to your tastes</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cafes.map((cafe, index) => (
          <SpotlightCard key={index} {...cafe} ctaText="View Cafe" />
        ))}
      </div>
    </div>
  )
}

export default RecommendedCafes;
