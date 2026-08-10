"use client"

import React, { useState, useEffect, useRef, useCallback, KeyboardEvent } from 'react'
import {
  Search,
  MapPin,
  ArrowUpDown,
  X,
  Car,
  Truck,
  Bike,
  PersonStanding,
  Navigation,
  Clock,
  Zap,
  Settings2,
  Plus,
} from 'lucide-react'
import { LocationPoint, RoutePreferences, RouteType, VehicleType, SearchResult } from '@/types/route-optimization'
import DynamicIsland from './DynamicIsland'

interface FloatingSearchCardProps {
  origin: LocationPoint | null
  destination: LocationPoint | null
  preferences: RoutePreferences
  onOriginChange: (loc: LocationPoint | null) => void
  onDestinationChange: (loc: LocationPoint | null) => void
  onPreferencesChange: (prefs: Partial<RoutePreferences>) => void
  onSubmit: () => void
  isCalculating: boolean
  popularLocations: LocationPoint[]
  disabled?: boolean
}

const ROUTE_TYPE_OPTIONS: Array<{ value: RouteType; label: string; icon: React.ReactNode }> = [
  { value: 'fastest', label: 'Fastest', icon: <Zap className="w-3.5 h-3.5" /> },
  { value: 'shortest', label: 'Shortest', icon: <Navigation className="w-3.5 h-3.5" /> },
  { value: 'thrilling', label: 'Scenic', icon: <Clock className="w-3.5 h-3.5" /> },
]

const VEHICLE_OPTIONS: Array<{ value: VehicleType; label: string; icon: React.ReactNode }> = [
  { value: 'car', label: 'Drive', icon: <Car className="w-4 h-4" /> },
  { value: 'walk', label: 'Walk', icon: <PersonStanding className="w-4 h-4" /> },
  { value: 'bicycle', label: 'Bike', icon: <Bike className="w-4 h-4" /> },
  { value: 'motorcycle', label: 'Ride', icon: <Bike className="w-4 h-4" /> },
  { value: 'truck', label: 'Truck', icon: <Truck className="w-4 h-4" /> },
]

const LocationField: React.FC<{
  label: string
  placeholder: string
  value: LocationPoint | null
  onChange: (loc: LocationPoint | null) => void
  onSearch: (q: string) => void
  searchResults: SearchResult[]
  isSearching: boolean
  popularLocations: LocationPoint[]
  dotColor: string
  onEnter?: () => void
}> = ({
  label,
  placeholder,
  value,
  onChange,
  onSearch,
  searchResults,
  isSearching,
  popularLocations,
  dotColor,
  onEnter,
}) => {
  const [query, setQuery] = useState(value?.name ?? '')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQuery(value?.name ?? '')
  }, [value?.name])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value
      setQuery(v)
      if (v.length === 0) {
        setOpen(true)
        onChange(null)
      } else if (v.length >= 2) {
        setOpen(true)
        onSearch(v)
      }
    },
    [onChange, onSearch],
  )

  const pick = (loc: LocationPoint) => {
    onChange(loc)
    setQuery(loc.name)
    setOpen(false)
  }

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onEnter) onEnter()
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg transition-colors">
        <div className={`w-2.5 h-2.5 rounded-full ${dotColor} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider leading-none mb-1">
            {label}
          </div>
          <input
            type="text"
            value={query}
            onChange={handleInput}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKey}
            placeholder={placeholder}
            className="w-full text-sm font-medium text-gray-900 placeholder:text-gray-400 bg-transparent outline-none"
          />
        </div>
        {isSearching && (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent flex-shrink-0" />
        )}
        {value && !isSearching && (
          <button
            type="button"
            onClick={() => {
              onChange(null)
              setQuery('')
            }}
            className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
            aria-label="Clear"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-2xl border border-gray-200 max-h-80 overflow-y-auto">
          {query.length < 2 && popularLocations.length > 0 && (
            <>
              <div className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                Popular places
              </div>
              {popularLocations.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => pick(loc)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left transition-colors"
                >
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">{loc.name}</div>
                    <div className="text-xs text-gray-500 truncate">{loc.address}</div>
                  </div>
                </button>
              ))}
            </>
          )}
          {query.length >= 2 && searchResults.length > 0 && (
            <>
              <div className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                Results
              </div>
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() =>
                    pick({
                      id: r.id || `search-${i}`,
                      name: r.name,
                      address: r.address,
                      lat: r.coordinates?.lat ?? 0,
                      lng: r.coordinates?.lng ?? 0,
                    })
                  }
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left transition-colors"
                >
                  <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">{r.name}</div>
                    <div className="text-xs text-gray-500 truncate">{r.address}</div>
                  </div>
                </button>
              ))}
            </>
          )}
          {query.length >= 2 && searchResults.length === 0 && !isSearching && (
            <div className="px-3 py-6 text-center text-sm text-gray-500">No matches</div>
          )}
        </div>
      )}
    </div>
  )
}

const FloatingSearchCard: React.FC<FloatingSearchCardProps> = ({
  origin,
  destination,
  preferences,
  onOriginChange,
  onDestinationChange,
  onPreferencesChange,
  onSubmit,
  isCalculating,
  popularLocations,
  disabled,
}) => {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [focused, setFocused] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const openIsland = useCallback(() => {
    setFocused(true)
    requestAnimationFrame(() =>
      cardRef.current?.querySelector<HTMLInputElement>("input")?.focus(),
    )
  }, [])
  // Expand only on interaction/data-calc, NOT merely because fields are filled.
  // This lets the card return to the compact "Where to?" phase after a route is found.
  const expanded = focused || isCalculating || showOptions

  // When a route calculation completes, collapse back to "Where to?" while keeping
  // the user's origin/destination/preferences (those live in parent state, untouched).
  const wasCalculating = useRef(isCalculating)
  useEffect(() => {
    if (wasCalculating.current && !isCalculating) {
      setFocused(false)
      setShowOptions(false)
      if (typeof document !== "undefined") {
        ;(document.activeElement as HTMLElement | null)?.blur()
      }
    }
    wasCalculating.current = isCalculating
  }, [isCalculating])

  const handleSearch = useCallback(async (q: string) => {
    setIsSearching(true)
    try {
      const res = await fetch(`/api/locations/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data.results || [])
      } else {
        setSearchResults([])
      }
    } catch {
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  const swap = () => {
    const tmp = origin
    onOriginChange(destination)
    onDestinationChange(tmp)
  }

  const canSubmit = !!origin && !!destination && !isCalculating && !disabled

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
      <DynamicIsland
        expanded={expanded}
        onCompactClick={openIsland}
        compact={
          <>
            <Search className="w-4 h-4 text-gray-500" />
            <span>Where to?</span>
          </>
        }
      >
        <div
          ref={cardRef}
          className="pointer-events-auto"
          onFocusCapture={() => setFocused(true)}
          onBlurCapture={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
          }}
        >
        {/* Origin / Destination stack */}
        <div className="relative px-1.5 py-1">
          <LocationField
            label="From"
            placeholder="Choose starting point"
            value={origin}
            onChange={onOriginChange}
            onSearch={handleSearch}
            searchResults={searchResults}
            isSearching={isSearching}
            popularLocations={popularLocations}
            dotColor="bg-emerald-500"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-px bg-gray-200" />
          <button
            type="button"
            onClick={swap}
            aria-label="Swap origin and destination"
            className="absolute left-4 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 p-1 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-colors shadow-sm"
          >
            <ArrowUpDown className="w-3 h-3" />
          </button>
          <LocationField
            label="To"
            placeholder="Choose destination"
            value={destination}
            onChange={onDestinationChange}
            onSearch={handleSearch}
            searchResults={searchResults}
            isSearching={isSearching}
            popularLocations={popularLocations}
            dotColor="bg-rose-500"
            onEnter={canSubmit ? onSubmit : undefined}
          />
        </div>

        <div className="border-t border-gray-100" />

        {/* Transport mode — full-width row */}
        <div className="px-3 py-2">
          <div className="flex items-center justify-center bg-gray-100 rounded-full p-0.5">
            {VEHICLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onPreferencesChange({ vehicleType: opt.value })}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  preferences.vehicleType === opt.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title={opt.label}
              >
                {opt.icon}
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Route type — full-width row */}
        <div className="px-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {ROUTE_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onPreferencesChange({ routeType: opt.value })}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                  preferences.routeType === opt.value
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowOptions((v) => !v)}
            className={`p-1.5 rounded-full transition-colors flex-shrink-0 ${
              showOptions ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-900'
            }`}
            aria-label="More options"
            aria-expanded={showOptions}
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>

        {/* Options drawer */}
        {showOptions && (
          <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-gray-50/60">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Depart at
              </label>
              <input
                type="datetime-local"
                onChange={(e) =>
                  onPreferencesChange({
                    departureTime: e.target.value ? new Date(e.target.value) : undefined,
                  })
                }
                className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Avoid
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: 'avoidTolls' as const, label: 'Tolls' },
                  { key: 'avoidFerries' as const, label: 'Ferries' },
                  { key: 'avoidTrafficJams' as const, label: 'Traffic' },
                  { key: 'avoidHighways' as const, label: 'Highways' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() =>
                      onPreferencesChange({
                        [opt.key]: !preferences[opt.key],
                      } as Partial<RoutePreferences>)
                    }
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      preferences[opt.key]
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="border-t border-gray-100 p-2.5">
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium text-sm py-2.5 rounded-xl transition-colors"
          >
            {isCalculating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                <span>Finding best route…</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Get directions</span>
              </>
            )}
          </button>
        </div>
        </div>
      </DynamicIsland>
    </div>
  )
}

export default FloatingSearchCard
