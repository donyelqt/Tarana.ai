# AGENTS.md — tarana.ai

Conventions for AI coding agents. Read this before editing. Stay consistent with the established architecture.

## Stack
- Next.js (App Router) + TypeScript + Tailwind/PostCSS. Primary app lives under src/app.
- A separate Vite SPA also lives in this repo (src/App.tsx, src/main.tsx, index.html). Keep the two apps isolated; do not import Vite src into the Next app or vice versa.
- Prisma + database. CreditService owns the billing/credit domain.
- Jest for unit tests; ESLint + tsc for static checks.

## Commands (run from repo root)
- Typecheck: npx tsc --noEmit
- Lint:      npx eslint .
- Build:     npx next build
- Tests:     npx jest

## Credit billing (CRITICAL — do not deviate)
Every premium action charges credits. The correct, established pattern is CHARGE-FIRST, ATOMIC, REFUND-ON-FAILURE:
1. Resolve userId from the authenticated session. Never trust req.body for identity.
2. Pre-check balance; if insufficient, return 402 (InsufficientCreditsError).
3. Call CreditService.charge() BEFORE the expensive work (generation / external API).
4. Do the work; on success return the result.
5. In catch: if a charge occurred, call CreditService.refund() before returning 500.
Only charge on success. Never leave a user debited for a failed request.

Gotcha: in the Next.js App Router, req.body is a ReadableStream. Do not JSON.parse or console.log it. Use session/headers for identity and cached-request helpers for the body.

## Known caveats
- The USE_MULTI_AGENT code path still charges AFTER generation (legacy, flag-gated, entangled with pipelineCoordinator). Do not assume all routes are charge-first until that path is refactored.
- The migration + refund constraint are already deployed; billing is production-safe.

## Commits
- Split refactors from behavior changes into separate commits.
- Never commit secrets or .env.
- Concise messages matching repo style.

## Do / Don't
- DO keep agent/skill/command config under .kilo/.
- DO run tsc + lint before declaring work done.
- DON'T log request bodies; DON'T charge after generation; DON'T cross-wire the Vite and Next apps.
