"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { MapPin, Clock, TrafficCone } from "lucide-react"

const trafficStyles: Record<'Low' | 'Moderate' | 'High', string> = {
  Low: "border-green-300 bg-green-50 text-green-600 animate-glow-green",
  Moderate: "border-yellow-300 bg-yellow-50 text-yellow-600 animate-glow-yellow",
  High: "border-red-300 bg-red-50 text-red-600 animate-glow-red",
}

interface SpotlightCardProps {
  name: string
  image: string | null
  distance: string
  time: string
  traffic?: 'Low' | 'Moderate' | 'High'
  ctaText: string
  lat?: number
  lon?: number
  mapLabel?: string
  priority?: boolean
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
  priority,
}: SpotlightCardProps) => {
  const hasCoordinates = typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon)
  const trafficParam = traffic ? `&traffic=${encodeURIComponent(traffic)}` : ''
  const isPlaceholder = (src: string) => /comingsoon/i.test(src)
  const imageParam = image && !isPlaceholder(image) ? `&img=${encodeURIComponent(image)}` : ''
  const label = mapLabel ?? name
  const exploreHref = hasCoordinates
    ? `/tarana-explore?to=${encodeURIComponent(label)}&toLat=${lat}&toLon=${lon}${trafficParam}${imageParam}`
    : null
  const [imageFailed, setImageFailed] = useState(false)
  const showPhoto = !!image && !isPlaceholder(image) && !imageFailed

  return (
    <div className="bg-white border border-gray-200 rounded-2xl flex flex-col shadow-sm hover:shadow-md motion-safe:hover:-translate-y-1 motion-safe:transition-[transform,box-shadow] duration-200 overflow-hidden">
      <div className="relative w-full h-40 bg-[#eff6ff] overflow-hidden flex items-center justify-center">
        {!showPhoto && (
          <Image
            src="/images/taranaai.png"
            alt=""
            width={96}
            height={96}
            className="object-contain"
          />
        )}
        {showPhoto && (
          <Image
            src={image}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            className="object-cover"
            priority={priority}
            onError={() => setImageFailed(true)}
          />
        )}
      </div>

      <div className="p-3 flex flex-col flex-grow">
        <h3 className="font-medium text-lg text-gray-800 mb-2 text-balance">{name}</h3>
        <div className="flex items-center text-gray-500 text-sm mb-3 space-x-4 tabular-nums">
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
          <div className={`text-sm font-medium px-3 py-1 rounded-lg self-start mb-4 border flex items-center ${trafficStyles[traffic]}`}>
            <TrafficCone size={14} className="mr-2" aria-hidden="true" />
            {traffic} Traffic
          </div>
        )}

        <div className="mt-auto">
          {exploreHref ? (
            <Link
              href={exploreHref}
              aria-label={`${ctaText}: ${label}`}
              className="min-h-[44px] h-10 px-4 rounded-xl bg-gradient-to-b from-blue-700 to-blue-500 hover:to-blue-700 text-white text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 flex items-center justify-center text-center transition-shadow duration-200 hover:shadow-md"
            >
              {ctaText}
            </Link>
          ) : (
            <button type="button" disabled className="min-h-[44px] h-10 px-4 rounded-xl border border-gray-200 bg-gray-50 text-gray-400 text-sm font-medium flex items-center justify-center text-center cursor-not-allowed">
              {ctaText}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default SpotlightCard;
