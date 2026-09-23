#!/usr/bin/env node
/**
 * RLS deny-all verification probe — run AFTER applying
 * supabase/migrations/20260924000000_rls_deny_all_places_embeddings_users.sql.
 *
 * Zero-dep Node, env-only secrets. Read-only assertions:
 *   1. anon SELECT on places / itinerary_embeddings / users
 *      → HTTP 401/403 (PostgREST permission denied under RLS deny-all).
 *      Pre-migration these returned 200 with rows (or 200 with [] on
 *      tables the Data API exposes but RLS had no policies for).
 *   2. service-role SELECT on places (limit 1) → must SUCCEED (2xx),
 *      proving the RLS enable did not break the server path (supabaseAdmin
 *      bypasses RLS).
 *
 * Run:
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/prove-rls-deny-all.mjs
 *
 * Exit 0 = PASS (deny-all live, service path intact). Exit 1 = FAIL.
 */
const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const anon = process.env.SUPABASE_ANON_KEY || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!url || !anon || !service) {
  console.error("FAIL: set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
  if (!ok) failures++;
};

const selectRows = (key, table, query = "") =>
  fetch(`${url}/rest/v1/${table}${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });

const main = async () => {
  // 1) anon must be denied on all three (RLS deny-all)
  for (const table of ["places", "itinerary_embeddings", "users"]) {
    const r = await selectRows(anon, table, "?select=*&limit=1");
    // Two acceptable denial forms under RLS deny-all:
    //   - 401/403: table not exposed via the Data API, or permission denied.
    //   - 200 with an EMPTY rowset ([]): table exposed, but RLS filters
    //     every row. This is what Supabase actually returns for these
    //     tables (verified live 2026-09-24: places returned rows pre-migration,
    //     [] after). A 200 WITH rows is the vulnerability — that must fail.
    let bodyEmpty = false;
    if (r.ok) {
      const body = await r.json();
      bodyEmpty = Array.isArray(body) && body.length === 0;
    }
    const denied = r.status === 401 || r.status === 403 || (r.ok && bodyEmpty);
    check(`anon ${table} denied`, denied, `HTTP ${r.status}${r.ok ? (bodyEmpty ? " [] (RLS-filtered)" : " with rows") : ""} (want 401/403 or 200 [])`);
  }

  // 2) service role must still read (supabaseAdmin bypasses RLS)
  const sr = await selectRows(service, "places", "?select=id&limit=1");
  const srOk = sr.ok;
  check("service places select succeeds", srOk, `HTTP ${sr.status} (want 2xx)`);

  if (failures > 0) {
    console.error("FAIL: RLS deny-all not fully verified");
    process.exit(1);
  }
  console.log("SMOKE OK: RLS deny-all live, service path intact");
  process.exit(0);
};

main().catch((e) => {
  console.error("FAIL: probe crashed:", e);
  process.exit(1);
});
