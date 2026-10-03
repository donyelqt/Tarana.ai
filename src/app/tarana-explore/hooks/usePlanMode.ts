'use client'

import { useCallback, useState } from 'react'
import type { FormData } from '@/app/itinerary-generator/types'
import type { WeatherData } from '@/lib/core'
import { useItineraryGenerator } from '@/app/itinerary-generator/hooks/useItineraryGenerator'
import { fetchWeatherData } from '@/app/itinerary-generator/utils/weatherUtils'
import { getCityCenter } from '@/lib/data/cityConfig'
/**
 * Plan Mode state: the config snapshot and the itinerary it produced.
 *
 * Generation goes through Gala's own hook rather than a second call site, so
 * charge-first billing, refund-on-failure, idempotency, and the out-of-credits
 * copy are inherited instead of re-implemented. A parallel implementation would
 * be a second billing path, which is the one thing this repo's conventions are
 * explicit about not doing.
 *
 * `formSnapshot` lives here because Gala's save path reads it. On the Gala page
 * it is a side effect of the same hook call; Explore has no page-level snapshot,
 * so Plan Mode keeps its own or "Save" silently has nothing to persist.
 */
export function usePlanMode() {
  const [formSnapshot, setFormSnapshot] = useState<FormData | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const {
    generatedItinerary,
    handleGenerateItinerary,
    handleSaveItinerary,
    setGeneratedItinerary,
    setFormSnapshot: setGalaSnapshot,
    isOutOfCredits,
    isCheckingCredits,
    creditBalance,
  } = useItineraryGenerator()

  /**
   * Fetch weather for the city that was actually submitted.
   *
   * Two reasons this is not simply omitted:
   *
   * 1. `itineraryRequestSchema` types `weatherData` as an object with
   *    `.optional()`, which accepts `undefined` but rejects `null`. Plan Mode
   *    used to send an explicit null, so every generation failed validation
   *    with a 400 before any charge or model call.
   * 2. Weather is load-bearing. The route derives `weatherType` from it and
   *    `weatherMatch` filters the activity pool, so omitting it would make
   *    Plan Mode produce different itineraries than Gala for the same input,
   *    breaking the parity this hook exists to guarantee.
   *
   * Fetched at submit rather than prefetched on city change so the weather
   * always matches the city in this request, with no window where a city
   * switch leaves stale weather behind.
   */
  const fetchWeatherFor = useCallback(
    async (cityId: FormData['cityId']): Promise<WeatherData | null> => {
      const { lat, lon } = getCityCenter(cityId ?? 'baguio')
      try {
        // fetchWeatherData already swallows provider failures and returns
        // null. The catch covers a rejected call too, because weather is an
        // enhancement to generation, never a precondition for it: a thrown
        // lookup must not stop the itinerary from being built.
        return await fetchWeatherData(lat, lon)
      } catch {
        return null
      }
    },
    []
  )

  const generate = useCallback(
    async (formData: FormData) => {
      setFormSnapshot(formData)
      // Gala's hook reads its own snapshot for save; keep the two in step.
      setGalaSnapshot(formData)
      const weatherData = await fetchWeatherFor(formData.cityId)
      await handleGenerateItinerary(formData, weatherData ?? null, {
        // The hook reports progress through callbacks, not a value, so the
        // boolean Plan Mode renders is tracked here rather than assumed.
        onStart: () => setIsGenerating(true),
        onComplete: () => setIsGenerating(false),
      })
    },
    [handleGenerateItinerary, setGalaSnapshot, fetchWeatherFor]
  )

  const clearPlan = useCallback(() => {
    setFormSnapshot(null)
    setGeneratedItinerary(null)
  }, [setGeneratedItinerary])

  return {
    formSnapshot,
    generate,
    clearPlan,
    itinerary: generatedItinerary,
    save: handleSaveItinerary,
    isGenerating,
    isOutOfCredits,
    isCheckingCredits,
    creditBalance,
  }
}
