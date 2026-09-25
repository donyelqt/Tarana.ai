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
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { status?: unknown; checks?: unknown };
  expect(body.status).toBeDefined();
  expect(body.checks).toBeDefined();
});
