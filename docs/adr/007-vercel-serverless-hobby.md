# ADR 007 — Vercel serverless (Hobby) deployment: platform limits are policy, not accidents

- **Status:** Accepted
- **Date:** 2026-09-20
- **Deciders:** Doniele Arys Antonio

## Context

Deployment is Vercel serverless (evidence: `bench:staging` targets `tarana-ai.vercel.app`; the `maxDuration` export documents the plan). The user ruled on 2026-09-18: **Vercel Hobby** → the 60s function cap applies.

The Hobby cap shapes real engineering decisions:

- Generations run 7.5–60s per bench docs. A Vercel kill at 60s skips every refund block by construction — a request killed at the platform limit is charged with no possible refund (refund-after-death is impossible). This is documented at `route.ts:72` (`maxDuration = 60`).
- Total work is bounded below the limit: `StructuredOutputEngine` 3×45s=135s → 2×25s=50s; `generateItinerary` per-call deadline 25s via `Promise.race`; `proposeSubqueries` 25s deadline, fail-open to `[]`.
- In-memory state (`rateLimiter`'s `Map`, `refundMetrics` counters, `sessionStore`) resets on cold starts — per-instance values are only meaningful within an invocation/burst.
- `unstable_cache` (30-min revalidation) provides free cross-instance caching on Vercel.
- Log retention on Hobby is ~30 minutes — the Task 0b caller-check in the gala plan could only be partially satisfied (no CLI token, short dashboard window).

## Decision

1. **Deploy on Vercel serverless, Hobby tier.** No self-hosting, no container platform.
2. **The 60s cap is an engineering constraint, enforced by construction.** Every generator route sets `maxDuration = 60`; total work (retries × timeout + delay) is bounded below it. Code that could exceed the cap is a bug, not a platform limitation.
3. **Timeout-charge policy is explicit and documented:** a request killed at the platform limit is charged with no possible refund. Documented at the `maxDuration` export so future agents don't re-decide.
4. **In-memory state is per-instance by design.** Counters aggregate within an invocation/burst, not globally. Durable observability requires an HTTP/Edge sink (upgrade path documented in `refundMetrics.ts`) — not a process-global fix.
5. **`unstable_cache` is the cross-instance caching mechanism.** No Redis until traffic justifies it (§3.3).
6. **Log retention (~30 min on Hobby) is a known constraint** on any log-based audit — evidence from logs is strong within the window, not a complete 30-day proof.

## Alternatives considered

1. **Self-host (VPS, Docker on a VPS).** Rejected: takes over the ops burden (patching, TLS, uptime, scaling) for a solo builder; Vercel's free tier + preview deploys + zero-config CI integration are the load-bearing platform features. Revisit if Vercel's per-invocation costs dominate or the 60s cap blocks a real feature.
2. **Vercel Pro (upgrade for longer maxDuration + retention).** Declined by the user's ruling: Hobby caps are acceptable today. The timeout-charge policy makes the cap survivable (fail fast, bound work, document the charge). Revisit if a real feature needs >60s.
3. **Container platform (Fly.io, Railway).** Rejected: same ops burden as self-hosting with fewer free-tier benefits; the preview-deploy + git-integration story is weaker.

## Consequences

- **Accepted costs:** the 60s cap bounds every generation (fail-fast required); refund-after-death is impossible (charged with no refund, documented); in-memory observability resets on cold starts; log-based audits are window-bound.
- **Gains kept:** zero ops burden; preview deploys on every PR; free cross-instance caching via `unstable_cache`; the timeout-charge policy is explicit.
- **The refund path is bounded by construction:** retries × timeout + delay < 60s — a Vercel kill cannot skip a refund block mid-flight because the total work cannot reach the platform limit.

## Revisit triggers (any one reopens this ADR)

1. A real feature needs >60s of function time (Pro upgrade reopens).
2. Vercel's per-invocation costs dominate the bill (self-host reopens).
3. A log-based audit needs >30-minute retention (CLI token or Pro reopens).
4. A code path can exceed the 60s cap (that code is a bug — fix it, don't reopen).

## Related record

- Hobby ruling + bounded work: `specs/tarana-gala-money-correctness-plan.md` Task 4, Q2.
- Timeout-charge policy: `src/app/api/gemini/itinerary-generator/route.ts:72` (`maxDuration = 60`).
- Refund observability + upgrade path: `src/lib/observability/refundMetrics.ts`.
- Supabase as source of truth: ADR 006.
