"use client"

import React from 'react'
import { Compass, Map as MapIcon, Loader2 } from 'lucide-react'
import { MapStyle, MAP_STYLES } from '@/lib/integrations/tomtomMapUtils'

interface MapControlsProps {
  currentMapStyle: MapStyle
  isChangingStyle: boolean
  onStyleChange: (style: MapStyle) => void
  onRecenter: () => void
  styleOptions?: MapStyle[]
}

const DEFAULT_STYLES: MapStyle[] = ['main', 'satellite']

const MapControls: React.FC<MapControlsProps> = ({
  currentMapStyle,
  isChangingStyle,
  onStyleChange,
  onRecenter,
  styleOptions = DEFAULT_STYLES,
}) => {
  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1.5">
      <button
        type="button"
        onClick={onRecenter}
        className="w-10 h-10 bg-white rounded-full shadow-md border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors"
        aria-label="Recenter to my route"
        title="Recenter"
      >
        <Compass className="w-5 h-5" />
      </button>

      <div className="w-10 bg-white rounded-full shadow-md border border-gray-200 overflow-hidden flex flex-col">
        <button
          type="button"
          onClick={() => {
            const idx = styleOptions.indexOf(currentMapStyle)
            const next = styleOptions[(idx + 1) % styleOptions.length]
            if (next !== currentMapStyle) onStyleChange(next)
          }}
          disabled={isChangingStyle}
          className="w-10 h-10 flex items-center justify-center text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors disabled:opacity-50"
          aria-label="Change map style"
          title={`Style: ${MAP_STYLES[currentMapStyle]?.name ?? currentMapStyle}`}
        >
          {isChangingStyle ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <MapIcon className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  )
}

export default MapControls
