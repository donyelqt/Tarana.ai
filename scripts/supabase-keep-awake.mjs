#!/usr/bin/env node

import { config as loadEnv } from 'dotenv';

const QUIET = process.env.KEEP_AWAKE_NO_DOTENV === 'yes';

if (!QUIET) {
  loadEnv();
  loadEnv({ path: '.env.local', override: true });
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(2);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  Accept: 'application/json',
};

const target = url.includes('/rest/v1') ? url : `${url.replace(/\/$/, '')}/rest/v1/`;

let response;
try {
  response = await fetch(target, { headers });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Supabase keep-awake probe failed: ${message}`);
  process.exit(1);
}

if (!response.ok) {
  console.error(`Supabase keep-awake probe failed: HTTP ${response.status}`);
  process.exit(1);
}

console.log(`Supabase keep-awake probe ok: HTTP ${response.status}`);