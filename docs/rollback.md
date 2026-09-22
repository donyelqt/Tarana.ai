# Rollback policy

Status: Accepted
Date: 2026-09-23
Owner: engineering

Every deploy to production must be reversible in under 5 minutes.
Reversibility has exactly two levers, in this order. There is no third lever.

## Lever 1 — Feature flag env flip (< 1 minute)

`src/lib/flags/flags.ts` — `FLAG_<NAME>` wins over the config default and
over the legacy `USE_MULTI_AGENT` var. Flip the env var in Vercel, redeploy
(or let the next deploy pick it up). No code change, no revert, no rebuild
of history.

Current flags (single source of truth is the registry, not this doc):

| Flag | Default | Prod today | Rollback direction |
|---|---|---|---|
| `USE_MULTI_AGENT` | `false` | `true` (Vercel All Environments, user-verified 2026-09-20) | Set `FLAG_USE_MULTI_AGENT=false` to return to the legacy single-shot path. **Never set it `true`** — prod already runs the flag path; `true` only re-asserts current behavior and burns the lever. |

Rules:

- The flag path is the production path (ADR-003). The legacy path is the
  rollback target. Deleting the legacy path removes the lever — see ADR-003
  alternatives (rejected).
- CI sets `USE_MULTI_AGENT=true` so CI tests the path prod serves.
  A flag-OFF-only CI is a blind rollback target.
- Flag expiry (`2027-03-20`) forces a review: either renew with evidence
  the legacy path still works, or delete the flag + legacy path together
  via a parity-suite-green PR (ADR-003 revisit trigger 1).

## Lever 2 — Vercel deployment rollback (< 5 minutes)

When the flag lever does not cover the breakage (schema change, config,
non-flagged code):

1. Note the issue and gather logs (requestId from `x-request-id`).
2. Vercel → Deployments → find the last working deployment.
3. "…" → "Promote to Production".
4. Verify: `GET /api/health` returns 200; error rate back within 10% of
   baseline; p95 latency within 20% of baseline.

## When to roll back (any one triggers)

- Error rate > 2x baseline.
- p95 latency > 50% above baseline.
- User-reported issues spike on the deployed surface.
- Data integrity issue detected (stop writes first, then roll back reads).
- Security vulnerability introduced by the deploy.

## What this doc does NOT cover

- SLO numbers and error-budget policy — see `docs/slo.md`.
- Per-alert runbooks — see `docs/runbooks/` (Phase 5.3, not yet written).
- Deploy steps themselves — see `docs/DEPLOYMENT_CHECKLIST.md`
  (its Rollback Plan section is the click-path; this doc is the policy).
