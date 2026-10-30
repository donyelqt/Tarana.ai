import { z } from 'zod'

const itineraryRequestSchema = z.object({
  prompt: z.string().min(1).max(5000),
  weatherData: z.object({
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

const base = {
  prompt: 'Create a personalized 3 Days-day itinerary for Baguio City, Philippines',
  interests: ['Nature & Scenery'],
  duration: '3 Days',
  budget: '₱3,000 - ₱5,000/day',
  pax: '2',
  cityId: 'baguio' as const,
}

const weather = {
  weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
  main: { temp: 24, humidity: 60 },
}

describe('itinerary generator request shape', () => {
  it('rejects weatherData: null, the shape Plan Mode used to send', () => {
    const body = JSON.parse(JSON.stringify({ ...base, weatherData: null }))

    const parsed = itineraryRequestSchema.safeParse(body)

    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues[0].path).toEqual(['weatherData'])
    }
  })

  it('accepts real weather for the generated city', () => {
    const body = JSON.parse(JSON.stringify({ ...base, weatherData: weather }))

    expect(itineraryRequestSchema.safeParse(body).success).toBe(true)
  })

  it('accepts an omitted weather key, which is what a failed fetch becomes', () => {
    const body = JSON.parse(JSON.stringify({ ...base, weatherData: undefined }))

    expect(itineraryRequestSchema.safeParse(body).success).toBe(true)
  })
})