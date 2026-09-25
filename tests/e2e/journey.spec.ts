import { expect, test } from '@playwright/test';

// Serial: the auth rate limiter is one in-memory bucket shared by every
// localhost request in this run, so register POSTs must never run in parallel.
// Deliberately-valid sample: passes validatePasswordStrength + sanitizeUserRegistration
// so tests 2-3 isolate the field under test (agreed/email), never the password.
// If the register route ever accepts it (live DB), these tests flip — that is intended.
const VALID_PASSWORD_SAMPLE = 'T@r@na!9KmQ2vX7pL';

// Full-journey boundaries the CI stub env can prove deterministically.
// Every happy-path leg (real signup, session login, Gemini generation,
// credit charge, save, dashboard read) terminates in a non-deterministic 500
// here (stub Supabase at localhost:54321, stub Gemini key, no ledger), so it
// is explicitly NOT attempted. These 7 tests pin the journey wiring that IS
// deterministic: register validation 400s fire before any DB touch, and the
// withAuth gate fires before schema validation on both billable routes.
// Dashboard redirect coverage stays in smoke.spec.ts; it is not duplicated.
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
