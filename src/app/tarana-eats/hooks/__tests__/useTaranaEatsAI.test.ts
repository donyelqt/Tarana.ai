import { act, renderHook } from '@testing-library/react';
import { useTaranaEatsAI } from '../useTaranaEatsAI';
import type { TaranaEatsFormValues } from '@/types/tarana-eats';

const formValues: TaranaEatsFormValues = {
  budget: '₱500',
  cuisine: 'Cafe',
  pax: 2,
  restrictions: [],
  mealType: [],
};

const idempotencyKey = '00000000-0000-4000-8000-000000000001';

describe('useTaranaEatsAI', () => {
  const originalRandomUUID = globalThis.crypto.randomUUID;
  const fetchMock = global.fetch as jest.Mock;

  beforeEach(() => {
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: jest.fn(() => idempotencyKey),
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ matches: [] }),
    });
  });

  afterAll(() => {
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: originalRandomUUID,
    });
  });

  test('sends one stable idempotency key for a generation request', async () => {
    const { result } = renderHook(() => useTaranaEatsAI());

    await act(async () => {
      await result.current.generateRecommendations(formValues);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/gemini/food-recommendations',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Idempotency-Key': idempotencyKey }),
      })
    );
  });
});
