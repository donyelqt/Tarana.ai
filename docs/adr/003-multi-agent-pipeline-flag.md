# ADR 003 — Multi-agent pipeline behind a flag (legacy single-shot retained as fallback)

- **Status:** Accepted
- **Date:** 2026-09-20
- **Deciders:** Doniele Arys Antonio

## Context

The generator route (`src/app/api/gemini/itinerary-generator/route.ts`, ~510 lines) serves two implementations: a legacy single-shot POST (charge → `unstable_cache` → `GuaranteedJsonEngine` with 3 retries) and a multi-agent path (`PipelineCoordinator` + Concierge/ContextScout/RetrievalStrategist/ItineraryComposer agents). Both were live in production simultaneously: Vercel has `USE_MULTI_AGENT=true` in All Environments since 2025-11-18 — prod has run the multi-agent path for ~10 months.

The legacy path remained as the safety net, but nothing recorded which path was the production path, and CI only exercised flag-OFF while `.env`/`.env.local` set flag-ON in dev: two paths, one tested, and no decision on record.

## Decision

1. **The multi-agent path IS the production path.** `USE_MULTI_AGENT=true` in Vercel All Environments (user-verified 2026-09-20). CI sets `USE_MULTI_AGENT=true` so CI tests the same path prod serves — the CI/prod path mismatch is closed (PR #495).
2. **The legacy path stays.** It is the rollback target for the flag lever. Deleting it removes the rollback option and makes the flag meaningless.
3. **The flag mechanism is zero-dep** (`src/lib/flags/flags.ts`, PR #495) — a flag service (Unleash) was declined: a service to operate for one flag, with no traffic to justify it (§3.3's no-Redis-until-traffic-justifies logic applies). Env override `FLAG_<NAME>` wins over the config default — the §2.5 rollback lever.
4. **Cache billing direction per path is unchanged** (per the Q1 ruling in `specs/tarana-gala-money-correctness-plan.md` — credits = per served request). Multi-agent charges in `PipelineCoordinator.handleRequest` before generation; legacy charges in the route body. Both are atomic RPCs (`consume_credits`).

## Alternatives considered

1. **Delete the legacy path.** Rejected: removes the rollback target. If the multi-agent path breaks in prod, the only recovery would be a code revert (minutes to hours) instead of an env flip (seconds). Revisit when the multi-agent path has a full parity test suite in CI.
2. **Unleash / hosted flag service.** Rejected: server + SDK dependency + hosting for one flag. Revisit at 3+ flags or when non-engineering roles need to flip flags.
3. **Multi-agent only, no flag.** Rejected: no off switch for the highest-risk path in the system. §2.5 (rollback policy) requires every deploy to be reversible; the flag is that reversibility.

## Consequences

- **Accepted costs:** two implementations must be kept in functional parity (the legacy path rots if untested); the flag registry's expiry (2027-03-20) forces a review.
- **Gains kept:** one-line prod rollback via env; CI matches prod; the legacy path is a working reference for parity tests.
- **Parity test requirement:** a future slice must add a test proving both paths produce equivalent itinerary shapes — until then the legacy path is the untested reference.

## Revisit triggers (any one reopens this ADR)

1. The legacy path is deleted (parity suite green).
2. A second flag exists (the registry needs real tooling or a dashboard).
3. The flag expires (2027-03-20) without a review.

## Related record

- Flag registry + CI alignment: PR #495.
- Single-route consolidation (legacy vs multi-agent merge prep): `specs/tarana-gala-money-correctness-plan.md` Phase 3, Task 7.
- Credit correctness: `specs/tarana-gala-money-correctness-plan.md` Phase 1.
