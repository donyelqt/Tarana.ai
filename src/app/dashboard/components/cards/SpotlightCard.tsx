"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { MapPin, Clock, TrafficCone, Map as MapIcon } from "lucide-react"
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
  /** Absent = no live signal — badge hidden rather than guessed. */
  traffic?: "Low" | "Moderate" | "High";
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

  // Map facade: the embed iframe (~1MB+, third-party JS) loads only after an
  // explicit tap — six eager iframes used to load on every dashboard view.
  const [mapLoaded, setMapLoaded] = useState(false);

  return (
    <div className="bg-white border border-gray-200/40 rounded-2xl flex flex-col shadow-lg hover:shadow-xl hover:-translate-y-1 transition-[transform,box-shadow] duration-300 overflow-hidden">
      <div className="relative w-full h-40">
        <Image src={image} alt={name} layout="fill" objectFit="cover" />
      </div>
      <div className="p-3 flex flex-col flex-grow">
        <h3 className="font-medium text-lg text-gray-800 mb-2 text-balance">{name}</h3>
        <div className="flex items-center text-gray-500 text-sm mb-3 space-x-4">
          <div className="flex items-center min-w-0">
            <MapPin size={16} className="mr-1.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{distance}</span>
          </div>
          <div className="flex items-center min-w-0">
            <Clock size={16} className="mr-1.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{time}</span>
          </div>
        </div>
        {traffic && (
          <div
            className={`text-sm font-medium px-3 py-1 rounded-lg self-start mb-4 border flex items-center transition-transform duration-300 hover:scale-105 ${trafficStyles[traffic]}`}
          >
            <TrafficCone size={14} className="mr-2" aria-hidden="true" />
            {traffic} Traffic
          </div>
        )}
        {coordinates && mapEmbedUrl && !mapLoaded && (
          <button
            type="button"
            onClick={() => setMapLoaded(true)}
            className="rounded-xl overflow-hidden border border-gray-200 mb-4 w-full bg-gray-50 hover:bg-gray-100 transition-colors duration-200 p-4 flex items-center justify-center gap-2 text-sm text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={`Load map for ${coordinates.name}`}
          >
            <MapIcon size={16} aria-hidden="true" />
            Show map
          </button>
        )}
        {coordinates && mapEmbedUrl && mapLoaded && (
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
