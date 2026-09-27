#!/usr/bin/env node
/**
 * Staging bench guard.
 *
 * The old script hardcoded BASE_URL=https://tarana-ai.vercel.app. That is the
 * production deployment, and the bench bypass (x-bench-token HMAC) is
 * fail-closed there by design (`src/lib/auth/benchToken.ts` refuses when
 * NODE_ENV/VERCEL_ENV is production), so the command could only ever 401 —
 * and a leaked BENCH_HMAC_SECRET pointed at a misconfigured deployment would
 * have produced free billed generations.
 *
 * Now the target must be supplied explicitly and must not be the production
 * host. Refuses to run otherwise.
 */
import { spawnSync } from 'node:child_process';

const PROD_HOSTS = new Set(['tarana-ai.vercel.app', 'tarana.ai', 'www.tarana.ai']);

const baseUrl = process.env.BENCH_BASE_URL?.trim();
if (!baseUrl) {
  console.error('[bench:staging] Set BENCH_BASE_URL to an explicit non-production target.');
  console.error('[bench:staging] Example: BENCH_BASE_URL=https://tarana-ai-git-staging.vercel.app pnpm run bench:staging');
  process.exit(1);
}

let host;
try {
  host = new URL(baseUrl).hostname;
} catch {
  console.error(`[bench:staging] BENCH_BASE_URL is not a valid URL: ${baseUrl}`);
  process.exit(1);
}

if (PROD_HOSTS.has(host)) {
  console.error(`[bench:staging] Refusing to bench production host "${host}".`);
  console.error('[bench:staging] The bench bypass is disabled in production; use a preview/staging URL.');
  process.exit(1);
}

const result = spawnSync(
  'k6',
  ['run', `--env`, `BASE_URL=${baseUrl}`, 'bench/k6-itinerary.js'],
  { stdio: 'inherit', shell: process.platform === 'win32' }
);

process.exit(result.status ?? 1);
