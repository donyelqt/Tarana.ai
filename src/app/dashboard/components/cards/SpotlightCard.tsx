"use client"

import Image from "next/image"
import { Button } from "@/components/ui/button"
import { MapPin, Clock, TrafficCone } from "lucide-react"
import { getActivityCoordinates } from "@/lib/data/baguioCoordinates"

const trafficStyles: { [key: string]: string } = {
  Low: "border-green-300 bg-green-50 text-green-600 animate-glow-green",
  Moderate: "border-yellow-300 bg-yellow-50 text-yellow-600 animate-glow-yellow",
  High: "border-red-300 bg-red-50 text-red-600 animate-glow-red",
}

interface SpotlightCardProps {
  name: string;
  image: string;
  distance: string;
  time: string;
  traffic: "Low" | "Moderate" | "High";
  ctaText: string;
  lat?: number;
  lon?: number;
  mapLabel?: string;
}

const SpotlightCard = ({
  name,
  image,
  distance,
  time,
  traffic,
  ctaText,
  lat,
  lon,
  mapLabel,
}: SpotlightCardProps) => {
  const coordinates = lat !== undefined && lon !== undefined
    ? { lat, lon, name: mapLabel ?? name }
    : getActivityCoordinates(name);

  const mapEmbedUrl = coordinates
    ? `https://www.google.com/maps?q=${coordinates.lat},${coordinates.lon}&z=15&output=embed`
    : null;

  const mapLink = coordinates
    ? `https://www.google.com/maps/search/?api=1&query=${coordinates.lat},${coordinates.lon}`
    : null;

  return (
    <div className="bg-white border border-gray-200/40 rounded-2xl flex flex-col shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
      <div className="relative w-full h-40">
        <Image src={image} alt={name} layout="fill" objectFit="cover" />
      </div>
      <div className="p-3 flex flex-col flex-grow">
        <h3 className="font-medium text-lg text-gray-800 mb-2">{name}</h3>
        <div className="flex items-center text-gray-500 text-sm mb-3 space-x-4">
          <div className="flex items-center">
            <MapPin size={16} className="mr-1.5" />
            <span>{distance}</span>
          </div>
          <div className="flex items-center">
            <Clock size={16} className="mr-1.5" />
            <span>{time}</span>
          </div>
        </div>
        <div
          className={`text-sm font-medium px-3 py-1 rounded-lg self-start mb-4 border flex items-center transition-all duration-300 hover:scale-105 ${trafficStyles[traffic]}`}
        >
          <TrafficCone size={14} className="mr-2" />
          {traffic} Traffic
        </div>
        {coordinates && mapEmbedUrl && (
          <div className="rounded-xl overflow-hidden border border-gray-200 mb-4">
            <iframe
              title={`${coordinates.name} map`}
              src={mapEmbedUrl}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              className="w-full h-40"
            />
          </div>
        )}
        <div className="mt-auto">
          {mapLink ? (
            <a
              href={mapLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button className="w-full bg-gradient-to-b from-blue-700 to-blue-500 hover:to-blue-700 text-white font-medium">
                {ctaText}
              </Button>
            </a>
          ) : (
            <Button className="w-full bg-gradient-to-b from-blue-700 to-blue-500 hover:to-blue-700 text-white font-medium">
              {ctaText}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default SpotlightCard;
