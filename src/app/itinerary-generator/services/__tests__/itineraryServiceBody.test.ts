/**
 * The body `generateItinerary` puts on the wire.
 *
 * `itineraryRequestSchema` types `weatherData` as an object with
 * `.optional()`. Zod's `.optional()` accepts an ABSENT key and rejects a
 * present one holding `null`, and `JSON.stringify` preserves a null as a real
 * key. So `weatherData: null` is a 400 "Invalid request payload" before any
 * charge or model call.
 *
 * That is what Plan Mode sent on every generation, and what Gala sends any
 * time its weather fetch fails. This test pins the serialization boundary,
 * where the shape is actually decided.
 */
import { generateItinerary } from '../itineraryService'
import { itineraryRequestSchemaForTest } from './schemaForTest'
import type { WeatherData } from '@/lib/core'

const formData = {
  budget: '₱3,000 - ₱5,000/day',
  pax: '2',
  duration: '3 Days',
  dates: { start: undefined, end: undefined },
  selectedInterests: ['Nature & Scenery'],
  trafficAware: true,
  cityId: 'baguio' as const,
}

const clearWeather: WeatherData = {
  main: { temp: 24, feels_like: 24, humidity: 60 },
  weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
  name: 'Baguio City',
  sys: { country: 'PH' },
  dt: 0,
}
/** Runs the real service and returns the body it would POST. */
async function postBodyFor(weatherData: WeatherData | null): Promise<Record<string, unknown>> {
  let captured = ''
  const fetchMock = global.fetch as jest.Mock
  fetchMock.mockImplementation(async (_url: string, init: { body: string }) => {
    captured = init.body
    return {
      json: async () => ({ text: JSON.stringify({ title: 'T', subtitle: 's', items: [] }) }),
    }
  })

  await generateItinerary(formData, weatherData)

  return JSON.parse(captured) as Record<string, unknown>
}

describe('generateItinerary request body', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockReset()
  })

  it('omits weatherData when there is none, instead of sending null', async () => {
    const body = await postBodyFor(null)

    expect('weatherData' in body).toBe(false)
    expect(itineraryRequestSchemaForTest.safeParse(body).success).toBe(true)
  })

  it('sends weatherData when the provider answered', async () => {
    const body = await postBodyFor(clearWeather)

    expect(body.weatherData).toEqual(clearWeather)
    expect(itineraryRequestSchemaForTest.safeParse(body).success).toBe(true)
  })

  it('never rejects the route schema, whatever the weather outcome', async () => {
    for (const weather of [null, clearWeather] as const) {
      const body = await postBodyFor(weather)
      const parsed = itineraryRequestSchemaForTest.safeParse(body)
      expect({
        weather: weather === null ? 'omitted' : 'sent',
        valid: parsed.success,
        issues: parsed.success ? [] : parsed.error.issues.map((i) => i.path.join('.')),
      }).toEqual({ weather: weather === null ? 'omitted' : 'sent', valid: true, issues: [] })
    }
  })
})