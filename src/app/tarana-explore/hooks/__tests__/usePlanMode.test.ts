/**
 * The request Plan Mode actually sends.
 *
 * The generation route rejected every Plan Mode request with a 400 because
 * the body carried `weatherData: null`. Zod's `.optional()` accepts
 * `undefined` and rejects `null`, and `JSON.stringify` keeps a null as a
 * present key, so the route saw exactly that and refused it before any charge
 * or model call.
 *
 * These cases drive the hook and inspect the bytes on the wire, which is the
 * only level where the bug was visible — the schema test proves `null` is
 * rejected, this proves the hook stops sending it.
 */
import { renderHook, act, waitFor } from '@testing-library/react'

const generateItineraryMock = jest.fn()
const fetchWeatherMock = jest.fn()

jest.mock('@/app/itinerary-generator/hooks/useItineraryGenerator', () => ({
  useItineraryGenerator: () => ({
    generatedItinerary: null,
    handleGenerateItinerary: generateItineraryMock,
    handleSaveItinerary: jest.fn(),
    setGeneratedItinerary: jest.fn(),
    setFormSnapshot: jest.fn(),
    isOutOfCredits: false,
    isCheckingCredits: false,
    creditBalance: null,
  }),
}))

jest.mock('@/app/itinerary-generator/utils/weatherUtils', () => ({
  fetchWeatherData: (...args: unknown[]) => fetchWeatherMock(...args),
}))

jest.mock('@/lib/data/cityConfig', () => ({
  getCityCenter: (cityId: string) => ({
    lat: cityId === 'manila' ? 14.5995 : 16.4134,
    lon: cityId === 'manila' ? 120.9842 : 120.5934,
  }),
}))

import { usePlanMode } from '../usePlanMode'

const formData = {
  budget: '₱3,000 - ₱5,000/day',
  pax: '2',
  duration: '3 Days',
  dates: { start: undefined, end: undefined },
  selectedInterests: ['Nature & Scenery'],
  trafficAware: true,
  cityId: 'baguio' as const,
}

const clearWeather = {
  weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
  main: { temp: 24, humidity: 60 },
}

describe('usePlanMode request body', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    generateItineraryMock.mockResolvedValue(undefined)
  })

  it('sends real weather for the generated city, never null', async () => {
    fetchWeatherMock.mockResolvedValue(clearWeather)
    const { result } = renderHook(() => usePlanMode())

    await act(async () => {
      await result.current.generate(formData)
    })

    expect(fetchWeatherMock).toHaveBeenCalledWith(16.4134, 120.5934)
    const weatherArg = generateItineraryMock.mock.calls[0][1]
    expect(weatherArg).toEqual(clearWeather)
    expect(weatherArg).not.toBeNull()

    // The wire shape is what the route parses: a present key must not be null.
    const onWire = JSON.parse(JSON.stringify({ weatherData: weatherArg }))
    expect(onWire.weatherData).not.toBeNull()
  })

  it('omits the key entirely when the provider fails, instead of sending null', async () => {
    // fetchWeatherData swallows provider errors and returns null.
    fetchWeatherMock.mockResolvedValue(null)
    const { result } = renderHook(() => usePlanMode())

    await act(async () => {
      await result.current.generate(formData)
    })

    await waitFor(() => expect(generateItineraryMock).toHaveBeenCalledTimes(1))
    expect(generateItineraryMock.mock.calls[0][1] ?? null).toBeNull()
  })

  it('scopes the weather lookup to the submitted city, not a default', async () => {
    fetchWeatherMock.mockResolvedValue(clearWeather)
    const { result } = renderHook(() => usePlanMode())

    await act(async () => {
      await result.current.generate({ ...formData, cityId: 'manila' })
    })

    expect(fetchWeatherMock).toHaveBeenCalledWith(14.5995, 120.9842)
  })

  it('still generates when the weather lookup rejects', async () => {
    fetchWeatherMock.mockRejectedValue(new Error('weather down'))
    const { result } = renderHook(() => usePlanMode())

    await act(async () => {
      await result.current.generate(formData)
    })

    await waitFor(() => expect(generateItineraryMock).toHaveBeenCalledTimes(1))
    expect(generateItineraryMock.mock.calls[0][1]).toBeNull()
  })
})