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

describe('useTaranaEatsAI', () => {
  const fetchMock = global.fetch as jest.Mock;

  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ matches: [] }),
    });
  });

  test('sends one stable idempotency key for a generation request', async () => {
    const { result } = renderHook(() => useTaranaEatsAI());

    await act(async () => {
      await result.current.generateRecommendations(formValues);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sentKey = (fetchMock.mock.calls[0][1] as { headers: Record<string, string> }).headers['Idempotency-Key'];
    expect(sentKey).toMatch(/^eats:[0-9a-f]{8}$/);
  });

  test('reuses the same key for identical resubmits and rotates on field change', async () => {
    const { result } = renderHook(() => useTaranaEatsAI());

    await act(async () => {
      await result.current.generateRecommendations(formValues);
    });
    await act(async () => {
      await result.current.generateRecommendations(formValues);
    });
    const firstKey = fetchMock.mock.calls[0][1].headers['Idempotency-Key'];
    const secondKey = fetchMock.mock.calls[1][1].headers['Idempotency-Key'];
    expect(secondKey).toBe(firstKey);

    await act(async () => {
      await result.current.generateRecommendations({ ...formValues, pax: 4 });
    });
    const thirdKey = fetchMock.mock.calls[2][1].headers['Idempotency-Key'];
    expect(thirdKey).not.toBe(firstKey);
  });
});
