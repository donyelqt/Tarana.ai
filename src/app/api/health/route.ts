import { NextResponse } from 'next/server';
import { logger } from '@/lib/observability/logger';
import { timedHttp } from '@/lib/observability/httpMetrics';

/**
 * Dedicated health endpoint.
 *
 * Per §3.2 invariant 8: checks dependencies CHEAPLY. No Gemini generation —
 * the itinerary-generator's `action=health` variant calls the model, which
 * means a monitoring probe costs money and can take up to 60s. This endpoint
 * does connection-level checks only, each with its own timeout, so a single
 * probe answers in well under a second even when a dependency is down.
 *
 * Check status semantics:
 * - `ok`   — the dependency answered
 * - `fail` — the dependency timed out or errored (typed, logged, but the
 *            endpoint still returns 200: an unhealthy dependency is a state,
 *            not a request failure. Load balancers gate on 5xx; alerting
 *            gates on the `checks` payload.)
 */

export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 3000;

type CheckStatus = 'ok' | 'fail';
interface HealthChecks {
  supabase: CheckStatus;
  geminiKey: CheckStatus;
  tomtom: CheckStatus;
}

async function withTimeout<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    logger.error(`[health] ${label} check failed`, { error }, undefined);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function checkSupabase(): Promise<CheckStatus> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return 'fail';
  const result = await withTimeout('supabase', async () => {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' },
    });
    return res.status < 500;
  });
  return result === true ? 'ok' : 'fail';
}

function checkGeminiKey(): CheckStatus {
  // Key-presence only: validity is proven by any real generation. A probe
  // that calls the model costs money per request.
  return process.env.GOOGLE_GEMINI_API_KEY ? 'ok' : 'fail';
}

async function checkTomTom(): Promise<CheckStatus> {
  const key = process.env.TOMTOM_API_KEY;
  if (!key) return 'fail';
  const result = await withTimeout('tomtom', async () => {
    const res = await fetch(`https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=${key}&point=47.4979,19.0402`);
    return res.status < 500;
  });
  return result === true ? 'ok' : 'fail';
}

export async function GET(): Promise<NextResponse> {
  return timedHttp('/api/health', 'GET', async () => {
    const [supabase, tomtom] = await Promise.all([checkSupabase(), checkTomTom()]);
    const checks: HealthChecks = {
      supabase,
      geminiKey: checkGeminiKey(),
      tomtom,
    };
    const allOk = Object.values(checks).every((s) => s === 'ok');
    return NextResponse.json(
      { status: allOk ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() },
      { status: 200 }
    );
  }, (res) => res.status);
}