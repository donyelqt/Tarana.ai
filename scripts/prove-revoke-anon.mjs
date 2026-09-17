#!/usr/bin/env node
/**
 * REVOKE verification probe — run AFTER applying
 * supabase/migrations/20260918000000_revoke_anon_from_credit_rpcs.sql.
 *
 * Zero-dep Node, env-only secrets. Read-only assertions:
 *   1. anon EXECUTE on refund_credits / consume_credits / get_available_credits
 *      → HTTP 403 (PostgREST permission denied). Pre-migration this was 200/400.
 *   2. anon EXECUTE on match_activity_embeddings → 403 as well (explicit grant
 *      revoked; authenticated grant retained).
 *   3. service-role EXECUTE on get_available_credits (read-only helper,
 *      unknown user → 0/NULL result, no money effect) → must SUCCEED
 *      (2xx), proving the REVOKE did not break the server path.
 *
 * Run:
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/prove-revoke-anon.mjs
 *
 * Exit 0 = PASS (revoke live, service path intact). Exit 1 = FAIL.
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

const rpc = (key, fn, body) =>
  fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const NO_USER = "00000000-0000-0000-0000-000000000000";

const main = async () => {
  // 1) anon must be denied on all four (403 PostgREST permission denied)
  const anonChecks = [
    ["refund_credits", { p_user_id: NO_USER, p_amount: 1, p_service: "probe", p_idempotency_key: `revoke-probe-${Date.now()}` }],
    ["consume_credits", { p_user_id: NO_USER, p_amount: 1, p_service: "probe" }],
    ["get_available_credits", { p_user_id: NO_USER }],
  ];
  for (const [fn, body] of anonChecks) {
    const r = await rpc(anon, fn, body);
    // PostgREST surfaces the Postgres permission error as 401 (code 42501,
    // "permission denied for function ...") — 403 also acceptable.
    const denied = r.status === 401 || r.status === 403;
    check(`anon ${fn} denied`, denied, `HTTP ${r.status} (want 401/403)`);
  }

  // 2) anon must be denied on the embeddings RPC too (valid 768-dim vector)
  const vec = Array(768).fill(0.1);
  const rVec = await rpc(anon, "match_activity_embeddings", { query_embedding: vec, match_count: 5 });
  const vecDenied = rVec.status === 401 || rVec.status === 403;
  check("anon match_activity_embeddings denied", vecDenied, `HTTP ${rVec.status} (want 401/403)`);

  // 3) service role must still execute (read-only helper, unknown user)
  const rSvc = await rpc(service, "get_available_credits", { p_user_id: NO_USER });
  check("service get_available_credits works", rSvc.ok, `HTTP ${rSvc.status} (want 2xx)`);

  console.log(failures === 0 ? "\nRESULT: PASS — revoke live, service path intact" : `\nRESULT: FAIL — ${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
};

main();
