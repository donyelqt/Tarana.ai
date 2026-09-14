# Tarana Gala — Money Correctness + Auth Hardening Plan
**Status:** PROPOSED 2026-09-14 | **Branch:** `main` | **Mode:** Build (sliced, independently shippable)
**Scope:** Credit charge/refund correctness, auth fail-closed posture, single-route consolidation, dead-code/cost cleanup. No UI, pricing, or prompt-behavior changes except where flagged.
**Basis:** Line-by-line verification of the 62/100 senior/staff assessment against `main` on 2026-09-14. Verdict: ~70% agreed; 3 claims corrected (they change the plan); 4 new money-relevant bugs found that the assessment missed. Nothing in this plan is implemented yet.

---

## 1. ASSUMPTIONS I'M MAKING

1. **Pricing intent is undecided (see §5 Q1).** Whether a cache hit costs a credit changes Task 4's direction. Default assumption until ruled: **credits = per served request** (matches the documented intent in `route/optimized/route.ts:125-134`).
2. **Deployment is Vercel serverless** (evidence: `bench:staging` targets `tarana-ai.vercel.app`, `maxDuration` comment cites "Vercel Pro plan" in `saved-itineraries/[id]/refresh/route.ts:22`). If self-hosted single-instance, downgrade all Redis items to P2.
3. **Default traffic path is the legacy single-shot POST** (`USE_MULTI_AGENT` defaults false, `route.ts:65,222`). Multi-agent fixes matter only behind the flag.
4. **Bench flow must keep working against local dev** (docs: `BENCH_BYPASS_AUTH=true` in `.env.local` + `bench/k6-itinerary.js` → main route only).

→ Correct me now or implementation proceeds on these.

---

## 2. VERDICT LEDGER — what the assessment got right and wrong

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1a | Double refund via `__galaRefunded` | **DISPUTED** | `route.ts:123` *checks* the flag and skips — the guard works. Real double-refund vectors are §3 items, not this line |
| 1b | Cache hit charges before lookup | **CONFIRMED behavior, UNPROVEN bug** | Charge `route.ts:297-304`, cache `route.ts:392`. But optimized route documents charging-on-hit as anti-loophole intent (`route/optimized/route.ts:125-134`). Blocked on pricing ruling (§5 Q1) |
| 1c | Refund is SELECT-then-UPDATE | **CONFIRMED** | `CreditService.ts:267-284`. Lost-update under concurrency; floor-at-zero enables repeated over-refund; no `idempotency_key` column exists (`20250129000000:55-68`) |
| 1-consume | (Implied) consume is racy | **ALREADY FIXED — drop it** | `20260814000000_atomic_credit_consumption_and_refund.sql:13-53` made consume a guarded single UPDATE. Only the refund half is outstanding |
| 2a | `x-bench-bypass` skips session | **CONFIRMED, lower severity** | `conciergeAgent.ts:36` (+ missed duplicate `withAuth.ts:32`). Gated on `NODE_ENV !== "production"` → inert on Vercel preview/prod; dev-only fail-open + env/header echo in logs (`:34`) |
| 2b | anon grant on embeddings FN | **CONFIRMED, safe to revoke** | Grant `20240730000000:40`; only server-side `supabaseAdmin` callers (`intelligentSearch.ts:526`, `vectorSearch.ts:86`). Also cap `match_count` (`LEAST(...,50)`) — currently unbounded scrape/compute |
| 2c | No rate limiting on route | **MISLEADING** | Literally true (no direct call); effectively false — root `middleware.ts:9-20` wires `heavyApiRateLimit` (10/min, 10-min block) over `/api/gemini/*`. Real gap: `InMemoryRateLimiter` (`rateLimiter.ts:135`) is per-instance — dead weight on serverless. Fix = swap store (Upstash-style HTTP, Edge-compatible), not add calls |
| 2d | Fail-closed 503 on balance error | **DECLINED — already closed** | `conciergeAgent.ts:109-116` returns undefined, but free generation is impossible: the atomic consume RPC is the real gate (`InsufficientCreditsError` → 402). A 503 adds zero protection |
| 3 | In-memory Map breaks cross-instance | **OVERSTATED impact, RIGHT fix** | Map confirmed (`sessionStore.ts:77`), but sessions are request-scoped — created, mutated, `clearSession`d in one invocation; no session ID crosses requests. The real defect: `failSession`/`appendError` **throw** on missing session (`:105-107`, `:124-126`), and coordinator calls `failSession` *before* the refund (`pipelineCoordinator.ts:47-48`) — a throw there silently skips the refund. 3-line no-op fix |
| 4 | Three routes + legacy, delete 2 | **CONFIRMED with 2 corrections** | All three diverge (auth flavor, zod vs none, TTL 30m/5m/3m, retries, zero-refund only in main). But (a) `route_legacy.ts` exists only for **food-recommendations** — wrong cite; (b) only `route.ts` has callers (`itineraryService.ts:60`, `bench/k6-itinerary.js`). Check access logs for external callers before deleting |
| 4b | Cache key missing cityId | **CONFIRMED, narrow** | `generateCacheKey` (`intelligentSearch.ts:670-686`); `SearchContext` (`:49-58`) carries no city. Needs same-instance + otherwise-identical queries to bite |
| 5 | 4 caches, double LLM billing | **COUNT OFF, billing OVERSTATED** | 3 mechanisms, not 4 (`smartCacheManager` IS the "optimized cache"); singleton is shared in-process, unshared by cold starts. Race aborts the loser (`guaranteedJsonEngine.ts:190-210`) — cost ≈ 1 + input-side ε, not 2×. Sequential fallback fights the p50<3500 SLO; quantify input-token cost first |
| 5b | TemporalOptimizer dead, docs lie | **CONFIRMED, severity ~zero** | Zero instantiations repo-wide; temporal hardcoded 0.5 (`intelligentSearch.ts:611`) at 0.15 weight — a constant cannot change rankings. Docs cleanup, no behavior change |
| 6 | God-files, weather ×3, 9-arg prompt | **CONFIRMED +1** | Sizes exact (837/703/791). `getWeatherType` is actually **×4** (add `retrievalStrategistAgent.ts:89`, `contextBuilder.ts:46`). `buildDetailedPrompt` is 9 params (`contextBuilder.ts:31-41`) |
| 7 | Observability/knip/FIX_*.sql | **CONFIRMED** | Emoji logs incl. money paths, no knip, 3 root `FIX_*.sql` |

## 3. NEW FINDINGS the assessment missed (all verified)

1. **Prompt city-scoping broken for every non-Baguio request (correctness, money-adjacent).** `route.ts:192` and `route/route.ts:90` call `buildDetailedPrompt` with 7 args → `cityId` defaults to `"baguio"`, while retrieval is correctly city-scoped (`route.ts:190`). A Manila request retrieves Manila activities but generates against a *"strictly Baguio"* prompt (`contextBuilder.ts:59-61`). Fix: pass `cityId` through (1 line × 2 call sites) + regression test. Stronger than the speculative cache-key sibling.
2. **Serverless timeout = charged with no possible refund (money P0).** No `maxDuration` on any generator route (only `saved-itineraries refresh` has one), yet generations run 7.5–60s per bench docs. A Vercel kill skips every refund block by construction. Fix: set `maxDuration` + bound total work under it (fail fast; refund-after-death is impossible).
3. **Coordinator test seam is split-brain.** Charge uses `deps.creditService ?? CreditService`, refund hardcodes `CreditService` (`pipelineCoordinator.ts:26` vs `:50`). Mocks in `pipelineCoordinator.test.ts` cannot observe the refund path. One-line consistency fix.
4. **`route/route.ts:89` passes possibly-undefined `interests`** (no `?? []` guard the siblings have) on a route with **zero zod validation** — crash vector on the least-guarded duplicate. Dies with the route consolidation, or guard first.

## 4. TASK LIST

### Phase 0 — Rulings (blocking, human, no code)
- [ ] Task 0: Rule on §5 Q1 (pricing) and Q2 (plan tier for `maxDuration`). Everything in Phase 2 keys off Q1.
- [ ] Task 0b: Grep production access logs for `GET|POST .../itinerary-generator/route...` callers outside `itineraryService.ts` + k6. Zero external hits required before any deletion.

### Phase 1 — Money correctness (P0, sequential: migration first)
- [x] Task 1 (implement — migration file + app code, NOT applied to any DB).
  `supabase/migrations/20260914000000_refund_credits_rpc.sql`: atomic `refund_credits` RPC (single-statement guarded decrement, composite `UNIQUE(user_id, idempotency_key)`, NULL/empty key + non-positive/absurd amount rejected loud, `search_path` pinned) + `LEAST(match_count,50)` clamp on the embeddings FN. `CreditService.refundCredits` rewritten on the RPC (boolean, never throws, warn-on-false with key). Adversarial review reconciled: composite scope, key validation, search_path, per-attempt-key invariant (body fingerprints rejected — identical requests are distinct charges; refund sites are control-flow exclusive per attempt); charge_id FK + reason codes declined with reasons.
- [x] Task 2 (implement): all 6 refund call sites pass stable per-attempt keys (`refund:<session.id>` shared coordinator↔route, `refund:zero/fail:<attemptUUID>` per request); coordinator seam unified on injected dep with concrete fallback; no-op refund callers log warn with key.
- [ ] Task 1/2 (verify — STAGING GATE, not 100% yet): migration NOT applied anywhere (no local Postgres, Docker daemon down, no approval). Requires: `supabase db push` on staging → 10× concurrent same-user failures move balance exactly once per delivered failure → duplicate-key replay returns FALSE with no money effect → then prod. Unit contract (RPC call-shape, key propagation, fallback) green: 11/11 focused tests, `tsc` clean.
  **Acceptance:** 10× concurrent same-user failing requests move balance exactly once per delivered failure; double-invoke same idempotency key → single effect. **Verify:** `pnpm jest` new concurrency suite + `pnpm lint`. **Files:** `supabase/migrations/`, `src/lib/referral-system/CreditService.ts`. **Scope:** M.
- [ ] Task 2: Swap all 4 refund call sites (`pipelineCoordinator.ts:50`, `route.ts:125`, `route.ts:403`, `route.ts:427`, `route/route.ts:187`, `route/optimized/route.ts:202`) to the RPC with `session.id` (coordinator) / `userId+requestHash` as idempotency key; unify coordinator charge/refund seam on the injected dep.
  **Acceptance:** existing suites green; mock observes refund path. **Verify:** `pnpm jest src/agents src/lib/referral-system`. **Scope:** M. **Depends on:** Task 1.
- [x] Task 3: `failSession`/`appendError` no-op-if-missing (`sessionStore.ts:103-135`); pass `cityId` into `buildDetailedPrompt` at both call sites; guard `interests ?? []` in `route/route.ts:89`. **STATUS: DONE + VERIFIED 100% (shipped, PR to follow).**
  - [x] Coordinator catch isolates bookkeeping from refund (try/catch, no signature changes) + regression test proven RED→GREEN (`pipelineCoordinator.test.ts`: fabricated missing session still refunds + preserves original error). Adversarial review reconciled (12 findings → isolated-refund design; synthetic-session alternative rejected).
  - [x] `cityId` forwarded at all 3 prompt call sites (`route.ts:192,369`, `route/route.ts:90` with allowlist guard — that route has no zod schema); contract tests added (`contextBuilderCityScope.test.ts`).
  - [ ] `interests ?? []` guard in `route/route.ts:89` — DROPPED with reason: `findAndScoreActivities` guards non-array interests at 6 sites (`activitySearch.ts:71,96,160,249,373,424`); churn on a file slated for Phase-3 deletion is not justified.
  **Acceptance:** missing-session error path still refunds; Manila prompt contains "Manila" (new regression test asserts city token in built prompt). **Scope:** S. **Depends on:** none (parallelizable with Task 1).
  **Verified 2026-09-14:** focused suites 15/15 green (`pipelineCoordinator` 3/3 incl. new refund-masking test, `contextBuilderCityScope` 2/2, `zeroResultRefund` 10/10), `tsc --noEmit` clean, RED proven pre-fix at `sessionStore.ts:125`, GREEN post-fix. Code-only slice — no prod data touched.
- [ ] Task 4: `maxDuration` on generator routes + bounded total work (retries × timeout < limit); document the timeout-charge policy.
  **Acceptance:** forced-timeout probe returns 504 with exactly one charge and one logged (unrefunded-by-design) transaction. **Scope:** S. **Depends on:** Task 0 Q2.

### Checkpoint: Money
- [ ] `pnpm lint` + `pnpm jest` green; concurrency + idempotency suites pass; k6 smoke clean; human review before auth phase.

### Phase 2 — Auth hardening (P0)
- [ ] Task 5: Delete both bypass branches (`conciergeAgent.ts:36,66`, `withAuth.ts:32`); HMAC bench token (`BENCH_HMAC_SECRET`, timing-safe compare) preserving the documented k6-on-dev flow; drop the header-echo log line (`conciergeAgent.ts:34`).
  **Acceptance:** k6 against dev passes with token, 401s without; `NODE_ENV=production` behavior unchanged. **Scope:** M.
- [ ] Task 6: `REVOKE EXECUTE ... FROM anon` on `match_activity_embeddings`; confirm no anon-key client callers (verified 2026-09-14: none in `src/`, mobile clean).
  **Acceptance:** anon RPC call → 401/permission denied; authed generation unaffected. **Scope:** S.

### Checkpoint: Auth
- [ ] Auth suites + bench green; human review before consolidation.

### Phase 3 — Single route (P1, blocked on Task 0/0b)
- [ ] Task 7: One POST (single zod schema incl. `cityId`, single TTL, single zero-refund policy per Q1 ruling, single refund path via Task 1 RPC); delete `route/route.ts` + `route/optimized/route.ts` (NOT food `route_legacy.ts` — different feature); add `knip` to CI.
  **Acceptance:** `itineraryService.ts` + k6 untouched and green; deleted paths return 404 by absence. **Scope:** L (split delete vs. policy if needed).

### Checkpoint: Routes
- [ ] Full jest + k6 vs staging green; human review.

### Phase 4 — Scale + cleanup (P2)
- [ ] Task 8: One Redis (HTTP/Upstash, Edge-compatible) cache with hit-rate surfacing; retire `smartCacheManager` (699 lines), `unstable_cache` wrappers, `intelligentSearch` Map.
- [ ] Task 9: Delete `TemporalOptimizer`, renormalize weights (no-op by construction — prove with ranking snapshot test); extract `weatherTypeMapper` (kills ×4), `promptBuilder` (kills 9-arg), `durationParser`; move root `FIX_*.sql` into `supabase/migrations/`; lazy `getSupabaseAdmin()` + `.strict()` + 32KB body cap.
- [ ] Task 10: pino + requestId logging (replace emoji logs, redact prompt/userId); metrics (llmCalls, cache hit, refund count, zero-activity rate); refund-spike alert. ADRs: single-route, lookup-vs-charge (post-Q1), redis-sessions-if-needed, race-vs-sequential LLM (with input-token numbers).

### Checkpoint: Complete
- [ ] Cost doc published (p50/p95 latency + $/itinerary); all acceptance criteria met; ready for review.

## 5. OPEN QUESTIONS (need human rulings)
- **Q1 (blocking):** Credits = per served request (keep charging on cache hits; fix the assessment's test) or per GPU-second (lookup-then-charge reorder everywhere)?
- **Q2:** Vercel plan tier → `maxDuration` value for generator routes?
- **Q3:** Confirm no external/partner callers of the two nested route URLs before deletion (Task 0b).

## 6. RISKS
| Risk | Impact | Mitigation |
|---|---|---|
| RPC migration applied to prod twice / drift | Double-spend logic forks | Single migration file, `CREATE OR REPLACE`, verify on staging first |
| Q1 ruled late | Phase 2 rework | Task 0 gates Phase 2; Phase 1 is ruling-independent |
| Upstash unavailable on Edge | Middleware limiter throws | Fail-closed with short TTL fallback + alert; load-test the path |
| Deleting a route with an unknown external caller | 404 for partners | Task 0b access-log check is a hard gate, not a nice-to-have |

## EXPLICITLY DECLINED (with reason)
- Sequential-LLM rewrite: fights the p50<3500 SLO for unquantified input-token savings. Revisit only with measured $/request showing input-waste dominates.
- Concierge 503 on balance error: atomic consume RPC already gates; zero added protection.
- "Charge on miss only" (until Q1 rules).
