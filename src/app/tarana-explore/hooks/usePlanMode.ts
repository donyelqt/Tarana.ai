'use client'

import { useCallback, useState } from 'react'
import type { FormData } from '@/app/itinerary-generator/types'
import { useItineraryGenerator } from '@/app/itinerary-generator/hooks/useItineraryGenerator'

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

  const generate = useCallback(
    async (formData: FormData) => {
      setFormSnapshot(formData)
      // Gala's hook reads its own snapshot for save; keep the two in step.
      setGalaSnapshot(formData)
      await handleGenerateItinerary(formData, null, {
        // The hook reports progress through callbacks, not a value, so the
        // boolean Plan Mode renders is tracked here rather than assumed.
        onStart: () => setIsGenerating(true),
        onComplete: () => setIsGenerating(false),
      })
    },
    [handleGenerateItinerary, setGalaSnapshot]
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
