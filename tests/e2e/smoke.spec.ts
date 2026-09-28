import { expect, test } from '@playwright/test';

test('landing renders the public hero journey', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /plan your perfect/i })).toBeVisible();
  await expect(page.locator('#hero').getByRole('link', { name: /plan my baguio trip/i })).toBeVisible();
});

test('signin renders without submitting credentials', async ({ page }) => {
  await page.goto('/auth/signin');
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/^password/i)).toBeVisible();
  await expect(page.locator('form').getByRole('button', { name: /^login$/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /register/i })).toBeVisible();
});

test('dashboard rejects unauthenticated access', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForURL(/\/auth\/signin/, { timeout: 10_000 });
  expect(page.url()).toContain('/auth/signin');
});

test('health endpoint answers without depending on upstream state', async ({ request }) => {
  const response = await request.get('/api/health');
  // Both statuses mean "the endpoint answered", which is what this test is
  // about. 200 is every dependency healthy; 503 is the deliberate degraded
  // signal so a load balancer fails over instead of pinning traffic to a sick
  // instance (see the contract note in src/app/api/health/route.ts, pinned by
  // src/app/api/health/__tests__/route.test.ts). The CI stub env points
  // Supabase at http://localhost:54321 with no instance, so 503 is the
  // expected healthy-run outcome there. The sibling health smoke in ci.yml
  // already accepts `200 || 503`; this assertion had drifted from that.
  expect([200, 503]).toContain(response.status());
  const body = (await response.json()) as { status?: unknown; checks?: unknown };
  expect(body.status).toMatch(/^(ok|degraded)$/);
  expect(body.checks).toBeDefined();
});
