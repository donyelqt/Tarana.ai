/**
 * Mirror of `itineraryRequestSchema`
 * (`src/app/api/gemini/itinerary-generator/route.ts:32-57`).
 *
 * The route keeps its schema module-private, and exporting production code
 * purely so a test can import it is a worse trade than restating it here with a
 * pointer to the source. `planModeRequestShape.test.ts` in the route's own
 * `__tests__` directory carries the same mirror; if the route's schema changes,
 * both mirrors must be updated with it.
 *
 * `weatherData` matters here: `.optional()` accepts an absent key and rejects
 * a present one holding `null`.
 */
import { z } from 'zod'

export const itineraryRequestSchemaForTest = z.object({
  prompt: z.string().min(1).max(5000),
  weatherData: z
    .object({
      weather: z
        .array(
          z.object({
            id: z.number().int().optional(),
            main: z.string().max(100).optional(),
            description: z.string().max(300).optional(),
            icon: z.string().max(50).optional(),
          })
        )
        .max(10)
        .optional(),
      main: z
        .object({
          temp: z.number().min(-150).max(150).optional(),
          feels_like: z.number().optional(),
          temp_min: z.number().optional(),
          temp_max: z.number().optional(),
          humidity: z.number().optional(),
        })
        .partial()
        .optional(),
    })
    .passthrough()
    .optional(),
  interests: z.array(z.string().min(1).max(100)).max(25).optional(),
  duration: z.union([z.string().max(100), z.number().int().positive()]).optional(),
  budget: z.string().max(100).optional(),
  pax: z.union([z.string().max(50), z.number().int().positive()]).optional(),
  cityId: z.enum(['baguio', 'cebu', 'manila', 'davao', 'boracay', 'el_nido', 'ph-wide', 'world']).optional(),
  options: z.object({ trafficAware: z.boolean().default(true).optional() }).optional(),
})