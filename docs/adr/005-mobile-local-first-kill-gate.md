# ADR 005 — Mobile local-first: honest stub until the web app is safe to operate

- **Status:** Accepted
- **Date:** 2026-09-20
- **Deciders:** Doniele Arys Antoniop
- **Supersedes:** ADR 002's local-LLM premise (Phase 4 of the mobile plan) — the on-device model is an explicit kill-gate, not a shipped feature

## Context

ADR 002 decided mobile goes local-first shell + server brain. Its Phase-4 premise was an on-device LLM for offline itinerary generation. Reality on the ground (verified 2026-09-20):

- `tarana-mobile/src/data/index.ts:224-228` — `generateItinerary` is an explicit `Promise<never>` stub. It is an **honest stub, not a mock**: calling it throws, it never pretends to succeed.
- No `eas.json`, no store build, no mobile test suite (`tarana-mobile/package.json` has no test script), no local-model validation.
- The web app was, until this week, unsafe to operate: `String(error)` leaked in 3 routes, no correlation IDs, no audit gate, 3 critical vulnerabilities (2× RCE, homoglyph bypass).

The plan's own sequencing rule (§7, "Never Phase 7 before Phase 0") captured this: mobile local AI is a product decision, not an engineering one — and shipping a throwing stub as a feature is worse than removing the screen.

## Decision

1. **The web app comes first.** Phase 0 (logging, error handling, CI gates, flags) closed 6 of 7 items before any mobile work. The web app is now safe to operate: typed errors, correlation IDs, audit gate, bundle budget, health endpoint, flags.
2. **The stub stays an honest stub until a real model is validated.** `generateItinerary` throws — it never pretends to work. A shipped screen that throws is worse than a removed screen; a stub that pretends is worse than both.
3. **The local-LLM premise (ADR 002's Phase 4) is a kill-gate, not a feature.** Either integrate a GGUF model (llama.cpp / Core ML) and validate output quality against the bench criteria, or remove the Plan screen from the shipped app. The premise is not shipped on faith.
4. **Mobile test suite before local AI.** `tarana-mobile/package.json` has no test script. A local model with no test harness cannot be validated — the harness is the prerequisite, not the model.

## Alternatives considered

1. **Ship the Plan screen with the throwing stub behind a flag.** Rejected: a user-visible screen that throws is a lie with extra steps. The stub is honest only because it is not shipped.
2. **Integrate a GGUF model now, validate later.** Rejected: local-model output quality is unvalidated — shipping first and validating after means real users receive itineraries of unknown quality. The bench criteria are the gate.
3. **Remove the Plan screen now.** Deferred: the screen is the UX container for the eventual model. Removing it means rebuilding navigation when the model lands. Keeping it (unshipped) costs nothing.
4. **Pursue mobile EAS build + tests in parallel with Phase 1.** Rejected for now: the web app's Phase 1 (auth centralization, services) is the higher-leverage next work; mobile tooling is 2 weeks of effort for a prototype with no store presence.

## Consequences

- **Accepted costs:** the mobile app cannot generate itineraries offline (the §2 offline-first premise is partially deferred); the Plan screen is dead weight until the model lands.
- **Gains kept:** the web app is safe to operate first; the stub's honesty (throws, never pretends); the local-LLM premise is gated on evidence, not faith.
- **The plan's own rule is honored:** §7 "Never Phase 7 before Phase 0" — and Phase 0 closed 6/7 before this ADR was written.

## Revisit triggers (any one reopens this ADR)

1. A GGUF model integration is proposed with bench-validated output quality.
2. The Plan screen is removed from the shipped app.
3. A mobile test suite lands (the harness prerequisite).

## Related record

- Local-first shell + server brain: ADR 002.
- Honest stub: `tarana-mobile/src/data/index.ts:224-228` (`Promise<never>`).
- Phase 0 implementation: `specs/tarana-engineering-architecture-plan-audit.md` §9 (6/7 done).
- Mobile app plan: `specs/tarana-mobile-app-plan.md`.
