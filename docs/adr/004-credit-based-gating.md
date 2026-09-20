# ADR 004 — Credit-based gating: atomic RPCs, per-served-request billing, idempotent refunds

- **Status:** Accepted
- **Date:** 2026-09-20
- **Deciders:** Doniele Arys Antonio

## Context

Credits gate every billable feature (itinerary generation, food recommendations). The gating logic went through a correctness campaign (`specs/tarana-gala-money-correctness-plan.md`): the original `CreditService.refundCredits` was a SELECT-then-UPDATE (lost-update under concurrency; floor-at-zero enabled repeated over-refund), refund call sites swallowed failures silently at 5 sites, and both credit RPCs were EXECUTE-able under the anon key — fail-closed depended entirely on RLS staying perfect.

The billing-direction question (per served request vs per GPU-second) was ruled by the user on 2026-09-18: **credits = per served request** — cache hits cost a credit, matching the documented intent in the optimized route.

## Decision

1. **Billing = per served request.** Every generation charges 1 credit regardless of compute time or cache state. A request killed at the platform limit (Vercel Hobby 60s) is charged with no possible refund — refund-after-death is impossible (`route.ts:72`, documented at the `maxDuration` export).
2. **All credit mutations are atomic RPCs.** `consume_credits` is a guarded single-statement UPDATE (migration `20260814000000_atomic_credit_consumption_and_refund.sql`). `refund_credits` is an atomic guarded decrement with a composite `UNIQUE(user_id, idempotency_key)` (migration `20260914000000_refund_credits_rpc.sql`). No SELECT-then-UPDATE anywhere.
3. **Refunds are idempotent by per-attempt key.** Every refund call site passes a stable per-attempt key (`refund:<session.id>` shared coordinator↔route, `refund:zero/fail:<attemptUUID>` per request). Body-derived fingerprints are rejected — two identical requests are two separate charges needing independent refunds. A replayed key returns FALSE with no money effect.
4. **Refund failures are observable, never silent.** `src/lib/observability/refundMetrics.ts` (PR #482) records refunded/noop/failed per invocation; snapshots are emitted to logs on the zero-activity path, the failure catch, and the multi-agent finally. A failed-refund spike is visible in prod logs.
5. **Anon EXECUTE is revoked on the whole credit-RPC class.** Migration `20260918000000_revoke_anon_from_credit_rpcs.sql` (applied + verified on prod 2026-09-18 via `scripts/prove-revoke-anon.mjs` — anon → 401/42501 on all 4 RPCs; service-role → 200).
6. **Charging/refund exemptions are gated on bypass-active**, not bare id equality (`src/lib/auth/benchToken.ts`, PR #471).

## Alternatives considered

1. **Per GPU-second billing (lookup-then-charge reorder).** Rejected by the user's ruling: fights the p50<3500 SLO for unquantified input-token savings; "sequential-LLM rewrite" declined in the gala plan with the same reason. Revisit only with measured $/request showing input-waste dominates.
2. **Refund via SELECT-then-UPDATE.** Rejected: lost-update under concurrency; floor-at-zero enables repeated over-refund. Superseded by the atomic RPC.
3. **Refund on error only (no idempotency key).** Rejected: a retried request's legitimate second refund would be swallowed, or a replayed error path would double-refund. The per-attempt key is the control.
4. **Silent refund swallowing (status quo ante).** Rejected: a silent refund failure post-REVOKE is invisible — money leaves the account with no trace. The metrics counters are the control.

## Consequences

- **Accepted costs:** every refund call site must construct a stable key (now 6 sites, all wired); the metrics counters are per-instance and reset on cold starts (serverless caveat documented — they aggregate within an invocation/burst, not globally).
- **Gains kept:** no double-charges, no duplicate writes; failed refunds visible in prod logs; anon-key fail-closed does not depend on RLS alone; cache-hit billing matches the documented intent.
- **Timeout-charge policy is explicit:** a request killed at the platform limit is charged with no possible refund. Documented at `route.ts:72` so future agents don't re-decide.

## Revisit triggers (any one reopens this ADR)

1. Measured $/request showing input-token waste dominates (GPU-second billing reopens).
2. A refund-spike alert fires with no known cause.
3. A new credit mutation is added without an idempotency key.

## Related record

- Atomic consume + refund RPCs: migrations `20260814000000`, `20260914000000` (PRs #468, #471).
- REVOKE from credit RPCs: migration `20260918000000` (`scripts/prove-revoke-anon.mjs`).
- Refund observability: `src/lib/observability/refundMetrics.ts` (PR #482).
- Bench token (exemption gating): `src/lib/auth/benchToken.ts` (PR #471).
- Full correctness campaign: `specs/tarana-gala-money-correctness-plan.md`.
