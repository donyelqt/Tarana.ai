'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { MapPin, TrafficCone, X } from 'lucide-react'


export type SpotTraffic = 'Low' | 'Moderate' | 'High'

const TRAFFIC_STYLES: Record<SpotTraffic, string> = {
  Low: 'border-green-300 bg-green-50 text-green-600',
  Moderate: 'border-yellow-300 bg-yellow-50 text-yellow-600',
  High: 'border-red-300 bg-red-50 text-red-600',
}

export interface SpotPreviewCardProps {
  name: string
  image: string | null
  traffic: SpotTraffic | null
  onDismiss: () => void
}

const SpotPreviewCard: React.FC<SpotPreviewCardProps> = ({ name, image, traffic, onDismiss }) => {
  const [imageFailed, setImageFailed] = useState(false)
  const showPhoto = !!image && !imageFailed

  return (
    <div
      role="group"
      aria-label={`Selected spot: ${name}`}
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-[min(22rem,calc(100vw-2rem))]"
    >
      <div className="overflow-hidden rounded-2xl border border-gray-200/60 bg-white shadow-xl">
        <div className="relative h-32 w-full bg-[#eff6ff]">
          {showPhoto ? (
            <Image
              src={image as string}
              alt={name}
              fill
              sizes="352px"
              className="object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Image src="/images/taranaai2.png" alt="Tarana.ai" width={56} height={56} className="object-contain" />
            </div>
          )}
          {}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss spot preview"
            className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-gray-600 shadow transition-colors hover:bg-white hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-4">
          <h2 className="flex items-start gap-1.5 text-base font-semibold leading-snug text-gray-900">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
            <span>{name}</span>
          </h2>

          {traffic && (
            <p
              className={`mt-3 inline-flex items-center rounded-lg border px-3 py-1 text-sm font-medium ${TRAFFIC_STYLES[traffic]}`}
            >
              <TrafficCone className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
              {traffic} Traffic
            </p>
          )}

        </div>
      </div>
    </div>
  )
}

export default SpotPreviewCard