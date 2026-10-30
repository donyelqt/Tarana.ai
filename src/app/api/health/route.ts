import { NextResponse } from 'next/server';
import { logger } from '@/lib/observability/logger';
import { timedHttp } from '@/lib/observability/httpMetrics';


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
      { status: allOk ? 200 : 503, headers: { 'Cache-Control': 'public, max-age=10, stale-while-revalidate=30' } }
    );
  }, (res) => res.status);
}