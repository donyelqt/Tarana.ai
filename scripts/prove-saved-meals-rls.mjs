#!/usr/bin/env node
/**
 * saved_meals RLS verification probe — run AFTER applying
 * supabase/migrations/20260919000000_saved_meals_rls_remediation.sql
 * (and AFTER the web code migration + mobile SUPABASE_JWT_SECRET fix are
 * live; see the migration header for deploy order).
 *
 * Zero-dep Node, env-only secrets. Read-only assertions:
 *   1. anon SELECT on saved_meals -> 0 rows (was 43 before remediation).
 *   2. anon INSERT / UPDATE / DELETE -> 403/0 affected (permission denied).
 *   3. service-role SELECT -> 2xx (server path intact).
 *
 * Run:
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/prove-saved-meals-rls.mjs
 *
 * Exit 0 = PASS (anon surface closed, service path intact). Exit 1 = FAIL.
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

const h = (key) => ({ apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" });

const main = async () => {
  // 1) anon SELECT: must be 0 rows (RLS hides every row)
  const sel = await fetch(`${url}/rest/v1/saved_meals?select=id&limit=1000`, { headers: h(anon) });
  const rows = await sel.json().catch(() => null);
  check("anon SELECT saved_meals isolated", sel.ok && Array.isArray(rows) && rows.length === 0,
    `HTTP ${sel.status}, ${Array.isArray(rows) ? rows.length : "?"} rows (want 0)`);

  // 2) anon INSERT: must be denied (no WITH CHECK policy for anon)
  const ins = await fetch(`${url}/rest/v1/saved_meals`, {
    method: "POST",
    headers: h(anon),
    body: JSON.stringify({ user_id: "00000000-0000-0000-0000-000000000001", cafe_name: "rls-probe", meal_type: "probe", price: 1 }),
  });
  check("anon INSERT saved_meals denied", !ins.ok, `HTTP ${ins.status} (want 4xx)`);

  // 3) anon UPDATE: must be denied
  const upd = await fetch(`${url}/rest/v1/saved_meals?id=eq.00000000-0000-0000-0000-000000000000`, {
    method: "PATCH",
    headers: h(anon),
    body: JSON.stringify({ cafe_name: "rls-probe" }),
  });
  check("anon UPDATE saved_meals denied", !upd.ok, `HTTP ${upd.status} (want 4xx)`);

  // 4) anon DELETE: must affect 0 rows / be denied
  const del = await fetch(`${url}/rest/v1/saved_meals?id=eq.00000000-0000-0000-0000-000000000000`, {
    method: "DELETE",
    headers: h(anon),
  });
  const delBody = await del.text().catch(() => "");
  const delDenied = !del.ok || delBody.trim() === "[]" || delBody.trim() === "";
  check("anon DELETE saved_meals no-effect", delDenied, `HTTP ${del.status} body=${delBody.slice(0, 60)}`);

  // 5) service-role SELECT: must still work (server path intact)
  const svc = await fetch(`${url}/rest/v1/saved_meals?select=id&limit=1`, { headers: h(service) });
  check("service-role saved_meals works", svc.ok, `HTTP ${svc.status} (want 2xx)`);

  console.log(failures === 0 ? "\nRESULT: PASS — anon surface closed, service path intact" : `\nRESULT: FAIL — ${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
};

main();