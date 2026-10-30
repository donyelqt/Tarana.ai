"use client"

import { useState } from "react"
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
  image: string | null;
  distance: string;
  time: string;
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

  const trafficParam = traffic ? `&traffic=${encodeURIComponent(traffic)}` : ''
  const isPlaceholder = (src: string) => /comingsoon/i.test(src)
  const imageParam = image && !isPlaceholder(image) ? `&img=${encodeURIComponent(image)}` : ''
  const exploreHref = coordinates
    ? `/tarana-explore?to=${encodeURIComponent(coordinates.name)}&toLat=${coordinates.lat}&toLon=${coordinates.lon}${trafficParam}${imageParam}`
    : null;
  const [imageFailed, setImageFailed] = useState(false);
  const showPhoto = !!image && !imageFailed;

  return (
    <div className="bg-white border border-gray-200/40 rounded-2xl flex flex-col shadow-lg hover:shadow-xl hover:-translate-y-1 transition-[transform,box-shadow] duration-300 overflow-hidden">
      <div className="relative w-full h-40 bg-[#eff6ff] overflow-hidden flex items-center justify-center">
        <Image
          src="/images/taranaai2.png"
          alt="Tarana.ai"
          width={96}
          height={96}
          className="object-contain"
        />
        {showPhoto && (
          <Image
            src={image}
            alt={name}
            layout="fill"
            objectFit="cover"
            onError={() => setImageFailed(true)}
          />
        )}
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

        <div className="mt-auto">
          {exploreHref ? (
            <a href={exploreHref} className="block" aria-label={`${ctaText}: ${coordinates?.name}`}>
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
