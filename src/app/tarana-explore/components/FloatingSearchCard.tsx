"use client"

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  KeyboardEvent,
} from 'react'
import {
  Search,
  MapPin,
  ArrowUpDown,
  ArrowRight,
  X,
  Car,
  Truck,
  Bike,
  PersonStanding,
  Navigation,
  Clock,
  Zap,
  Settings2,
} from 'lucide-react'
import {
  LocationPoint,
  RoutePreferences,
  RouteType,
  VehicleType,
  SearchResult,
} from '@/types/route-optimization'
import { motion } from 'framer-motion'
import DynamicIsland from './DynamicIsland'

/** Minimum characters before we hit the geocoder (matches the API's own guard). */
const MIN_QUERY = 2
/** Keystroke debounce so a fast typist fires one request, not one per letter. */
const SEARCH_DEBOUNCE_MS = 220

/**
 * The card floats over a full-bleed map. Letting the browser scroll a freshly
 * focused input into view yanks the whole layout on mobile, so every
 * programmatic focus in this file goes through here.
 */
const focusEl = (el: HTMLElement | null) => el?.focus({ preventScroll: true })

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

type SegmentedOption<T extends string> = {
  value: T
  label: string
  icon: React.ReactNode
  /** On small viewports hide the text label and show the icon only. */
  iconOnly?: boolean
}

/**
 * Apple-style segmented control: a single white "thumb" pill that slides
 * smoothly between options (both left and right) via framer-motion shared
 * layout (layoutId) - the same feel as the iOS Control Center switcher.
 */
const SlidingSegmented = <T extends string>({
  options,
  value,
  onChange,
  layoutId,
  className = '',
}: {
  options: SegmentedOption<T>[]
  value: T | undefined
  onChange: (v: T) => void
  layoutId: string
  className?: string
}) => {
  return (
    <div className={`flex items-center bg-gray-100 rounded-full p-0.5 ${className}`}>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            title={opt.label}
            aria-pressed={active}
            className={`relative flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors duration-200 ${
              active ? 'text-gray-900' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-white shadow-sm ring-1 ring-black/5"
                transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.9 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1">
              {opt.icon}
              <span className={opt.iconOnly ? 'hidden sm:inline' : ''}>{opt.label}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

const ROUTE_TYPE_OPTIONS: SegmentedOption<RouteType>[] = [
  { value: 'fastest', label: 'Fastest', icon: <Zap className="w-3.5 h-3.5" /> },
  { value: 'shortest', label: 'Shortest', icon: <Navigation className="w-3.5 h-3.5" /> },
  { value: 'thrilling', label: 'Scenic', icon: <Clock className="w-3.5 h-3.5" /> },
]

const VEHICLE_OPTIONS: SegmentedOption<VehicleType>[] = [
  { value: 'car', label: 'Drive', icon: <Car className="w-4 h-4" />, iconOnly: true },
  { value: 'walk', label: 'Walk', icon: <PersonStanding className="w-4 h-4" />, iconOnly: true },
  { value: 'bicycle', label: 'Bike', icon: <Bike className="w-4 h-4" />, iconOnly: true },
  { value: 'motorcycle', label: 'Ride', icon: <Bike className="w-4 h-4" />, iconOnly: true },
  { value: 'truck', label: 'Truck', icon: <Truck className="w-4 h-4" />, iconOnly: true },
]

/**
 * Per-field autocomplete lifecycle.
 *
 * Each LocationField owns its own request state. Previously both fields shared a
 * single `searchResults` array in the parent, which meant "To" rendered "From"'s
 * results for a frame and both fields span their loading spinner at once. That is
 * invisible when you have to click between fields manually, but auto-advancing
 * focus makes it happen on every single selection.
 *
 * The sequence counter drops any response that is no longer the newest request,
 * so a slow geocode can never overwrite a faster, later one.
 */
function useLocationSearch() {
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const seq = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abort = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    // Bumping the sequence first invalidates anything queued or in flight, so the
    // abort below can never be mistaken for a genuine "no results" response.
    seq.current += 1
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    abort.current?.abort()
    abort.current = null
  }, [])

  const reset = useCallback(() => {
    cancel()
    setResults([])
    setSearching(false)
  }, [cancel])

  const search = useCallback(
    (q: string) => {
      cancel()
      setSearching(true)
      timer.current = setTimeout(async () => {
        const id = ++seq.current
        const controller = new AbortController()
        abort.current = controller
        try {
          const res = await fetch(`/api/locations/search?q=${encodeURIComponent(q)}`, {
            signal: controller.signal,
          })
          const data = res.ok ? await res.json() : null
          if (id !== seq.current) return
          setResults(Array.isArray(data?.results) ? data.results : [])
        } catch {
          if (id !== seq.current) return
          setResults([])
        } finally {
          if (id === seq.current) setSearching(false)
        }
      }, SEARCH_DEBOUNCE_MS)
    },
    [cancel],
  )

  useEffect(() => () => cancel(), [cancel])

  return { results, searching, search, reset }
}

interface LocationFieldProps {
  label: string
  placeholder: string
  value: LocationPoint | null
  onChange: (loc: LocationPoint | null) => void
  /**
   * Fired synchronously, still inside the user's click/keydown handler, right
   * after a suggestion is committed. The parent uses it to hand focus to the
   * other endpoint. It MUST stay inside the gesture call stack — iOS only
   * raises the software keyboard for a programmatic focus() that happens during
   * user activation, so deferring this (setTimeout/rAF) would move the caret but
   * leave the keyboard down.
   */
  onCommit?: () => void
  /** Enter pressed with no suggestion to take. */
  onEnter?: () => void
  popularLocations: LocationPoint[]
  dotColor: string
  inputRef: React.RefObject<HTMLInputElement | null>
  /** Stable id used to wire the combobox to its listbox for screen readers. */
  fieldId: string
}

const LocationField: React.FC<LocationFieldProps> = ({
  label,
  placeholder,
  value,
  onChange,
  onCommit,
  onEnter,
  popularLocations,
  dotColor,
  inputRef,
  fieldId,
}) => {
  const [query, setQuery] = useState(value?.name ?? '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const { results, searching, search, reset } = useLocationSearch()

  const listboxId = `${fieldId}-listbox`
  const inputId = `${fieldId}-input`

  /**
   * The last committed name this field knows about. An *external* change (swap
   * button, parent clearing the route) must refresh the visible text, but a
   * change this field caused itself must not clobber what the user is typing.
   */
  const syncedName = useRef<string | null>(value?.name ?? null)
  useEffect(() => {
    const name = value?.name ?? null
    if (name === syncedName.current) return
    syncedName.current = name
    setQuery(name ?? '')
  }, [value?.name])

  const searchItems = useMemo<LocationPoint[]>(
    () =>
      results
        .map((r, i) => ({
          id: r.id || `${fieldId}-result-${i}`,
          name: r.name,
          address: r.address,
          lat: r.coordinates?.lat ?? NaN,
          lng: r.coordinates?.lng ?? NaN,
        }))
        // A suggestion without usable coordinates would silently route from 0,0.
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
    [results, fieldId],
  )

  /**
   * "Typing" means the text no longer matches what is committed. Focusing a field
   * that already holds a place should offer the popular list, not "No matches".
   */
  const isTyping = query.trim().length >= MIN_QUERY && query !== (value?.name ?? '')
  const items = isTyping ? searchItems : popularLocations

  useEffect(() => setActive(-1), [items])

  // Close the suggestion list on an outside press. pointerdown (not mousedown)
  // so touch, pen and mouse behave identically.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open])

  // Keep the keyboard-highlighted row in view.
  useEffect(() => {
    if (active < 0) return
    panelRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const commit = (loc: LocationPoint) => {
    syncedName.current = loc.name
    setQuery(loc.name)
    setOpen(false)
    setActive(-1)
    reset()
    onChange(loc)
    onCommit?.()
  }

  const clear = () => {
    syncedName.current = null
    setQuery('')
    setActive(-1)
    reset()
    onChange(null)
    setOpen(true)
    focusEl(inputRef.current)
  }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setQuery(v)
    setOpen(true)
    setActive(-1)
    // Editing the text invalidates the committed place. Without this the parent
    // keeps the old LocationPoint and can route from somewhere the field is no
    // longer showing.
    if (value && v !== value.name) {
      syncedName.current = null
      onChange(null)
    }
    if (v.trim().length >= MIN_QUERY) search(v.trim())
    else reset()
  }

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      // Collapse the list first; only a second Escape should close the card.
      if (open) {
        e.stopPropagation()
        setOpen(false)
      }
      return
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!open) {
        setOpen(true)
        return
      }
      if (items.length === 0) return
      e.preventDefault()
      const dir = e.key === 'ArrowDown' ? 1 : -1
      setActive((i) => {
        const next = i + dir
        if (next < 0) return items.length - 1
        if (next > items.length - 1) return 0
        return next
      })
      return
    }

    if (e.key === 'Enter') {
      // Take the highlighted row, or the top result of an active query. Never
      // auto-take a "popular place" the user never aimed at.
      const idx = active >= 0 ? active : isTyping && items.length > 0 ? 0 : -1
      if (open && idx >= 0) {
        e.preventDefault()
        commit(items[idx])
        return
      }
      onEnter?.()
    }
  }

  const showList = open && (items.length > 0 || isTyping)

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg transition-colors">
        <div className={`w-2.5 h-2.5 rounded-full ${dotColor} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <label
            htmlFor={inputId}
            className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider leading-none mb-1"
          >
            {label}
          </label>
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInput}
            onFocus={(e) => {
              setOpen(true)
              // Tapping a field that already holds a place selects its text so the
              // next keystroke replaces it instead of appending.
              if (value) e.currentTarget.select()
            }}
            onKeyDown={handleKey}
            placeholder={placeholder}
            role="combobox"
            aria-expanded={showList}
            aria-controls={showList ? listboxId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listboxId}-opt-${active}` : undefined}
            autoComplete="off"
            enterKeyHint="search"
            className="w-full text-sm font-medium text-gray-900 placeholder:text-gray-400 bg-transparent outline-none"
          />
        </div>
        {searching && (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent flex-shrink-0" />
        )}
        {!!query && !searching && (
          <button
            type="button"
            onClick={clear}
            className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
            aria-label={`Clear ${label.toLowerCase()}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {showList && (
        <div
          ref={panelRef}
          className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-2xl border border-gray-200 max-h-80 overflow-y-auto"
        >
          {items.length > 0 && (
            <div className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
              {isTyping ? 'Results' : 'Popular places'}
            </div>
          )}
          <div id={listboxId} role="listbox" aria-label={`${label} suggestions`}>
            {items.map((loc, i) => (
              <button
                key={loc.id}
                id={`${listboxId}-opt-${i}`}
                data-idx={i}
                role="option"
                aria-selected={i === active}
                type="button"
                onClick={() => commit(loc)}
                onMouseMove={() => setActive(i)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  i === active ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
              >
                {isTyping ? (
                  <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                ) : (
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">{loc.name}</div>
                  <div className="text-xs text-gray-500 truncate">{loc.address}</div>
                </div>
              </button>
            ))}
          </div>
          {isTyping && items.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-gray-500">
              {searching ? 'Searching…' : 'No matches'}
            </div>
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
  const [isOpen, setIsOpen] = useState(false)
  const [showOptions, setShowOptions] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const originRef = useRef<HTMLInputElement | null>(null)
  const destinationRef = useRef<HTMLInputElement | null>(null)
  const submitRef = useRef<HTMLButtonElement | null>(null)

  const canSubmit = !!origin && !!destination && !isCalculating && !disabled

  const close = useCallback(() => {
    setIsOpen(false)
    setShowOptions(false)
    if (typeof document === 'undefined') return
    // Drop focus so the mobile keyboard retracts together with the card.
    const activeEl = document.activeElement as HTMLElement | null
    if (activeEl && rootRef.current?.contains(activeEl)) activeEl.blur()
  }, [])

  /**
   * The card is expanded from *explicit intent*, never from transient DOM focus.
   *
   * It used to be derived from a focus/blur pair, which breaks on touch: Safari
   * and iOS do not focus <button> elements on tap, so the blur fired when you
   * tapped a suggestion carried relatedTarget === null and read as "the user
   * left the card". Result: picking a "From" location instantly collapsed the
   * island back to the "Where to?" pill mid-flow.
   */
  const expanded = isOpen || isCalculating

  // Dismiss on a genuine outside press. pointerdown fires before focus moves and
  // is identical across mouse, touch and pen — unlike blur/relatedTarget.
  // Capture phase so the map's own handlers cannot swallow it.
  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close()
    }
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, close])

  // Once a route is on the map, collapse back to the pill. The endpoints live in
  // parent state and are deliberately kept.
  const wasCalculating = useRef(isCalculating)
  useEffect(() => {
    if (wasCalculating.current && !isCalculating) close()
    wasCalculating.current = isCalculating
  }, [isCalculating, close])

  /**
   * Opening from the pill. The actual focus is deferred to the effect below so
   * it lands on the *expanded* input, not the still-collapsed DOM node that
   * exists at the moment of the click. It lands on whichever endpoint is still
   * empty, so a half-filled route resumes where the user left off. When both are
   * already set the card expands silently rather than summoning the keyboard.
   */
  const openIsland = useCallback(() => {
    setIsOpen(true)
  }, [])

  /**
   * Move focus to the right field *after* the card has committed its expanded
   * layout to the DOM (and the relevant input actually exists/is visible). Done
   * synchronously inside the click the input is still the collapsed node and the
   * focus silently no-ops, taking the field's own onFocus (and its suggestion
   * list) with it.
   */
  const pendingFocus = useRef<'origin' | 'destination' | 'submit' | null>(null)
  useEffect(() => {
    if (!isOpen) return
    const target = pendingFocus.current
    pendingFocus.current = null
    if (target === 'origin') focusEl(originRef.current)
    else if (target === 'destination') focusEl(destinationRef.current)
    else if (target === 'submit') focusEl(submitRef.current)
    else if (origin && destination) focusEl(submitRef.current)
    else if (!origin) focusEl(originRef.current)
    else if (!destination) focusEl(destinationRef.current)
  }, [isOpen, origin, destination])

  /**
   * Auto-advance. A commit changes origin/destination, so the deferred focus
   * effect (keyed on those values) re-runs and lands on the field the user has
   * not yet filled — or on submit once both are set. Going through the effect
   * (rather than focusing mid-click) keeps it reliable in every environment,
   * including jsdom, where a synchronous focus on the still-present node can
   * race the re-render that swaps the committed text.
   */
  const handleOriginCommit = useCallback(() => {
    if (!destination) pendingFocus.current = 'destination'
    else pendingFocus.current = 'submit'
  }, [destination])

  const handleDestinationCommit = useCallback(() => {
    if (!origin) pendingFocus.current = 'origin'
    else pendingFocus.current = 'submit'
  }, [origin])

  const swap = () => {
    onOriginChange(destination)
    onDestinationChange(origin)
  }

  const hasEndpoint = !!origin || !!destination

  // The collapsed pill reports what is still selected, so the post-search
  // collapse reads as "route set", not as "my inputs were thrown away".
  const compactSummary = hasEndpoint ? (
    <span className="flex w-full items-center gap-1.5 px-4">
      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
      <span
        className={`min-w-0 truncate ${origin ? 'text-gray-900' : 'text-gray-400'}`}
        title={origin?.name}
      >
        {origin?.name ?? 'Start'}
      </span>
      <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-rose-500" />
      <span
        className={`min-w-0 truncate ${destination ? 'text-gray-900' : 'text-gray-400'}`}
        title={destination?.name}
      >
        {destination?.name ?? 'Destination'}
      </span>
    </span>
  ) : (
    <>
      <Search className="w-4 h-4 text-gray-500" />
      <span>Where to?</span>
    </>
  )

  const compactLabel = hasEndpoint
    ? `Edit route${origin ? ` from ${origin.name}` : ''}${
        destination ? ` to ${destination.name}` : ''
      }`
    : 'Open search'

  return (
    <div
      ref={rootRef}
      className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
    >
      <DynamicIsland
        expanded={expanded}
        onCompactClick={openIsland}
        compact={compactSummary}
        compactWidth={hasEndpoint ? 320 : 240}
        compactLabel={compactLabel}
      >
        <div
          className="pointer-events-auto"
          onFocusCapture={() => setIsOpen(true)}
          onBlurCapture={(e) => {
            // Only a real focus hand-off to something outside closes the card.
            // relatedTarget === null means the browser merely dropped focus
            // (iOS tap on a non-focusable control, keyboard dismissal, …) and
            // must not be read as leaving. Outside pointerdown covers that case.
            const next = e.relatedTarget as Node | null
            if (next && !e.currentTarget.contains(next)) close()
          }}
        >
          {/* Origin / Destination stack */}
          <div className="relative px-1.5 py-1">
            <LocationField
              fieldId="route-origin"
              label="From"
              placeholder="Choose starting point"
              value={origin}
              onChange={onOriginChange}
              onCommit={handleOriginCommit}
              popularLocations={popularLocations}
              dotColor="bg-emerald-500"
              inputRef={originRef}
              onEnter={origin ? handleOriginCommit : undefined}
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
              fieldId="route-destination"
              label="To"
              placeholder="Choose destination"
              value={destination}
              onChange={onDestinationChange}
              onCommit={handleDestinationCommit}
              popularLocations={popularLocations}
              dotColor="bg-rose-500"
              inputRef={destinationRef}
              onEnter={
                canSubmit ? onSubmit : destination ? handleDestinationCommit : undefined
              }
            />
          </div>

          <div className="border-t border-gray-100" />

          {/* Transport mode — full-width row */}
          <div className="px-3 py-2">
            <SlidingSegmented
              layoutId="vehicle-seg"
              value={preferences.vehicleType}
              onChange={(v) => onPreferencesChange({ vehicleType: v })}
              options={VEHICLE_OPTIONS}
            />
          </div>

          {/* Route type — full-width row */}
          <div className="px-3 pb-2 flex items-center justify-between">
            <SlidingSegmented
              layoutId="route-seg"
              value={preferences.routeType}
              onChange={(v) => onPreferencesChange({ routeType: v })}
              options={ROUTE_TYPE_OPTIONS}
            />
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
                <label
                  htmlFor="route-departure"
                  className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5"
                >
                  Depart at
                </label>
                <input
                  id="route-departure"
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
                      aria-pressed={!!preferences[opt.key]}
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
              ref={submitRef}
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
