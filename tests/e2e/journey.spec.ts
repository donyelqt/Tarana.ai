import { expect, test } from '@playwright/test';

const VALID_PASSWORD_SAMPLE = 'T@r@na!9KmQ2vX7pL';

test.describe('journey boundaries', () => {
  test('register rejects missing required fields with 400', async ({ request }) => {
    const response = await request.post('/api/auth/register', { data: {} });
    expect(response.status()).toBe(400);
  });

  test('register rejects when ToS consent is not agreed with 400', async ({ request }) => {
    const response = await request.post('/api/auth/register', {
      data: {
        fullName: 'Journey Test',
        email: 'journey@example.com',
        password: VALID_PASSWORD_SAMPLE,
        agreed: false,
      },
    });
    expect(response.status()).toBe(400);
  });

  test('register rejects invalid email format with 400', async ({ request }) => {
    const response = await request.post('/api/auth/register', {
      data: {
        fullName: 'Journey Test',
        email: 'not-an-email',
        password: VALID_PASSWORD_SAMPLE,
        agreed: true,
      },
    });
    expect(response.status()).toBe(400);
  });

  test('register rejects weak password with 400', async ({ request }) => {
    const response = await request.post('/api/auth/register', {
      data: {
        fullName: 'Journey Test',
        email: 'journey@example.com',
        password: '123',
        agreed: true,
      },
    });
    expect(response.status()).toBe(400);
  });

  test('generator rejects unauthenticated requests with 401', async ({ request }) => {
    const response = await request.post('/api/gemini/itinerary-generator', {
      data: {
        prompt: 'Create a personalized 2-day itinerary for Baguio City, Philippines',
        duration: 2,
        interests: ['Nature'],
      },
    });
    expect(response.status()).toBe(401);
  });

  test('saved-itineraries rejects unauthenticated requests with 401', async ({ request }) => {
    const response = await request.post('/api/saved-itineraries', {
      data: {
        title: 'Journey Test Trip',
        date: '2026-10-01',
        budget: 'P5000',
        formData: {
          budget: 'P5000',
          pax: '2',
          duration: '2 Days',
          dates: { start: '2026-10-01', end: '2026-10-02' },
          selectedInterests: ['Nature'],
        },
        itineraryData: {
          title: 'Journey Test Trip',
          subtitle: 'Two days',
          items: [{ period: 'Day 1', activities: [] }],
        },
      },
    });
    expect(response.status()).toBe(401);
  });

  test('saved-itineraries rejects malformed body with 401, not 400 (auth precedes schema)', async ({
    request,
  }) => {
    const response = await request.post('/api/saved-itineraries', {
      data: { nonsense: true },
    });
    expect(response.status()).toBe(401);
  });
});
