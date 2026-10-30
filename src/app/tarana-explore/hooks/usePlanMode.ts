'use client'

import { useCallback, useState } from 'react'
import type { FormData } from '@/app/itinerary-generator/types'
import type { WeatherData } from '@/lib/core'
import { useItineraryGenerator } from '@/app/itinerary-generator/hooks/useItineraryGenerator'
import { fetchWeatherData } from '@/app/itinerary-generator/utils/weatherUtils'
import { getCityCenter } from '@/lib/data/cityConfig'
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

  const fetchWeatherFor = useCallback(
    async (cityId: FormData['cityId']): Promise<WeatherData | null> => {
      const { lat, lon } = getCityCenter(cityId ?? 'baguio')
      try {
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
      setGalaSnapshot(formData)
      const weatherData = await fetchWeatherFor(formData.cityId)
      await handleGenerateItinerary(formData, weatherData ?? null, {
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
