# ADR 007 — Vercel serverless (Hobby) deployment: platform limits are policy, not accidents

- **Status:** Accepted (corrected 2026-09-20 against Vercel docs, last_updated 2026-08-24)
- **Date:** 2026-09-20
- **Deciders:** Doniele Arys Antonio

## Context

Deployment is Vercel serverless (evidence: `bench:staging` targets `tarana-ai.vercel.app`; the `maxDuration` export documents the plan). The user ruled on 2026-09-18: **Vercel Hobby**.

**Correction 2026-09-20:** the original ruling recorded a 60s function cap. That is stale — Vercel's Fluid compute limits (verified against https://vercel.com/docs/functions/limitations, `last_updated: 2026-08-24`) give Hobby **300s default and maximum** (5 minutes), not 60s. The verified Hobby limits:

| Limit | Hobby (verified) |
|---|---|
| Max duration | **300s** default and maximum (5 minutes) |
| Memory | 2 GB / 1 vCPU |
| Function bundle | 250 MB uncompressed |
| Concurrency | Auto-scales to 30,000 |
| Request body | 4.5 MB |
| **Active CPU billing** | **Waiting for I/O (Gemini, DB) does NOT count toward active CPU time** — code is billed only for CPU it actively computes |
| File descriptors | 1,024 shared across concurrent executions |
| Log retention | ~30 minutes (Hobby) |

The cap shapes real engineering decisions:

- Generations run 7.5–60s per bench docs — **~5x headroom under the 300s platform limit**. The code's `maxDuration = 60` (`route.ts:72`) is a deliberate safety rail well below the platform ceiling, so Vercel never kills an invocation mid-flight: the export fires first.
- Total work is bounded below `maxDuration`: `StructuredOutputEngine` 3×45s=135s → 2×25s=50s; `generateItinerary` per-call deadline 25s via `Promise.race`; `proposeSubqueries` 25s deadline, fail-open to `[]`.
- **Gemini generation is ~$0 on Hobby:** waiting for Gemini/DB I/O does not count toward active CPU time, and Hobby functions are free. The most expensive path in the system (generation) bills only for CPU the code actively computes — negligible, since the wall-clock is dominated by I/O wait.
- In-memory state (`rateLimiter`'s `Map`, `refundMetrics` counters, `sessionStore`) resets on cold starts — per-instance values are only meaningful within an invocation/burst.
- `unstable_cache` (30-min revalidation) provides free cross-instance caching on Vercel.
- Log retention on Hobby is ~30 minutes — the Task 0b caller-check in the gala plan could only be partially satisfied (no CLI token, short dashboard window).

## Decision

1. **Deploy on Vercel serverless, Hobby tier.** No self-hosting, no container platform. **Stay on Hobby — it is the correct tier for a solo-built project**, and the 2026-08-24 Fluid compute limits make it *more* correct than at ruling time: the most expensive path (Gemini generation) bills ~$0 because I/O wait does not count toward active CPU time.
2. **The 60s `maxDuration` is a deliberate safety rail, not the platform ceiling.** The platform limit is 300s (verified 2026-08-24 docs); the code's 60s export fires first, so Vercel never kills an invocation mid-flight. Total work (retries × timeout + delay) is bounded below 60s. Code that could exceed `maxDuration` is a bug, not a platform limitation.
3. **Timeout-charge policy is explicit and documented:** a request killed at the `maxDuration` export is charged with no possible refund — refund-after-death is impossible. The causal story is corrected: the charge happens at the *code's* rail (60s), not the *platform's* (300s), because the rail fires first. Documented at the `maxDuration` export.
4. **In-memory state is per-instance by design.** Counters aggregate within an invocation/burst, not globally. Durable observability requires an HTTP/Edge sink (upgrade path documented in `refundMetrics.ts`) — not a process-global fix.
5. **`unstable_cache` is the cross-instance caching mechanism.** No Redis until traffic justifies it (§3.3).
6. **Log retention (~30 min on Hobby) is a known constraint** on any log-based audit — evidence from logs is strong within the window, not a complete 30-day proof.

## Alternatives considered

1. **Self-host (VPS, Docker on a VPS).** Rejected: takes over the ops burden (patching, TLS, uptime, scaling) for a solo builder; Vercel's free tier + preview deploys + zero-config CI integration are the load-bearing platform features. Revisit if Vercel's per-invocation costs dominate or a real feature needs >300s.
2. **Vercel Pro (upgrade for 800s max duration + longer retention).** Declined by the user's ruling, and **nothing is gained by upgrading today:** generations run 7.5–60s with ~5x headroom under Hobby's 300s, and I/O wait (Gemini, DB) is not billed as active CPU — the most expensive path is ~$0 on Hobby. Pro's 800s maximum is irrelevant to current workloads. Revisit if a real feature needs >300s or sustained high CPU compute.
3. **Container platform (Fly.io, Railway).** Rejected: same ops burden as self-hosting with fewer free-tier benefits; the preview-deploy + git-integration story is weaker.

## Consequences

- **Accepted costs:** the 60s `maxDuration` rail bounds every generation (fail-fast required — code must stay under it, not the platform limit); refund-after-death is impossible (charged with no refund, documented); in-memory observability resets on cold starts; log-based audits are window-bound.
- **Gains kept:** zero ops burden; zero function cost (I/O wait not billed); preview deploys on every PR; free cross-instance caching via `unstable_cache`; the timeout-charge policy is explicit.
- **The refund path is bounded by construction:** retries × timeout + delay < 60s — and since the 60s rail fires before the 300s platform limit, a Vercel kill cannot skip a refund block mid-flight.

## Revisit triggers (any one reopens this ADR)

1. A real feature needs >300s of function time (Pro upgrade reopens).
2. Sustained high CPU compute (not I/O wait) dominates the bill (Pro or self-host reopens).
3. Vercel's per-invocation costs dominate the bill (self-host reopens).
4. A log-based audit needs >30-minute retention (CLI token or Pro reopens).
5. A code path can exceed the 60s `maxDuration` rail (that code is a bug — fix it, don't reopen).

## Related record

- Hobby ruling + bounded work: `specs/tarana-gala-money-correctness-plan.md` Task 4, Q2.
- Timeout-charge policy: `src/app/api/gemini/itinerary-generator/route.ts:72` (`maxDuration = 60`).
- Refund observability + upgrade path: `src/lib/observability/refundMetrics.ts`.
- Supabase as source of truth: ADR 006.
- **Verified limits source:** https://vercel.com/docs/functions/limitations (`last_updated: 2026-08-24`, read 2026-09-20).
