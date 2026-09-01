# Contributing & Conventions — tarana.ai

Project conventions for contributors. Read this before opening a PR. Stay consistent with the established architecture.

## Stack
- Next.js (App Router) + TypeScript + Tailwind/PostCSS. Primary app lives under `src/app`.
- A separate Vite SPA also lives in this repo (`src/App.tsx`, `src/main.tsx`, `index.html`). Keep the two apps isolated; do not import Vite src into the Next app or vice versa.
- Prisma + database. `CreditService` owns the billing/credit domain.
- Jest for unit tests; ESLint + tsc for static checks.

## Commands (run from repo root)
- Typecheck: `npx tsc --noEmit`
- Lint:      `npx eslint .`
- Build:     `npx next build`
- Tests:     `npx jest`

## Credit billing (CRITICAL — do not deviate)
Every premium action charges credits. The correct, established pattern is **CHARGE-FIRST, ATOMIC, REFUND-ON-FAILURE**:
1. Resolve `userId` from the authenticated session. Never trust `req.body` for identity.
2. Pre-check balance; if insufficient, return 402 (`InsufficientCreditsError`).
3. Call `CreditService.charge()` BEFORE the expensive work (generation / external API).
4. Do the work; on success return the result.
5. In `catch`: if a charge occurred, call `CreditService.refund()` before returning 500.

Only charge on success. Never leave a user debited for a failed request.

Gotcha: in the Next.js App Router, `req.body` is a `ReadableStream`. Do not `JSON.parse` or `console.log` it. Use `session`/`headers` for identity and cached-request helpers for the body.

## Commits
- Split refactors from behavior changes into separate commits.
- Never commit secrets or `.env`.
- Concise messages matching repo style.

## Do / Don't
- **DO** run `tsc` + lint before declaring work done.
- **DO** respect the credit-billing invariant above in every premium route.
- **DON'T** log request bodies; **DON'T** charge after generation; **DON'T** cross-wire the Vite and Next apps.
