# ADR 009 — Agentic feedback edge (grounding failure → one narrowed retry): OPTIONAL, not implemented

- **Status:** Proposed (optional). NOT accepted, NOT implemented. No code in this ADR.
- **Date:** 2026-10-07
- **Deciders:** Doniele Arys Antonio (decision pending)

## Context

The Gala pipeline is a fixed four-stage DAG — Concierge → ContextScout → RetrievalStrategist → ItineraryComposer — sharing one `RequestSession` as a blackboard, autonomously executed after a single user action. Since Tier-1 slice 1 (PR #707), the Strategist makes one real decision: `decideStrategy()` selects from a closed catalog (`curated | tomtom-live | interest-first | honest-empty`) on scope + request shape, recorded in-session with its reason. Everything else is a deterministic single-pass transform; there are zero model calls beyond generation, and the pipeline is refund-safe, tested, and cheap.

The remaining gap between this system and a fully checklist-agentic one is a **feedback edge**: today a grounding failure (zero servable activities) throws → coordinator refunds → user eats the failure. Nothing routes the failure signal back into retrieval. This ADR records the design for exactly one such loop, so the decision is on paper instead of in someone's head.

## Decision (proposed, not taken)

Add **one** bounded retry edge, and nothing else:

1. **Trigger:** composer-side grounding check reports zero servable matches (the same signal that today throws `No servable recommendations after grounding`).
2. **Action:** route back to the Strategist **once** with a narrowed request — drop the failing interest bucket, keep city + duration. The Strategist re-runs `decideStrategy()` on the narrowed input, retrieval runs a second pass.
3. **Terminal:** if the second pass also grounds to zero, the existing throw → refund path fires unchanged. Maximum two retrieval passes per request. Zero additional model calls on the retry decision itself (the decision stays a pure function of scope + remaining interests).
4. **Charge invariant (hard constraint, from ADR-004):** the charge happens once, upstream of the loop, in `PipelineCoordinator.handleRequest`. The retry must not consume a second credit, must not issue a second refund key, and must not touch the refund path except through the existing throw. Any implementation that adds a charge, a refund key, or a credit mutation is out of scope and must be rejected in review.
5. **Legacy path untouched (hard constraint, from ADR-003):** this edge lives only in the multi-agent path behind `USE_MULTI_AGENT`. The legacy single-shot path is the rollback target and must keep working with no knowledge of the loop.

## Alternatives considered

1. **Do nothing (current state, recommended default).** The pipeline's reliability comes from not looping: deterministic, bounded cost (1 retrieval + N-attempt composer), testable, refund-safe. A retry converts a class of failures into retries at the cost of ~+1 TomTom/cache round-trip of latency on the failure path only. The failure it converts is already handled honestly today (refund + 500), and session `traffic` snapshots — the field a retry loop would most plausibly parameterize — have **zero consumers** outside the scout (verified 2026-10-07), so there is no data loop waiting to be closed. Revisit only on measured failure-path metrics, not vocabulary.
2. **Open-ended retry-until-success.** Rejected: unbounded latency on a charged request, unbounded TomTom spend, nondeterministic test surface, and direct conflict with the p50<3500 SLO and ADR-004's per-served-request billing (a request killed at the 60s platform limit is charged with no possible refund — a loop makes that outcome more likely, not less).
3. **Planner/critic agents (Tier-2 autonomy).** Rejected for now: adds model calls, latency, tokens, and nondeterminism to a user-facing request after charging. Each loop must buy something named; none currently does. Filed here only so the rejection is on record.

## Consequences (if ever accepted)

- **Accepted costs:** one more state transition to test (retry-fires-exactly-once, retry-exhausted-throws, no-double-charge); failure-path latency +1 retrieval pass; the money path gains a branch requiring a double-charge audit.
- **Gains kept on accept:** a class of grounding failures becomes retries instead of refunds; the Strategist and Composer communicate instead of merely sequencing (the property that makes "multi" fully descriptive rather than one-quarter true).
- **Gains kept on reject (current):** everything above costs nothing, risks nothing, and the pipeline keeps its current reliability profile.

## Revisit triggers (any one reopens this ADR)

1. Measured grounding-failure rate on any city rises to a level where a retry would convert materially more requests than it delays (needs failure-path metrics first — they do not currently exist).
2. A second decision point appears anywhere in the pipeline (the loop gains a second consumer and the cost/benefit changes).
3. ADR-004's billing direction changes (a loop under per-GPU-second billing has different economics than under per-served-request).

## Related record

- Tier-1 strategist decision: PR #707 (`decideStrategy`, closed strategy catalog, `expandedQueries` finally populated).
- Deterministic-multi-agent reading: the pipeline is a fixed DAG, autonomously executed after one user action; `decideStrategy` is its one decision point.
- Charge-first + idempotent refunds: ADR-004. Multi-agent-vs-legacy flag: ADR-003.
- Verified no-ops: session `traffic` snapshots have zero consumers outside ContextScout (2026-10-07); parameterizing them would be dead code.
