/**
 * Unit tests for RequestWeatherProvider (pure, no I/O).
 * Returns payload.weatherData passthrough; null when absent/non-object.
 */
import { RequestWeatherProvider } from '../requestWeatherProvider';

describe('RequestWeatherProvider', () => {
  const provider = new RequestWeatherProvider();

  it('returns payload.weatherData when present as an object', async () => {
    const weatherData = { temp: 22, description: 'clear' };
    await expect(
      provider.getWeather({ prompt: 'hi', weatherData })
    ).resolves.toBe(weatherData);
  });

  it('returns null when weatherData is missing', async () => {
    await expect(provider.getWeather({ prompt: 'hi' })).resolves.toBeNull();
  });

  it('returns null when weatherData is null', async () => {
    await expect(
      provider.getWeather({ prompt: 'hi', weatherData: null })
    ).resolves.toBeNull();
  });

  it('returns null when weatherData is a non-object (string/number)', async () => {
    await expect(
      provider.getWeather({ prompt: 'hi', weatherData: 'sunny' })
    ).resolves.toBeNull();
    await expect(
      provider.getWeather({ prompt: 'hi', weatherData: 42 })
    ).resolves.toBeNull();
  });
});
