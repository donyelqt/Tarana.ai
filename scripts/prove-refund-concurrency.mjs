#!/usr/bin/env node
/**
 * Staging concurrency proof for the refund_credits idempotency contract
 * (plan Task 1 verify gate). Fires real parallel RPC storms and asserts
 * exactly-once behavior with counter math. Cleans up after itself.
 *
 * Usage (staging ONLY — never prod):
 *   STAGING_OK=yes SUPABASE_URL=https://xyzcompany.supabase.co \
 *     SUPABASE_SERVICE_ROLE_KEY=<staging service_role key> \
 *     PROBE_USER_ID=<throwaway test user uuid> \
 *     node scripts/prove-refund-concurrency.mjs
 *
 * Exit 0 = all assertions pass. Non-zero = FAIL, see which check broke.
 * The script restores the user's counter and deletes its probe ledger
 * rows even on failure paths it controls (a mid-run crash may leave
 * probe rows behind; they are namespaced `prove:<runid>:` — delete with:
 *   DELETE FROM credit_transactions WHERE description LIKE 'prove:%';
 */
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PROBE_USER_ID, STAGING_OK } = process.env;

let failures = 0;
const check = (name, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!cond) failures++;
};

if (STAGING_OK !== "yes") {
  console.error("Refusing: set STAGING_OK=yes. Staging only — never prod.");
  process.exit(2);
}
for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PROBE_USER_ID })) {
  if (!v) {
    console.error(`Missing env: ${k}`);
    process.exit(2);
  }
}

const URL = SUPABASE_URL.replace(/\/$/, "");
const KEY = SUPABASE_SERVICE_ROLE_KEY;
const UID = PROBE_USER_ID;
const RUN = `prove:${Date.now()}:`;
const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

const rpc = async (fn, body) => {
  const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: H,
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${fn} HTTP ${r.status}: ${await r.text()}`);
  return r.json();
};

const getUsed = async () => {
  const r = await fetch(`${URL}/rest/v1/user_profiles?id=eq.${UID}&select=credits_used_today`, { headers: H });
  if (!r.ok) throw new Error(`profile read HTTP ${r.status}: ${await r.text()}`);
  const rows = await r.json();
  if (!rows.length) throw new Error(`probe user ${UID} not found`);
  return rows[0].credits_used_today;
};

const cleanup = async (origUsed) => {
  // Restore counter to pre-run value, then delete probe ledger rows.
  let guard = 0;
  while ((await getUsed()) < origUsed && guard++ < 30) {
    await rpc("consume_credits", {
      p_user_id: UID,
      p_amount: 1,
      p_service: "tarana_gala",
      p_description: `${RUN}restore`,
    });
  }
  // NOTE: over-applied refunds (used BELOW orig) cannot be restored by
  // consuming more — report it instead of hiding it.
  await fetch(
    `${URL}/rest/v1/credit_transactions?or=(description.like.${encodeURIComponent(RUN)}*,idempotency_key.like.${encodeURIComponent(RUN)}*)`,
    { method: "DELETE", headers: H }
  );
};

const main = async () => {
  console.log(`Run id: ${RUN}  user: ${UID}`);

  // 0. Baseline.
  const orig = await getUsed();
  console.log(`Baseline credits_used_today = ${orig}`);

  // 1. Setup headroom so movement is observable (floor at 0 masks effects).
  let guard = 0;
  while ((await getUsed()) < 5 && guard++ < 12) {
    const ok = await rpc("consume_credits", {
      p_user_id: UID,
      p_amount: 1,
      p_service: "tarana_gala",
      p_description: `${RUN}setup`,
    });
    if (ok !== true) break; // daily cap reached — adapt storm sizes below
  }
  const U = await getUsed();
  console.log(`Headroom level credits_used_today = ${U}`);

  // 2. Same-key storm: 10 parallel refunds, one key → exactly one TRUE.
  const keySame = `${RUN}same`;
  const sameResults = await Promise.all(
    Array.from({ length: 10 }, () =>
      rpc("refund_credits", {
        p_user_id: UID,
        p_amount: 1,
        p_service: "tarana_gala",
        p_description: `${RUN}same`,
        p_idempotency_key: keySame,
      })
    )
  );
  const sameTrue = sameResults.filter((v) => v === true).length;
  check("same-key storm applies exactly once", sameTrue === 1, `${sameTrue}/10 TRUE`);

  // 3. Distinct-key storm: K parallel refunds, K keys → all TRUE, counter
  //    moves by exactly K (sized to current level so the zero floor can't
  //    mask a lost write).
  const U1 = await getUsed();
  const K = Math.max(U1, 0);
  let distinctTrue = 0;
  if (K > 0) {
    const distinctResults = await Promise.all(
      Array.from({ length: K }, (_, i) =>
        rpc("refund_credits", {
          p_user_id: UID,
          p_amount: 1,
          p_service: "tarana_gala",
          p_description: `${RUN}distinct`,
          p_idempotency_key: `${RUN}distinct:${i}`,
        })
      )
    );
    distinctTrue = distinctResults.filter((v) => v === true).length;
  }
  check("distinct-key storm applies every time", distinctTrue === K, `${distinctTrue}/${K} TRUE`);

  // 4. Counter math: same storm moved -1, distinct storm moved -K.
  const U2 = await getUsed();
  check("counter moved exactly -(1+K)", U2 === Math.max(0, U - 1 - K), `${U} -> ${U2}, expected ${Math.max(0, U - 1 - K)}`);

  // 5. Cleanup + verify restoration.
  await cleanup(orig);
  const U3 = await getUsed();
  check("counter restored to baseline", U3 === orig, `${U3} vs ${orig}`);
  const leftover = await (
    await fetch(
      `${URL}/rest/v1/credit_transactions?or=(description.like.${encodeURIComponent(RUN)}*,idempotency_key.like.${encodeURIComponent(RUN)}*)&select=id`,
      { headers: H }
    )
  ).json();
  check("no probe rows left", leftover.length === 0, `${leftover.length} remaining`);

  if (failures > 0) {
    console.log(`\nRESULT: FAIL (${failures} check(s) broken)`);
    process.exit(1);
  }
  console.log("\nRESULT: PASS — idempotent refunds proven on this database.");
};

main().catch(async (e) => {
  console.error("SCRIPT ERROR (state may need manual review):", e?.message || e);
  process.exit(2);
});
