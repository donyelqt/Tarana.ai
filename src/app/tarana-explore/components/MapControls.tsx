"use client"

import React from 'react'
import { Compass, Map as MapIcon, Loader2, Box, Square, Route, Plus, Minus } from 'lucide-react'
import { MapStyle, MAP_STYLES } from '@/lib/integrations/tomtomMapUtils'

interface MapControlsProps {
  currentMapStyle: MapStyle
  isChangingStyle: boolean
  onStyleChange: (style: MapStyle) => void
  onRecenter: () => void
  /** Signed steps: negative zooms out, positive zooms in. */
  onZoom: (steps: number) => void
  /** True at either zoom bound, so both buttons disable together. */
  zoomDisabled?: boolean
  tiltOn: boolean
  onToggleTilt: () => void
  /** Plan Mode is a display mode: it swaps the island's config, not the route. */
  planMode: boolean
  onTogglePlan: () => void
  styleOptions?: MapStyle[]
}

const DEFAULT_STYLES: MapStyle[] = ['main', 'satellite']

const MapControls: React.FC<MapControlsProps> = ({
  currentMapStyle,
  isChangingStyle,
  onStyleChange,
  onRecenter,
  onZoom,
  zoomDisabled = false,
  tiltOn,
  onToggleTilt,
  planMode,
  onTogglePlan,
  styleOptions = DEFAULT_STYLES,
}) => {
  return (
    // z-40, above the island's z-30. At narrow widths the expanded planner
    // card reaches past the middle of the screen, so a rail painted
    // underneath it would be unreachable. The switch that opened the card
    // must stay tappable while the card is on screen, or the mode cannot be
    // turned off.
    <div className="absolute right-3 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-1.5">

      {/*
        Zoom first, where a map user reaches for it. Two circular controls in
        the rail's own language, deliberately NOT TomTom's NavigationControl:
        that control is rectangular, pins itself to the map's top-right, and
        would sit on top of this rail.
      */}
      <button
        type="button"
        onClick={() => onZoom(1)}
        disabled={zoomDisabled}
        className="w-10 h-10 bg-white rounded-full shadow-md border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-gray-700"
        aria-label="Zoom in"
        title="Zoom in"
      >
        <Plus className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={() => onZoom(-1)}
        disabled={zoomDisabled}
        className="w-10 h-10 bg-white rounded-full shadow-md border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-gray-700"
        aria-label="Zoom out"
        title="Zoom out"
      >
        <Minus className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={onTogglePlan}
        className={
          planMode
            ? 'w-10 h-10 rounded-full shadow-md border flex items-center justify-center transition-colors bg-blue-600 border-blue-600 text-white'
            : 'w-10 h-10 rounded-full shadow-md border flex items-center justify-center transition-colors bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600'
        }
        aria-pressed={planMode}
        aria-label={planMode ? 'Plan mode: on' : 'Plan mode: off'}
        title={planMode ? 'Plan mode: On' : 'Plan mode: Off'}
      >
        <Route className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={onRecenter}
        className="w-10 h-10 bg-white rounded-full shadow-md border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors"
        aria-label="Recenter to my route"
        title="Recenter"
      >
        <Compass className="w-5 h-5" />
      </button>

      <button
        type="button"
        onClick={onToggleTilt}
        className={tiltOn ? 'w-10 h-10 rounded-full shadow-md border flex items-center justify-center transition-colors bg-blue-600 border-blue-600 text-white' : 'w-10 h-10 rounded-full shadow-md border flex items-center justify-center transition-colors bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600'}
        aria-label={tiltOn ? 'Turn off 3D tilt' : 'Turn on 3D tilt'}
        title={tiltOn ? '3D tilt: On' : '3D tilt: Off'}
      >
        {tiltOn ? <Box className="w-5 h-5" /> : <Square className="w-5 h-5" />}
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
