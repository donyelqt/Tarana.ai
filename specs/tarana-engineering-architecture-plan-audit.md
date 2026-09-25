# Tarana.ai Engineering Architecture Plan — VERIFIED

Status: **Verified** (claims re-checked against working tree 2026-09-20)
Date: 2026-09-20

Every claim below was re-verified against the working tree on 2026-09-20.
Test run: `pnpm test -- --passWithNoTests --maxWorkers=2` → **1 failed, 8 skipped, 499 passed** (65 suites).

| Domain | Status | Evidence |
|---|---|---|
| **API surface** | 35 `route.ts` files + 1 extensionless `cron/evaluate-refreshes/route` | `find src/app/api -name route.ts \| wc -l` = 35 |
| **Auth boundary** | 1 route uses `withAuth`; **18** route files call `getServerSession` directly; **1** is the NextAuth `[...nextauth]` handler (authOptions only); **15** use no auth import at all | `grep -rl getServerSession src/app/api --include=route.ts \| grep -v __tests__` = 18; `withAuth` = 1; `authOptions`-only = 1; remainder = 15 |
| **Error handling** | No repository-wide standard. `ItineraryError`/`ErrorHandler` exist only inside the Gemini pipeline. `saved-itineraries/route.ts:33-37` returns `String(error)` | `src/app/api/saved-itineraries/route.ts:33-37`; `gemini/itinerary-generator/lib/errorHandler.ts:13` |
| **Observability** | In-process counters only (`refundMetrics`, `StructuredOutputMonitor`, `performanceMonitor`). No durable RED metrics, no request IDs, no alerting. | `src/lib/observability/refundMetrics.ts:28-47` — `counters` is a module-level object; `takeRefundSnapshot` reads-and-resets |
| **Rate limiting** | `InMemoryRateLimiter` — `Map` per process. Global middleware wired and active (`src/middleware/index.ts:19-40`), but no shared store. | `src/lib/security/rateLimiter.ts:22` (`store = new Map()`) |
| **CORS** | `cors.ts:4-15` allowlist = `tarana.ai`, `www.tarana.ai`, `NEXT_PUBLIC_SITE_URL`. `corsConfig.enabled: true`. Live response previously reported `*`; re-verify with `curl -I` before Phase 0. | `src/middleware/cors.ts:4-15` |
| **Security headers** | **Applied globally by the middleware chain.** `securityHeaders.ts:7-40` defines CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. `compose.ts:24,32,44,55` calls `applySecurityHeaders` on **every** middleware response (initial, per-middleware, and final). The 3 auth routes that also call `applySecurityHeaders` are redundant, not missing. Residual gap: only paths excluded by the middleware `matcher` (static assets) get none — non-security-relevant. The earlier "security headers: none" claim was wrong. |
| **CI/CD** | 4 gates: lint (`--max-warnings=1000`), typecheck, tests, build. No audit, no security scan, no mobile check. | `.github/workflows/ci.yml:41-51` |
| **Testing** | 63 suites pass, 1 fails (`emailConfig.test.ts:78` — ambient `SMTP_FROM_EMAIL`), 1 skipped. 499 pass, 1 fail, 8 skipped. No E2E, no contract suite, no mobile tests. | `pnpm test` 2026-09-20; `tarana-mobile/package.json` has no test script |
| **Documentation** | 2 ADRs | `docs/adr/001-monorepo-layout.md`, `002-mobile-local-first.md` |
| **Mobile** | Expo scaffold + screens + simulator runs. `generateItinerary` is an explicit `Promise<never>` stub. No `eas.json`, no store build, no local-model validation. | `tarana-mobile/src/data/index.ts:224-228` |
| **E2E tooling** | None. No Playwright, Cypress, or `e2e/` directory. `package.json` devDeps: jest, ts-jest, testing-library only. | `tarana-mobile/` glob; `package.json:59-83` |
| **Health** | No dedicated `/api/health`. Two ad-hoc `action=health` query endpoints exist: `GET /api/gemini/food-recommendations` (static, `route.ts:859-878`), `POST /api/gemini/itinerary-generator?action=health` (calls Gemini). | `src/app/api/gemini/food-recommendations/route.ts:859-878` |
| **Middleware** | `src/middleware.ts` re-exports `src/middleware/index.ts`. Chain: logger → security → cors → auth. Logger disabled by default (`config.ts:19`). | `middleware.ts:1-22`; `src/middleware/config.ts:17-33` |
| **Mobile token** | `encodeMobileToken`/`decodeMobileToken` use NextAuth JWT with default empty salt (intentional — `getToken` won't accept a custom salt). `MOBILE_TOKEN_MAX_AGE_SECONDS = 900`. | `src/lib/auth/mobileToken.ts:16-62` |

### Corrections to earlier draft claims

| Earlier claim | Corrected |
|---|---|
| "1 of ~25 routes" | 35 `route.ts` files; 1 uses `withAuth`, 18 use `getServerSession`, 16 use other auth or none |
| "every route returns `String(error)`" | Only some. Gemini pipeline has typed `ItineraryError`. Many still leak raw details. |
| "no E2E, no contract tests" | Confirmed. No mobile tests either. |
| "no health endpoint" | No *dedicated* `/api/health`. Two ad-hoc action health endpoints exist. |
| "security headers: none" | Wrong. Headers are **defined** (`securityHeaders.ts:7-40`) and applied globally by the middleware chain (`compose.ts:24,32,44,55`). The 3 auth routes calling `applySecurityHeaders` are redundant. Only static-asset paths (excluded by the middleware `matcher`) get none. |
| "no Redis until traffic justifies it" | Correct today — but the rate limiter's `Map` resets on every cold start, so per-instance limits are already wrong for production. |

## 3. Target architecture
A layered monolith (per ADR-001) with explicit cross-cutting seams. The goal is
not microservices — it is that every request is **authenticated, validated,
logged, rate-limited, observable, and recoverable**, with no route re-implementing
any of those five things.

### 3.1 Request lifecycle (target)

```
request
  → middleware.ts (logger → security → cors → auth)
  → route handler
    → validate(input)            # Zod, one schema per route
    → resolveIdentity()          # web session | mobile JWT | bench token
    → service.execute(input, identity)   # owns DB + external calls
    → mapError(error)            # typed, no raw stack traces
    → response envelope          # consistent shape, no `details: String(error)`
```

### 3.2 Invariants

1. **One auth boundary.** Every mutating or billable route goes through
   `withAuth` (or an explicit public annotation). No route calls
   `getServerSession` directly except the boundary itself.
2. **No route touches the database directly.** Routes call services. Services
   own Supabase clients and error mapping. `supabaseAdmin` is not imported in
   `src/app/api/**`.
3. **Errors are typed.** `AppError` carries `status`, `code`, `retryable`,
   `safeMessage`. Responses never include `String(error)` or stack traces.
4. **Every external call has a timeout and a retry budget.** No unbounded
   `fetch`. No retry without a cap.
5. **Every mutation that can be retried has an idempotency key.** The key is
   part of the request contract, not a header the client invents.
6. **Observability is durable.** Request IDs, RED metrics, and structured
   logs survive cold starts. No in-process-only state that resets.
7. **Security headers are global.** Applied by middleware, not per-route.
8. **Health is real.** `/api/health` checks dependencies cheaply (no Gemini
   generation). The ad-hoc `action=health` endpoints are deprecated.

### 3.3 What we deliberately do NOT do

- No Redis until traffic justifies it (in-memory is correct for a single
  Vercel Hobby instance today).
- No OpenTelemetry until there is a sink to send to.
- No microservices. The monolith is the product; splitting it is a later
  decision with real evidence.

## 4. Roadmap (prioritized by leverage)

### Phase 0: Foundation — do these first, they unblock everything else

#### 0.1 Standardize error handling
- Create `src/lib/errors/AppError.ts` — typed error class with `code`, `statusCode`, `logMessage`, `retryable`.
- Create a single `handleApiError(error, req)` that logs with correlation ID and returns a safe response (never `String(error)`).
- Replace all route try/catch blocks.
- **Verify:** every route returns `{ error: { code, message } }` with no stack traces; one test for each error class.

#### 0.2 Structured logging + correlation IDs
- Add `pino` (or `@logto/next`-compatible) logger; replace all `console.error`/`console.log`.
- Add request ID middleware that sets `x-request-id` header and attaches to every log line.
- **Verify:** run the app, hit an endpoint, confirm JSON log output with `requestId` field.

#### 0.3 RED metrics for every endpoint
- Use `prom-client` or OpenTelemetry; instrument every API route with
  `http_request_duration_seconds` histogram, `http_requests_total` counter,
  `http_request_errors_total` counter.
- Expose `/metrics` endpoint.
- **Verify:** send test traffic, confirm metrics appear with correct labels.

#### 0.4 CI gates that actually block
- Add to `ci.yml`: `npm audit --audit-level=high`, bundle size check
  (`bundlesize` or `@next/bundle-analyzer`), and a smoke test that hits
  `/api/.../health`.
- **Verify:** PR with a critical vuln or oversized bundle fails CI.

#### 0.5 Feature flags
- Add a simple flag system (e.g. Unleash or a local `flags.json` + API) with
  owner and expiry date.
- Gate the multi-agent pipeline behind `USE_MULTI_AGENT` (already env-gated,
  but make it a real flag).

### Phase 1: Architecture — make the boundaries explicit

#### 1.1 Centralize auth across all routes
- **Done** (PRs #501, #502, #503 — branch `feat/centralize-auth-11` + follow-ups). All 18 route files that called `getServerSession` inline now go through `withAuth` (or `withAuthEmail` for the 2 email-keyed routes: `profile`; the refresh route's email log line dropped). **Invariant 1 is now true:** `grep -rl getServerSession src/app/api --include=route.ts | grep -v __tests__` returns **ZERO** — no route calls it directly except the boundary itself.
- Signature decisions (recorded per the ADR slice): `withAuth` handler is `(req, userId, ...ctx)` — dynamic-route handlers receive `{ params }` through the wrapper (Next.js passes it positionally); `withAuthEmail` (new, PR #502) is `(req, { userId, email })` — bench requests get a synthetic non-email sentinel so a bench request can never match a real user's email row.
- `requireRole` wrapper: **not done** — no admin endpoints exist today (verified: no route checks a role). Adding it would be code for a nonexistent consumer.
- One fix beyond the swap: `src/middleware/requestId.ts` `crypto.randomUUID()` → `randomUUID()` from `node:crypto` — jsdom has no `globalThis.crypto`, so any test reaching `getRequestId` without a client id threw (caught by the balance test's 500 path).
- Verified: tsc 0 errors, 507 tests (1 pre-existing emailConfig failure), affected suites 36/36 + 23/23 + 9/9 + 32/32, lint 0 errors, build green, CI `verify` pass on every PR.

#### 1.2 Remove direct `supabaseAdmin` from API routes
- Create service-layer modules in `src/lib/services/` (e.g. `ItineraryService`, `CreditService`, `SpotService`) that own all DB access.
- API routes call the service, not Supabase directly.
- Services use `supabaseAdmin` internally, with RLS-aware paths where applicable.
- **Verify:** `grep -rl supabaseAdmin src/app/api --include=route.ts | grep -v __tests__` returns zero.
- **Note:** `supabaseAdmin` already lives in `src/lib/data/supabaseAdmin.ts` and is imported by 13 route files today.
- **Slice 1 done** (PR #505, `d0f28e0`). `auth/consent` -> `recordTosAcceptance(userId)` in `userService.ts`; `stats` -> `getStats()` in `statsService.ts`. Both services exported from `src/lib/services/index.ts`. `supabaseAdmin` in routes: 13 -> 11.
- **Slice 2 done** (PR #507, `63a2184`, merged `5879272`; re-verified against `main` 2026-09-21). `auth/register` -> `createUserProfile(userId)` in `userService.ts`; `auth/forgot-password` -> `storeResetToken(userId, token, expiry)` in new `passwordService.ts`; `auth/reset-password` -> `findUserByResetToken(token)` / `hashPassword(password)` / `resetPassword(userId, hash)` in `passwordService.ts`. Forgot/reset tests rewritten to mock the service boundary. In-slice fixes: all forgot/reset error paths wrapped with `applySecurityHeaders`; unused `bcrypt` import dropped from the reset route. `supabaseAdmin` in routes: 11 -> 8.
- **Slice 3a done** (PR #509, `6701be2`, merged `557c333`; re-verified against `main` 2026-09-21). `saved-meals` -> `listMeals` / `createMeal`, `saved-meals/[id]` -> `getMealById` / `deleteMealById` (new `mealService.ts`, incl. `MealDbError` preserving the GET detailed-500 wire shape and the 404-indistinguishability on `[id]`); `profile` -> `getProfileByEmail` / `updateProfileByEmail` (new `profileService.ts`; sanitization/validation stays in the route). New route suites for saved-meals (6) and `[id]` (5) — meals had zero tests; profile's 9 no-op placeholder asserts rewritten as 7 real tests. Net +9 tests (504 -> 513). `supabaseAdmin` in routes: 8 -> 5.
- **Slice 3b done** (PR #511, `72ed57b`, merged `429991c`; re-verified against `main` 2026-09-21). `saved-itineraries` -> `listItineraries` / `createItinerary`, `saved-itineraries/[id]` -> `getItineraryById` / `updateItineraryById` / `deleteItineraryById` (new `itineraryService.ts`). Zod validation, image resolution, `toDbPayload` mapping, and `mapRowToSavedItinerary` stay in the route/mapper (request-shape and presentation concerns). Both suites rewritten to mock the service boundary, all 18 behavior cases preserved (tampering guard, legacy JSON rows, null-clearing, empty-list regression) plus one new GET-500 case; revert-check proved the new tests fail 8/11 against the old routes. Net +1 test (513 -> 514). `supabaseAdmin` in routes: 5 -> 3.
- **Slice 3c done — 1.2 CLOSED** (PR #513, `133d5b9`, merged `6b542bf`; re-verified against `main` 2026-09-21). `credits/diagnostics`, `credits/init-profile`, `credits/test-consumption` -> new `creditDiagnostics.ts` probes (`checkTableExists`, `getUserProfileRow`, `checkConsumeCreditsFunction`, `getRecentTransactions`, `consumeTestCredit`) + `userProfileExists`/`createUserProfile` in `userService.ts` (kills the 3rd copy of the default-profile insert). Deliberately NOT extended: `referral-system/CreditService` money paths — debug routes need raw RPC outcomes incl. failure branches the domain layer throws on. 3 new route suites (13 tests; these routes had zero coverage); revert-check 9/13 fail against old routes. Net +13 tests (514 -> 527). `supabaseAdmin` in routes: 3 -> 0. **Invariant 2 now holds.**
- Remaining: none. Follow-up (not in scope): unify `CreditService.ensureUserProfile` (4th copy of the default-profile insert) onto `userService.createUserProfile`.

#### 1.3 Bounded contexts
- Current folder structure is by capability (`auth`, `data`, `search`, `security`, `traffic`). Evolve toward domain-oriented modules:
  - `itinerary/` — generation, retrieval, composition, saved trips
  - `users/` — auth, credits, referrals, profiles
  - `places/` — spots, routes, traffic, weather
- Keep the monolith; the boundary is module ownership, not microservices.
- **Verify:** no circular dependencies between the three contexts (use `dependency-cruiser` or `madge`).

#### 1.4 API versioning
- Add `/api/v1/` prefix; move existing routes under it.
- Add deprecation headers (`Sunset`, `Deprecation`) for future removal.
- **Verify:** all client calls (web + mobile) point to `/api/v1/`.

#### 1.5 ADRs for the 5 load-bearing decisions
- **Done** (PR #498, `0ad1c6d`): 5 ADRs in `docs/adr/` (003–007) — 003 multi-agent pipeline behind a flag, 004 credit-based gating, 005 mobile local-first kill-gate, 006 Supabase as source of truth, 007 Vercel serverless (Hobby).
- Continuing the existing `002-*.md` convention: heading style, Deciders field, Status/Context/Decision/Alternatives/Consequences, revisit triggers, related records. All 5 verified present.
- These record the decisions 1.1–1.4 depend on (which routes need email vs id, where the service layer lives when `CreditService` already exists in `referral-system/`, how mobile migrates to `/api/v1/`) so those become mechanical execution, not judgment calls made mid-refactor.

### Phase 2: Reliability — make failure modes explicit and handled

#### 2.1 Retry with exponential backoff for all external calls
- Gemini, TomTom, OpenWeather, image enrichment — all need retry wrappers.
- Zero-dep `withRetry` helper created at `src/lib/upstream/withRetry.ts`: exponential backoff + full jitter, composes with `withTimeout`, `AppError.retryable` drives skip/no-retry decisions, wraps raw errors to `AppError(UPSTREAM)` on exhaustion. 15 tests in `__tests__/withRetry.test.ts`.
- **Slice 1 done:** `food-recommendations/route.ts` inline retry loop replaced with `withRetry` call (2 attempts, 30s timeout, 1s fixed delay preserved). Uses `AppError.retryable` classification instead of the old `maxRetries` constant.
- **Slice 2 done:** `ErrorHandler.withRetry` (Gemini pipeline, `itinerary-generator/lib/errorHandler.ts`) — the hand-rolled backoff loop replaced with a delegation to the shared helper; classification/stats/`ItineraryError` contract preserved (see §9 Phase 2 table for the full record).
- **Live Gemini sites complete:** all live `generateContent` call sites now compose `withRetry` with dependency budgets; `itineraryUtils.ensureFullItinerary` is dead code and was deliberately not touched.
- **Verify:** unit test that a flaky upstream is retried N times before failing; integration test that succeeds after 2 retries.

#### 2.2 Timeouts on every external call
- Add `AbortController` with configurable timeout per dependency.
- Surface timeout as a typed `UpstreamTimeoutError`.
- **Verify:** test that a hung upstream returns 503 after the timeout, not 500 after Vercel's 60s kill.
- **Slice 1 done** (PR #515, `83bb797`, merged `389c2f5`; re-verified against `main` 2026-09-21). New `src/lib/upstream/withTimeout.ts`: `UpstreamTimeoutError` (AppError UPSTREAM, 503, retryable) + `withTimeout()` for SDK calls + `fetchWithTimeout()` for fetch calls. Wired 3 sites: `fetchWeatherData` (8s budget; caller already falls back), `tomtomTraffic.getTrafficIncidentsSimple` (the one TomTom fetch missing a signal; sibling `config.timeout` budget), `agent.ts` subquery race (same 25s, same `[]` fallback — zero behavior change). Deliberately NOT touched: `tomtomRouting`/`imageService` (already budgeted). 8 new helper tests. Full suite 527 -> 535. **Subsequently replaced by `withRetry` (2.1 slice 1):** the food-route inline retry loop (30 lines) was refactored to use `withRetry` with `timeoutMs: 30000` — see §8.5 correction #24.
- **Slice 2b done** (2026-09-22). Remaining Gemini `generateContent` sites wired onto shared `withRetry` + `timeoutMs`:
  - `responseHandler.generateItinerary` — hand-rolled `Promise.race` + retry loop replaced with `withRetry` (`timeoutMs: 25000`, `jitter: 'none'`, 2 attempts, 1s fixed delay, only Gemini 503/429 retried; `UpstreamTimeoutError` thrown as-is so the route's `handleError` still sees `.status === 503` → TIMEOUT). **Killed a real timer leak**: the old race's `setTimeout` was never cleared, keeping the serverless invocation alive past the budget; `withTimeout` clears in `finally`. Raw `.status` preserved via closure capture — the shared helper's `AppError(UPSTREAM)` exhaustion wrapper erases `.status` (503→TIMEOUT would become 500→UNKNOWN).
  - `structuredOutputEngine.generateStructuredItinerary` — per-attempt race + retry loop replaced with `withRetry` (`timeoutMs: 25000`, `maxDelayMs: 5000` = the old `min(1000*2^(n-1), 5000)` cap, `jitter: 'none'`, catch-all retry preserved via `shouldRetry: () => !signal?.aborted`). Fallback-return contract preserved. Also killed the per-attempt abort-listener leak (listener added per attempt, removed only on success).
  - `guaranteedJsonEngine.generateWithStrictJson` — timer handle captured + `clearTimeout` after the race. **Killed a real bug**: on success the stale timer fired at TIMEOUT_MS calling `controls?.abort?.()`, aborting the strategy after a successful generation.
  - `itineraryUtils.ensureFullItinerary` — **DEAD CODE, deliberately NOT touched.** Zero callers (internal or external, verified 2026-09-22: only its own declaration matches). Flagged for deletion follow-up.
- Verified: `npx tsx specs/smoke-responsehandler-timeout.mjs` → SMOKE OK (14 checks); `npx tsx specs/smoke-structured-engine.mjs` → SMOKE OK (fallback-return, catch-all retry, fixed delay, abort → no retry); tsc 0 errors; full suite 550 passed / 6 skipped / 0 failed; lint clean; agent suites 20/20.

#### 2.3 Idempotency keys on all mutations
- Every write endpoint (save itinerary, consume credits, create meal, etc.) must accept an `Idempotency-Key` header.
- Store keys in an `idempotency_keys` table with TTL; return cached response on replay.
- **Verify:** concurrency test that double-submits the same request and confirms exactly one write.

#### 2.4 Shared rate limiting
- Replace in-memory `rateLimiter` with Redis-backed store (e.g. `@upstash/ratelimit`).
- Configure per-endpoint limits: auth (10/15min), generation (5/min), general (100/min).
- **Verify:** two concurrent serverless invocations see the same counter.

#### 2.5 Error budget + rollback policy
- Define SLO: 99.5% over 30 days.
- Write `docs/rollback.md` — when to roll back, how to roll back (feature flag or Vercel rollback).

### Phase 3: Security — close the OWASP gaps

#### 3.1 Security headers
- **Already done, mostly.** `securityHeaders.ts:7-40` defines CSP, HSTS,
  X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy,
  and `compose.ts:24,32,44,55` applies them on every middleware response.
- The 3 auth routes that also call `applySecurityHeaders` are redundant —
  **removed** (2026-09-22): 24 wrapper calls + 3 now-unused imports deleted
  from `forgot-password`, `register`, `reset-password` (mechanical
  `applySecurityHeaders(X)` → `X` via ast_edit). `applySecurityHeaders` uses
  `headers.set()` (idempotent — no duplicate-header risk), and the root
  `middleware.ts` matcher covers `/api/*`, so every API response still gets
  headers from the middleware chain. `grep -rn applySecurityHeaders
  src/app/api --include=route.ts | grep -v __tests__` → zero.
- Residual gap (real but small): only paths the middleware `matcher` excludes
  (static assets) get no headers. That is non-security-relevant.
- **Verify:** `curl -I` on 5 representative routes shows all headers; Lighthouse
  security audit is green.
- **Verified (this slice):** tsc 0 errors; auth suites 52/52; full suite 550
  passed / 6 skipped / 0 failed; lint clean.

- **Decision recorded (2026-09-26, fate of the §3.2 guard): CLOSE as decided-no-wire-target — wiring `isSafeUrl` is rejected, not deferred.** Adversarial review (Osmani, STRIDE-lite over all 16 server-side `fetch(` sites) found no attacker-controlled fetch authority anywhere: `imageService` fetches hardcoded hosts (`maps.googleapis.com`, `api.unsplash.com`, `en.wikipedia.org`; request values are `encodeURIComponent` query data, never authority); `tomtomTraffic`/`tomtomRouting` use hardcoded `https://api.tomtom.com` with numeric lat/lon params; `health` uses deploy-time `NEXT_PUBLIC_SUPABASE_URL` + hardcoded TomTom; `refresh` uses `getBaseUrl()` (`NEXTAUTH_URL`/`VERCEL_URL`/`VERCEL_BRANCH_URL`/localhost) with a hardcoded path. No route accepts a user-supplied fetch URL (`saved-meals` `image` is stored + client-rendered, never server-fetched). Wiring the guard into these paths would be theater + a DNS-lookup latency tax on every call with zero security gain. Revisit trigger (reopens 3.2): any future route/server helper that fetches a request-derived URL MUST gate it with `isSafeUrl` (allowlist + DNS rejection) before `fetch`, with a rejection test for `http://169.254.169.254/latest/meta-data/`.
- Any route that fetches a user-supplied URL (none currently, but the pattern
  exists in image resolution) must validate against an allowlist and resolve
  DNS to reject private IPs.
- **Verify:** test that a request to `http://169.254.169.254/latest/meta-data/`
  is rejected.
- Guard in place for that future surface: `src/lib/security/ssrf.ts` `isSafeUrl` (PR #606 `7e8e3e3`) + `__tests__/ssrf.test.ts` (12 tests incl. metadata-endpoint rejection).

#### 3.3 Dependency audit gate
- `npm audit --audit-level=high` already planned in Phase 0.4; add `pnpm audit`
  signatures for provenance.
- **Verify:** a PR that adds a vulnerable dependency fails CI.

#### 3.4 RLS audit
- Verify that every table accessed by the anon client has proper RLS policies.
- The migration `20260919000000_saved_meals_rls_remediation.sql` is a good start;
  audit the rest.
- **Verify:** run `prove-revoke-anon.mjs` and `prove-saved-meals-rls.mjs` against staging.

### Phase 4: Testing — from unit to continuous verification

#### 4.1 E2E tests
- Use Playwright or Cypress (neither is in `devDependencies` today — add it).
- Cover: signup → login → generate itinerary → save → view in dashboard.
- Run in CI on every PR.
- **Verify:** E2E suite passes in CI; failing E2E blocks merge.

#### 4.2 Contract tests
- For each API route, validate request/response against the Zod schema in a test.
- Use `@stoplight/spectral` or manual schema validation.
- **Verify:** a breaking change to a route's response shape fails the contract test.

#### 4.3 Mobile tests
- Add Jest with `@testing-library/react-native` for the Expo app.
- Cover: auth flow, SQLite CRUD, plan form validation.
- Run in CI alongside web tests.
- **Verify:** `tarana-mobile` has its own test job in CI.

#### 4.4 Fix the failing test
- **Done** (2026-09-21). `emailConfig.test.ts` `mockEnv` helper spread `process.env` first, so the ambient `SMTP_FROM_EMAIL` (set in `.env`/`.env.local`) won over the test's expectation of the `fromEmail -> SMTP_USER` fallback. Fix: strip `SMTP_FROM_EMAIL` in the spread before applying test vars. Source default untouched, per this section's original instruction.
- **Verify:** `pnpm test` is 100% green.
- **Verified:** emailConfig 9/9; full suite **550 passed, 6 skipped, 0 failed** — first 100% green run (was 549 passed, 1 failed).

### Phase 5: Observability — from counters to actionable telemetry

#### 5.1 Structured logs everywhere
- Already planned in Phase 0.2; extend to include `entryPoint` field for every
  log source (scheduler, webhook, CLI, API).
- **Verify:** `grep -rn console.log src --include=*.ts | grep -v __tests__` returns zero.

#### 5.2 Tracing
- Add OpenTelemetry with auto-instrumentation for HTTP, Supabase, and external
  fetches.
- Sample 1% of requests; keep 100% of errors.
- **Verify:** a single request can be followed from API route → Supabase → Gemini
  in the tracing UI.

#### 5.3 Alerting with runbooks
- Create 3 symptom-based alerts: error rate >1% for 5min, p95 latency >2s,
  refund failure rate >5%.
- Write a 3-line runbook for each in `docs/runbooks/`.
- **Verify:** each alert is test-fired in staging and reaches the right channel.

#### 5.4 Health checks
- Add `GET /api/health` that checks Supabase connectivity, Gemini API key
  validity, and TomTom API reachability.
- **Verify:** `curl /api/health` returns 200 with `{ status: 'ok', checks: {...} }`.

### Phase 6: Performance — measure, don't guess

#### 6.1 Core Web Vitals monitoring
- Add `web-vitals` to the web app; report to your metrics backend.
- Set budgets: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1.
- **Verify:** Lighthouse CI runs on every PR and fails if budgets are exceeded.

#### 6.2 Bundle size budget
- Add `@next/bundle-analyzer`; fail PR if First Load JS increases by >10%.
- **Verify:** a PR that adds 50KB to the bundle fails CI.

#### 6.3 Database query profiling
- Add query timing logs for the top 10 most-called queries.
- Identify N+1 patterns (e.g. fetching activities one-by-one in
  `retrievalStrategistAgent.ts`).
- **Verify:** `EXPLAIN ANALYZE` shows no sequential scans on hot paths.

### Phase 7: Mobile — from prototype to product

#### 7.1 Implement or remove the local AI stub
- Either integrate a GGUF model (llama.cpp / Core ML) and validate output
  quality, or remove the Plan screen from the shipped app.
- **Verify:** `generateItinerary` returns a real itinerary, not a thrown error.

#### 7.2 EAS build + store submission
- Add `eas.json`, configure build profiles for iOS and Android.
- Run `eas build` in CI; submit to TestFlight and Google Play Internal Testing.
- **Verify:** a successful EAS build produces `.apk` and `.ipa` artifacts.

#### 7.3 Mobile test suite
- Add Jest + `@testing-library/react-native` for the Expo app.
- Cover: auth flow, SQLite CRUD, plan form validation.
- Run in CI alongside web tests.
- **Verify:** `tarana-mobile` has its own test job in CI.

#### 7.4 Offline support
- Verify the app works in airplane mode for: profile, saved trips, spots list.
- Stale-badge pattern for cached data.
- **Verify:** test with airplane mode on; core screens render without network.

---

### Priority order (what to do this quarter)

| Priority | Item | Effort | Impact |
|---|---|---|---|
| P0 | Standardized error handling | 2 days | Every route becomes safe to operate |
| P0 | Structured logging + correlation IDs | 2 days | Any production issue becomes diagnosable |
| P0 | RED metrics + health endpoint | 3 days | You can see the system from outside |
| P0 | CI gates: audit, bundle size, E2E | 3 days | Blocks bad changes before merge |
| P1 | Centralize auth (withAuth everywhere) | 3 days | Removes 18 duplicated auth blocks |
| P1 | Remove direct supabaseAdmin from routes | 5 days | Clean service boundary |
| P1 | Retry + timeout wrappers | 3 days | External dependencies stop killing requests |
| P1 | Shared rate limiting (Redis) | 2 days | Rate limiting survives cold starts |
| P2 | ADRs for the 5 load-bearing decisions | 3 days | Future agents don't re-decide |
| P2 | Security headers + SSRF protection | 2 days | OWASP compliance |
| P2 | Idempotency keys on all mutations | 5 days | No double-charges, no duplicate writes |
| P2 | E2E + contract tests | 5 days | Catch regressions before users |
| P3 | Feature flags + rollback policy | 3 days | Every deploy becomes reversible |
| P3 | Mobile: local AI or remove Plan screen | 2 weeks | Mobile stops being a lie |
| P3 | Mobile: EAS build + tests | 2 weeks | Mobile becomes shippable |

---

### What I'd do tomorrow

1. **Phase 0.2 first — structured logging + correlation IDs.** Zero-dep,
   touches only middleware. It is the prerequisite for 0.1 (the error handler
   logs with correlation ID) and the prerequisite for 0.3 (metrics are
   correlated through the same request ID). One slice, unblocks two others.
2. **Phase 0.1 — `AppError` + `handleApiError`.** Built on top of the logger
   from step 1. Convert the 3 routes currently returning `String(error)`.
3. **Phase 0.3 — RED metrics.** `prom-client` is not installed; add it. Start
   with the 5 most-called endpoints. Not blocked on 0.2.
4. **Phase 0.4 — CI gates.** `npm audit --audit-level=high`, bundle size,
   health-check smoke test. Independent of 1–3; can run in parallel.
5. **Write ADR-001** — why layered monolith, not microservices.

These five things, done in one week, transform the system from "I hope it works"
to "I can see it working."

---

1. **Phase 0.2 (logger + correlation IDs) must land before Phase 0.1 (errors)
   can be considered complete — the dependency is the reverse of what the
   earlier draft said.** `handleApiError(error, req)`'s own acceptance
   criterion is "logs with correlation ID". Correlation IDs are a 0.2
   deliverable. Building 0.1 first means writing a throwaway logger inside
   the error handler and replacing it in 0.2 — waste. Build them as one
   vertical slice: logger middleware → `AppError` → `handleApiError` →
   convert the 3 `String(error)` routes. The logger goes first because 0.1
   consumes it.
2. **Phase 0.3 (metrics) does NOT hard-depend on 0.2.** `prom-client` has its
   own registry and `/metrics` endpoint; routes can be instrumented directly
   without any logger. The earlier note overstated this. Prefer emitting
   metric events through the logger for correlation, but do not block 0.3 on
   0.2. The real prerequisite for 0.3 is knowing which endpoints exist — which
   the route inventory (§2) already provides.
3. **Phase 1.1 (auth centralization) must be a pure wrapper swap, not a rewrite.**
   `withAuth` already resolves the same identity (`getServerSession` + bench
   bypass) that 18 routes duplicate inline. Wrapping is safe; rewriting the
   session model is not.
4. **Phase 1.2 (services) must not move the `supabaseAdmin` import out of
   `src/lib/data/`.** The invariant is "routes don't import it", not "the file
   moves". Moving the file would silently break the 13 existing importers and
   the test mocks that key on the path.
5. **Phase 2.4 (Redis) is a store swap, not a rewrite.** The `InMemoryRateLimiter`
   interface (`checkRateLimit(request, config, key)`) is stable. Replace the
   `Map` backend behind that interface. Same for 2.1's retry helper.
6. **Phase 4.4 (emailConfig test) is a test-only fix.** Do not touch
   `emailConfig.ts`. The source default is correct; the test's env handling is
   the bug.
7. **Never Phase 7 before Phase 0.** Mobile local AI is a product decision, not

---

## 8. Audit (2026-09-20)

This section records the findings of the verification pass and what was changed
as a result. Every row was re-checked against the working tree.

### 8.1 Claims re-verified

| # | Claim | Verdict |
|---|---|---|
| 1 | 35 `route.ts` + 1 extensionless cron route | **Verified** |
| 2 | 18 routes call `getServerSession` directly | **Verified** |
| 3 | 1 route uses `withAuth` | **Verified** |
| 4 | `supabaseAdmin` imported by 13 route files | **Verified** |
| 5 | `saved-itineraries/route.ts:33-37` returns `String(error)` | **Verified** |
| 6 | `ItineraryError`/`ErrorHandler` only in Gemini pipeline | **Verified** |
| 7 | `refundMetrics` is in-process, reads-and-resets on cold start | **Verified** |
| 8 | Rate limiter is a single-instance `Map` | **Verified** |
| 9 | CI has 4 gates, no audit/security/mobile check | **Verified** |
| 10 | 63 suites pass, 1 fails at `emailConfig.test.ts:78` | **Verified** (`pnpm test`: 1 failed, 8 skipped, 499 passed) |
| 11 | 2 ADRs in `docs/adr/` | **Verified** |
| 12 | `generateItinerary` is a `Promise<never>` stub | **Verified** |
| 13 | No `eas.json`, no E2E tooling | **Verified** |
| 14 | No dedicated `/api/health`; 2 ad-hoc `action=health` endpoints | **Verified** |
| 15 | Middleware chain: logger → security → cors → auth; logger disabled | **Verified** |
| 16 | Mobile token uses default empty salt, max age 900s | **Verified** |
| 17 | Security headers: none | **FALSE — corrected** |
| 18 | 16 routes use "other auth or none" | **Partially false — corrected** |
| 19 | `prove-revoke-anon.mjs` / `prove-saved-meals-rls.mjs` exist at repo root | **Verified** (in `scripts/`) |
| 20 | RLS migration `20260919000000_saved_meals_rls_remediation.sql` exists | **Verified** |

### 8.2 Corrections applied

**17. Security headers were not missing.**
The draft claimed "none". `compose.ts:24,32,44,55` applies `applySecurityHeaders`
on every middleware response. The 3 auth routes calling it are redundant.
Corrected in §2 row 17, §2 corrections table, and §3.1.

**18. Auth boundary arithmetic was wrong.**
The draft said "16 use other auth or none". The actual split is 18
`getServerSession` + 1 `withAuth` + 1 `[...nextauth]` (authOptions only) + 15
with no auth import. Corrected in §2 row 12.

**19. `prove-*.mjs` scripts are in `scripts/`, not repo root.**
The plan's verification command for §3.4 should be
`node scripts/prove-revoke-anon.mjs`. Path corrected in §3.4.

### 8.3 Corrections applied in the second pass (2026-09-20)

**20. Sequencing rules 1 and 2 were backwards.**
The original rules said "0.1 (errors) before 0.2 (logging)" and "0.3 (metrics)
depends on 0.2". Both are wrong.

- 0.1's acceptance criterion is "logs with correlation ID" — correlation IDs
  are a 0.2 deliverable. Building 0.1 first means writing a throwaway logger
  inside the error handler and replacing it in 0.2.
- 0.3 does not hard-depend on 0.2. `prom-client` has its own registry and
  `/metrics` endpoint; routes can be instrumented directly.

Corrected in §7 rules 1–2 and in "What I'd do tomorrow". The correct shape is a
single vertical slice: logger → `AppError` → `handleApiError` → convert the
3 `String(error)` routes. 0.3 runs independently after.

**21. `prom-client` is not installed.**
0.3 requires adding it as a dependency. Noted in "What I'd do tomorrow" step 3.

**22. Only 3 routes leak `String(error)`, not 25+.**
The draft's "Replace all 25+ route try/catch blocks" overstates the scope.
27 routes have try/catch; 3 return `String(error)`. Corrected in 0.1.

**23. No shared error/response helper exists.**
`handleApiError`, `apiError`, `errorResponse`, `toApiError` — all absent.
0.1 is building from scratch, not consolidating. The only typed error model in
the repo is `ItineraryError` inside the Gemini pipeline (`errorHandler.ts:13`),
which is the reference shape to extend.

### 8.5 Corrections applied in the third pass (2026-09-21)

**24. Phase 2.1 retry helper is now implemented.**
The plan's §9 Phase 2 table listed 2.1 as `[ ]` ("No `withRetry` helper; needs timeout
semantics first"). The timeout semantics (2.2 slice 1) were already done, so the
sequence was correct — retry was built on top of `withTimeout`. New file
`src/lib/upstream/withRetry.ts` provides a zero-dep exponential-backoff retry with
full jitter; composes with `withTimeout` via `timeoutMs`/`upstream` options. 15
tests in `__tests__/withRetry.test.ts`. The `food-recommendations/route.ts` inline
retry loop (30 lines) was replaced with a single `withRetry` call. Raw errors are
wrapped in `AppError` (UPSTREAM) on exhaustion for consistent downstream handling.
Verification: tsc 0 errors, 15/15 focused tests pass, 8/8 timeout tests still pass,
full suite 549 passed (was 535; +14 net new tests), lint clean, runtime smoke OK.

**25. §2 row 4 (`supabaseAdmin` imported by 13 route files) is still the historical
baseline snapshot** — the count is now 0 as of 2.1 slice 3c (line 541), but §2
records the state at audit time (2026-09-20), not current state.

**26. §2 row 18 (`getServerSession` arithmetic was wrong) — corrected.**
The original draft said "16 use other auth or none". The actual split at audit time
was 18 `getServerSession` + 1 `withAuth` + 1 `[...nextauth]` (authOptions only) +
15 with no auth import. This is now moot: all 18 were migrated to `withAuth` in
Phase 1.1, and `grep -rl getServerSession src/app/api --include=route.ts | grep -v
__tests__` returns zero on `main` 2026-09-21.

**27. §2 row 4 (`supabaseAdmin` imported by 13 route files) — now 0.**
Phase 1.2 slice 3c completed the migration: `supabaseAdmin` in route files: 3 → 0.
Invariant 2 holds. Remaining 4th copy of default-profile insert lives in
`CreditService.ensureUserProfile` (referral-system) — out of scope per the plan's
explicit note.

**28. §8.4 item 3 ("No code was modified") is now superseded.**
The 2026-09-20 audit was document-only. On 2026-09-21, the Phase 2.1 retry helper
was implemented (§8.5 correction #24 above).

**29. §2 row 12 — auth boundary arithmetic update for 2026-09-21.**
`grep -rl getServerSession src/app/api --include=route.ts | grep -v __tests__` =
**0** (was 18 at audit). 19 route files now go through `withAuth`/`withAuthEmail`.
`String(error)` in `route.ts` files = **0** (was 3 at audit).
`supabaseAdmin` in route files = **0** (was 13 at audit).

**30. §2 row 13 — error handling status update (2026-09-23).**
`String(error)` response-body leaks: **0** in route files (was 3 at audit, in
`saved-itineraries` and `saved-meals`). The 2 remaining `String(error)` instances
in `gemini/itinerary-generator/lib/*.ts` are `console.warn` calls inside template
literals (logging, not response bodies) — not in scope for Phase 0.1 which targeted
route response bodies only. **Additional fix (2026-09-23):** 6 routes that leaked
`error.message`/`.details`/`.hint`/`.code` into response bodies were converted to
`handleApiError`: `locations/search`, `referrals/validate`, `routes/calculate`,
`tiers/all`, `saved-meals` (GET MealDbError path), `gemini/itinerary-generator`
(POST catch + multi-agent catch). Response envelope stays `{ error: string }`.
`itinerary-generator` preserves 401 auth and 402 InsufficientCreditsError handlers.
New regression test `src/app/api/safeError.boundary.test.ts` (3 tests) injects a
sentinel string into mock rejections and asserts it never appears in the response.
Full suite: 553 passed, 6 skipped, 0 failed. tsc 0 errors. Build green.
**31. §2 row 7 — refundMetrics still in-process.**
Confirmed unchanged: `refundMetrics.ts:28-47` counters are still module-level,
`takeRefundSnapshot` still reads-and-resets on cold start. Phase 5.3 (durable
metrics) is still needed.

**32. §2 row 18 — `emailConfig.test.ts:78` failure is fixed as of 2026-09-22.**
PR #518 (`6fef869`) makes `mockEnv` strip `SMTP_FROM_EMAIL` before applying
test variables, without changing the source default. Full suite: 550 passed,
6 skipped, 0 failed — the first 100% green run.

### 8.4 Findings that do NOT change the plan (2026-09-20)

- **CORS `Access-Control-Allow-Origin: *` claim.** Not re-verified (no running
  server). Code allowlist (`cors.ts:4-15`) is correct and does not emit `*`.
  Left as an open item for the implementer.
- **The adversarial review did not complete.** A fresh-context reviewer was
  spawned per the doubt-driven skill, stalled, and was cancelled. No
  independent findings were produced. This audit is single-model.
- **No code was modified during the 2026-09-20 audit.** Document-only pass.
  The 2026-09-21 pass implemented Phase 2.1 (§8.5). The 2026-09-23 pass implemented
  Phase 0.1a-2 (6 routes converted off `error.message`/`details` leakage + regression test).


### Phase 5: Observability (status re-verified against `main` 2026-09-24)

| Status | # | Item | Evidence |
|---|---|---|---|
| [x] | 5.1 | Structured logs everywhere | Complete: production route slices through PR #587, the authenticated cron endpoint, and `refreshScheduler.ts` are converted; the unused unauthenticated `routes/monitor` placeholder is removed. Remaining `console.*` inventory is limited to standalone test/diagnostic utilities outside production runtime paths. |
| [ ] | 5.2 | Tracing | No OpenTelemetry instrumentation. |
| [ ] | 5.3 | Alerting with runbooks | No symptom alerts or `docs/runbooks/` entries. |
| [x] | 5.4 | Health checks | **Done — verified live 2026-09-24** (no code change this slice). `src/app/api/health/route.ts` per §3.2 invariant 8: connection-level checks only, 3s per-dependency timeout, unhealthy dependency returns 200 with `status: 'degraded'` rather than failing the request. Live probe on a fresh `next dev` (`:3111`): cold 200 in 5.6s (3.7s of that is first-hit route compile), warm 1014ms then 419ms; body `{"status":"ok","checks":{"supabase":"ok","geminiKey":"ok","tomtom":"ok"}}` on all three calls. Gemini check is key-presence, not generation — a monitoring probe must not cost money. |

## 9. Implementation Status (re-verified 2026-09-23)
Markers follow the `✅ Done` convention used in `specs/tarana-mobile-app-plan.md`.
Each row records what shipped, the verification that ran, and the commit-style
evidence. Items without a marker are **not done** — do not assume they are.

### Phase 0: Foundation

| Status | # | Item | Evidence |
|---|---|---|---|
| [x] | 0.2 | Structured logging + correlation IDs | `src/lib/observability/logger.ts` (zero-dep JSON, `process.stdout/stderr.write`, no `console.*`); `src/middleware/requestId.ts` (`getRequestId`, `requestIdMiddleware`, priority 110); wired into `src/middleware/index.ts`. Verified: `bun run specs/smoke-logger.mjs` → SMOKE OK; live `curl` on a fresh dev instance. |
| [x] | 0.2a | Logger is zero-dep (no `pino` added to lockfile) | `grep -c pino pnpm-lock.yaml` = 0. Chose a hand-rolled logger over `pino` to avoid a new dependency + lockfile churn; matches the existing zero-dep convention in `refundMetrics.ts`. |
| [x] | 0.1 | Standardized error handling (`AppError` + `handleApiError`) | **Implemented + verified** (PR #489, `f46ba51`). `src/lib/errors/AppError.ts` (code, status, safeMessage, retryable, logMessage + `fromUnknown()` classifier) and `src/lib/errors/handleApiError.ts` (logs via the 0.2 logger with correlation ID, classifies rate-limit→429 / timeout→503 / not-authorized→401 / not-found→404) are wired into all converted routes. Response envelope stays `{ error: string }` — the plan's original `{ error: { code, message } }` would break `savedItineraries.ts:91-92` and `supabaseMeals.ts:26`, both of which read `body.error` as a string. Verified: tsc clean, full suite green, lint clean, build green, runtime smoke 21/21. |
| [x] | 0.1a | Convert routes off `String(error)` — initial 3 files | 7 leaks across 3 files eliminated: `saved-itineraries/route.ts` (2), `saved-itineraries/[id]/route.ts` (3), `saved-meals/route.ts` (2). All now route through `handleApiError` (PR #489), which logs with the correlation ID and returns `{ error: 'Internal server error' }`. Verified: `grep -rn "String(error)" src/app/api --include=route.ts` → zero. |
| [x] | 0.1a-2 | Convert routes off `error.message`/`details` leakage — additional 6 files | 6 more routes had raw `error.message` / `error.details` / `error.stack` in response bodies (the original audit found `String(error)` literal gone, but `error.message`/`.details`/`.hint`/`.code` remained). Converted: `locations/search`, `referrals/validate`, `routes/calculate`, `tiers/all`, `saved-meals` (GET MealDbError path), `gemini/itinerary-generator` (POST catch + multi-agent catch). All now use `handleApiError` or safe hardcoded messages. `itinerary-generator` preserves 401 auth and 402 InsufficientCreditsError handlers. New regression test `src/app/api/safeError.boundary.test.ts` injects a sentinel string into mock rejections and asserts it never appears in the response body. Verified: `grep -rn "\.message\|\.details\|\.stack\|\.hint\|\.code" src/app/api/**/route.ts | grep -v handleApiError` returns only intentional Zod validation `details` fields; full suite 553 passed / 6 skipped / 0 failed; tsc 0 errors; build green. |
| [x] | 0.4a | Dependency audit gate (critical level) | **Implemented + verified** (PR #491, `64138d8` + `ad6ad4d`). `pnpm audit --audit-level=critical --prod` added to `ci.yml` as a blocking step. Sequencing correction: the gate landed **after** the 3 criticals were patched, because adding it first would have made main unmergeable on every PR. The criticals — `next-auth` 4.24.14→4.24.15 (homoglyph `@` bypass), `next` 15.5.15→15.5.25 (2× unauthenticated RCE: Windows-hosted + Image Optimization/AVIF) — are gone; `nodemailer` 7.0.13→9.1.1 (quadratic `addressparser` DoS) also patched. Verified: tsc 0 errors, 499 tests, build green, gate passes in CI (`verify` 2m45s). Scoped to critical, not high: pnpm scans all workspace prod trees and reports 20 transitive highs (`sharp` via `next`, `js-yaml` via expo/jest) I don't directly control — a high-level gate would fail every PR. The highs are a follow-up backlog. |
| [x] | 0.3 | RED metrics (zero-dep) | **Done** (PRs #533 + #534 + #535 + #536 + #537 + #538). Deliberately NOT `prom-client` (zero-dep convention per `logger.ts`/`withRetry`/flags — no new dependency, no lockfile churn). `src/lib/observability/httpMetrics.ts`: `observeHttp` accumulator + `timedHttp` wrapper + Prometheus text exposition, labels bounded to method/route(`static template`)/status_class, fixed buckets [0.05..5]. `GET /api/metrics` exposes counters + histogram (7 core + 2 route tests). Batch 2 (3 PRs, 2026-09-23) wrapped the remaining instrumentable routes in `timedHttp` with static templates — handler bodies unchanged, responses returned verbatim, auth/validation/error/rate-limit paths untouched. **Verified count: 34/37 routes instrumented** (Python `Path.rglob` — shell `find` mangled bracket paths and reported 30). Excluded 3, all self-referential: `metrics` (renders the exposition it would measure), `stats` (reads the metrics it would measure), `auth[...nextauth]` (NextAuth handler, `authOptions` only). `docs/slo.md` sourcing updated to live metrics. |
| [x] | 0.4 | CI gates (audit, bundle size, health smoke) | **Implemented + verified** (PR #493, `82c9d08`). Audit gate shipped in 0.4a (PR #491). Bundle budget gate: `scripts/check-bundle-budget.mjs` parses the real build output (`.next/app-build-manifest.json`, not the locale-dependent terminal table) and fails >10% First Load JS regression against `scripts/bundle-baseline.json` (62 routes, recorded fresh). Health smoke: boots the built app in CI and hits `/api/health` (10-attempt retry) — CI now proves the build serves, closing the gap where a build that compiles but crashes on boot would pass. `/api/health/route.ts` per §3.2 invariant 8: Supabase REST + Gemini key-presence (not generation — a probe that calls the model costs money) + TomTom flow probe, each with its own 3s timeout; unhealthy dependency returns 200 with `status: 'degraded'` (a state, not a request failure). Verified live: `{ status: 'ok', checks: { supabase: ok, geminiKey: ok, tomtom: ok } }` in 2.9s; budget gate both paths (unchanged → OK exit 0; stale baseline 100 kB below actual → FAIL). |
| [x] | 0.5 | Feature flags | **Implemented + verified** (PR #495, `fb719c9`). `src/lib/flags/flags.ts` — zero-dep flag registry with `owner` + `expiry` metadata per §0.5. Deliberately NOT Unleash: a flag service is a thing to operate (server, SDK, hosting) and there is exactly one flag today; §3.3's "no Redis until traffic justifies it" applies identically. `USE_MULTI_AGENT` wired through `isFlagEnabled()` — same behavior, one-line swap. Env override: `FLAG_<NAME>` wins over the config default (the §2.5 rollback lever); legacy `USE_MULTI_AGENT` still honored for back-compat. **CI now sets `USE_MULTI_AGENT=true`** — CI previously only exercised the flag-OFF path while `.env`/`.env.local` set it `true` in dev (two paths, one tested). Verified: 8/8 registry tests, tsc clean, 507 tests, build green. **Vercel prod state verified by user 2026-09-20:** `USE_MULTI_AGENT=true` in All Environments since 11/18/25 — **prod has been running the multi-agent path for ~10 months.** After the merge, prod behavior is unchanged (the registry honors the legacy var). The multi-agent path IS the production path, so CI setting `USE_MULTI_AGENT=true` aligns CI with what prod actually serves — the earlier CI/prod path mismatch is closed. Off switch: `FLAG_USE_MULTI_AGENT=true` may be added in Vercel (keeps prod as-is, provides the rollback lever); **must NOT be added as `false`** — the override wins over legacy and would flip prod to the legacy path on next deploy. |

### Verification results for the 0.2 + 0.1a + 0.1 slices

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit --skipLibCheck` | **0 errors** (was 24 mid-edit; baseline was 0) |
| Tests | `pnpm test -- --passWithNoTests --maxWorkers=2` | **1 failed, 8 skipped, 499 passed** — same as baseline. The 1 failure is `emailConfig.test.ts:78`, pre-existing and unrelated (audit §8.3). |
| Affected suites | `jest --testPathPattern="saved-itineraries\|saved-meals"` | **23/23 passed** (was 7 failing before the slice) |
| Lint | `pnpm exec next lint --max-warnings=1000` | **Clean** — no new warnings from the 7 changed files |
| Build | `pnpm run build` | **✓ Compiled successfully** in 7.3s, exit 0 (re-verified 2026-09-20 after plan edits; unchanged) |
| Runtime smoke | `bun run specs/smoke-logger.mjs` | **SMOKE OK** — JSON lines carry `requestId`; generated/client/garbage UUID paths all correct |
| Runtime smoke (0.1) | `bun run specs/smoke-handleapierror.mjs` | **21/21 OK** — every `AppError` type, unknown/null/string inputs, message classification (rate-limit→429, timeout→503, not-authorized→401, not-found→404), `x-request-id` echo. Two real bugs caught by this smoke test before commit: an incomplete regex (`you are not authorized` failed to match → 500 instead of 401) and `NextResponse.json` not inheriting request headers (correlation ID lost). Both fixed pre-merge. |

### Shipped via

| Slice | PR | Commit |
|---|---|---|
| 0.2 + 0.2a + 0.1a | [#488](https://github.com/donyelqt/Tarana.ai/pull/488) | `9a2b509` (merged `adb28a2`) |
| 0.1 | [#489](https://github.com/donyelqt/Tarana.ai/pull/489) | `f46ba51` (merged `3cb7ba5`) |
| 1.2 slice 1 (consent + stats) | [#505](https://github.com/donyelqt/Tarana.ai/pull/505) | `d0f28e0` (merged `2b12d57`) |
| 1.2 slice 2 (register + forgot/reset) | [#507](https://github.com/donyelqt/Tarana.ai/pull/507) | `63a2184` (merged `5879272`) |
| 1.2 slice 3a (meals + profile) | [#509](https://github.com/donyelqt/Tarana.ai/pull/509) | `6701be2` (merged `557c333`) |
| 1.2 slice 3b (itineraries) | [#511](https://github.com/donyelqt/Tarana.ai/pull/511) | `72ed57b` (merged `429991c`) |
| 1.2 slice 3c (credits, closes 1.2) | [#513](https://github.com/donyelqt/Tarana.ai/pull/513) | `133d5b9` (merged `6b542bf`) |
| 2.2 slice 1 (timeout helper + 3 sites) | [#515](https://github.com/donyelqt/Tarana.ai/pull/515) | `83bb797` (merged `389c2f5`) |
| 2.1 slice 1 (shared retry helper + food route) | [#517](https://github.com/donyelqt/Tarana.ai/pull/517) | `6e1b8ea` |
| 4.4 (emailConfig test isolation) | [#518](https://github.com/donyelqt/Tarana.ai/pull/518) | `6fef869` |
| 2.1 slice 2 (ErrorHandler retry migration) | [#519](https://github.com/donyelqt/Tarana.ai/pull/519) | `a9b9df2` |
| 2.2 slice 2b (remaining Gemini timeout sites) | [#520](https://github.com/donyelqt/Tarana.ai/pull/520) | `304affc` |
| 3.1 (redundant security-header calls) | [#521](https://github.com/donyelqt/Tarana.ai/pull/521) | `b508146` |
| 2.3 slice 1 (idempotency infrastructure + saved-itineraries POST) | [#539](https://github.com/donyelqt/Tarana.ai/pull/539) | `db72985` (merged `0f75f5d`) |
| 2.3 slice 1b (atomic claims, concurrency-safe) | [#540](https://github.com/donyelqt/Tarana.ai/pull/540) | `0b15efd` |
| 2.3 slice 2 (saved-meals POST, R2) | [#541](https://github.com/donyelqt/Tarana.ai/pull/541) | `b352660` (merged `532e8f6`) |
| 5.1-R1 narrow (track-referral withRetry + logger) | [#542](https://github.com/donyelqt/Tarana.ai/pull/542) | `2eee7c0` (merged `75aa447`) |
| 2.3-R3 (saved-itineraries PATCH idempotency) | [#544](https://github.com/donyelqt/Tarana.ai/pull/544) | `6da841f` (merged `1abf2aa`) |
| 2.3-R4 (profile PATCH idempotency + logger) | [#545](https://github.com/donyelqt/Tarana.ai/pull/545) | `8f07709` (merged `174c9b9`) |
| 0.1 closeout (referrals/debug safe-error) | [#546](https://github.com/donyelqt/Tarana.ai/pull/546) | `9f937b7` (merged `014dddb`) |
| 3.4 RLS remediation (places, itinerary_embeddings, users) | [#548](https://github.com/donyelqt/Tarana.ai/pull/548) | `36a92f6` (merged `426ff88`) |
| 2.3-R5 (saved-meals DELETE idempotency) | [#549](https://github.com/donyelqt/Tarana.ai/pull/549) | `5b313b4` |
| 5.1 slice 1 (activitySearch.ts, 40 calls) | [#551](https://github.com/donyelqt/Tarana.ai/pull/551) | `3628c89` (merged `844be3b`) — verify SUCCESS (2m35s) |
| 5.1 slice 2 (agent.ts, 3 calls) | [#552](https://github.com/donyelqt/Tarana.ai/pull/552) | `d912e6c` (merged `1d7b5f3`) — verify SUCCESS (2m39s) |
| 5.1 slice 3 (itineraryUtils.ts, 9 calls) | [#553](https://github.com/donyelqt/Tarana.ai/pull/553) | `fc4ba81` (merged `53ab3f0`) — verify SUCCESS (2m12s) |
| 5.1 slice 4 (lib support, 9 calls) | [#554](https://github.com/donyelqt/Tarana.ai/pull/554) | `0018ec9` (merged `e5146d0`) — verify SUCCESS (2m17s) |
| 5.1 slice 5 (itinerary-generator route, 14 calls) | [#555](https://github.com/donyelqt/Tarana.ai/pull/555) | `fa3ab07` (merged `de1c95d`) — verify SUCCESS (2m08s) |
| 5.1 slice 6 (JSON engines, 40 calls) | [#556](https://github.com/donyelqt/Tarana.ai/pull/556) | `c6d8afa` (merged `5b2b40c`) — verify SUCCESS (2m31s) |
| 5.1 slice 7 (refresh route, 88 calls) | [#562](https://github.com/donyelqt/Tarana.ai/pull/562) | `4deda6f` + `92a721d` (merged `d07643e`) — verify SUCCESS (2m38s) |

### What the slice did NOT touch

- No `console.log`/`console.error` was removed outside the 3 converted routes.
  The repo still has hundreds of `console.*` calls (audit: ~40 files). Phase 5.1
  is the task for those — this slice was scoped to the error-handling paths only.
- No new dependencies added to `package.json` or `pnpm-lock.yaml`.
- No test files added. The existing `saved-itineraries` tests were updated to
  pass a `NextRequest` to `GET` (the signature changed from `GET()` to
  `GET(request)`), matching the convention already used by `consent` and
  `mobile-token` test suites.

### Phase 1: Architecture (status re-verified against `main` 2026-09-21)

| Status | # | Item | Evidence |
|---|---|---|---|
| [x] | 1.1 | Centralize auth across all routes | PRs #501, #502, #503. `grep getServerSession` in `route.ts` → zero (re-verified 2026-09-21); 19 route files go through `withAuth`/`withAuthEmail`. See §4 ¶1.1 for signature decisions. |
| [x] | 1.5 | ADRs for the 5 load-bearing decisions | PR #498. `docs/adr/` holds 7 files (001, 002 + 003–007, re-verified 2026-09-21). |
| [x] | 1.2 slice 1 | consent + stats services extracted | PR #505. `consent` -> `recordTosAcceptance`, `stats` -> `getStats`. `supabaseAdmin` in routes: 13 -> 11. |
| [x] | 1.2 slice 2 | register + forgot/reset services extracted | PR #507 (merged `5879272`). `register` -> `createUserProfile`; `forgot-password` -> `storeResetToken`; `reset-password` -> `findUserByResetToken` / `hashPassword` / `resetPassword` (new `passwordService.ts`). Forgot/reset tests mock the service boundary. `supabaseAdmin` in routes: 11 -> 8 (remaining: profile, 3× credits, 2× saved-itineraries, 2× saved-meals). |
| [x] | 1.2 slice 3a | saved-meals + profile services extracted | PR #509 (merged `557c333`). `saved-meals` -> `listMeals` / `createMeal`; `saved-meals/[id]` -> `getMealById` / `deleteMealById` (new `mealService.ts`); `profile` -> `getProfileByEmail` / `updateProfileByEmail` (new `profileService.ts`). New meals suites (11 tests); profile placeholder rewritten (9 no-ops -> 7 real). `supabaseAdmin` in routes: 8 -> 5. |
| [x] | 1.2 slice 3b | saved-itineraries services extracted | PR #511 (merged `429991c`). `saved-itineraries` -> `listItineraries` / `createItinerary`; `[id]` -> `getItineraryById` / `updateItineraryById` / `deleteItineraryById` (new `itineraryService.ts`). Validation, image resolution, `toDbPayload`, and row mapping stay at the boundary. All 18 behavior cases preserved + 1 new GET-500 case. `supabaseAdmin` in routes: 5 -> 3. |
| [x] | 1.2 slice 3c | credits services extracted — 1.2 CLOSED | PR #513 (merged `6b542bf`). 3 credits routes -> `creditDiagnostics.ts` probes + `userService.userProfileExists`/`createUserProfile`. `CreditService` money paths untouched by design. 3 new suites (13 tests). `supabaseAdmin` in routes: 3 -> 0. Invariant 2 holds. |
| [x] | 1.2 remainder | — | Closed by slice 3c above. Zero route files import `supabaseAdmin` (verified 2026-09-21). |
| [ ] | 1.3 | Bounded contexts | No `itinerary/` / `users/` / `places/` modules; no circular-dependency check. |
| [ ] | 1.4 | API versioning | No `/api/v1/` prefix; no `Sunset`/`Deprecation` headers. |

### Verification results for the 1.2 slice-2 merge (2026-09-21, on `main` @ `5879272`)

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit --skipLibCheck` | **0 errors** |
| Focused tests | `jest --testPathPattern="register\|forgot-password\|reset-password"` | **42/42 passed** |
| Full suite | `jest --passWithNoTests --maxWorkers=2` | **504 passed, 6 skipped, 0 failed** |
| Lint | `pnpm exec next lint --max-warnings=1000` | **0 errors** (pre-existing warnings only) |
| Build | `pnpm run build` | **green** |
| CI on PR #507 | `verify` + Vercel | **pass** (`verify` 2m39s) |
| Invariants | `grep` over `src/app/api` | `getServerSession` → zero; `String(error)` → zero; `supabaseAdmin` → 8 route files (all pre-existing, none new) |

### Verification results for the 1.2 slice-3a merge (2026-09-21, on `main` @ `557c333`)

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit --skipLibCheck` | **0 errors** |
| Focused tests | `jest --testPathPattern="saved-meals\|profile/__tests__\|consent\|stats"` | **26/26 passed** (2 pre-merge test bugs caught and fixed: wrong 201 assumption — route returns 200; unreachable >100-name branch — sanitizer caps at 100, test documents truncation instead) |
| Full suite | `jest --passWithNoTests --maxWorkers=2` | **513 passed, 6 skipped, 0 failed** (+9 net: +6 meals, +5 [id], +7 profile, −9 placeholder) |
| Lint | `pnpm exec next lint --max-warnings=1000` | **0 errors** (pre-existing warnings only) |
| Build | `pnpm run build` | **green** |
| CI on PR #509 | `verify` + Vercel | **pass** (`verify` 2m32s) |
| Invariants | `grep` over `src/app/api` | `getServerSession` → zero; `String(error)` → zero; `supabaseAdmin` → 5 route files (saved-itineraries ×2, credits ×3) |

### Verification results for the 1.2 slice-3b merge (2026-09-21, on `main` @ `429991c`)

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit --skipLibCheck` | **0 errors** |
| Focused tests | `jest --testPathPattern="saved-itineraries"` | **24/24 passed** (revert-check: new tests fail 8/11 against the old routes — only auth/validation short-circuits pass — proving they cover the migration) |
| Full suite | `jest --passWithNoTests --maxWorkers=2` | **514 passed, 6 skipped, 0 failed** (+1 net: all 18 behavior cases preserved + 1 new GET-500 case) |
| Lint | `pnpm exec next lint --max-warnings=1000` | **0 errors** (pre-existing warnings only) |
| Build | `pnpm run build` | **green** |
| CI on PR #511 | `verify` + Vercel | **pass** (`verify` 2m49s) |
| Invariants | `grep` over `src/app/api` | `getServerSession` → zero; `String(error)` → zero; `supabaseAdmin` → 3 route files (`credits/diagnostics`, `credits/init-profile`, `credits/test-consumption`) |

### Verification results for the 1.2 slice-3c merge (2026-09-21, on `main` @ `6b542bf`)

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit --skipLibCheck` | **0 errors** |
| Focused tests | `jest --testPathPattern="credits/(diagnostics\|init-profile\|test-consumption)"` | **13/13 passed** (revert-check: 9/13 fail against the old routes — only auth/prod-gate short-circuits pass — proving they cover the migration) |
| Full suite | `jest --passWithNoTests --maxWorkers=2` | **527 passed, 6 skipped, 0 failed** (+13 net; these 3 routes had zero coverage) |
| Lint | `pnpm exec next lint --max-warnings=1000` | **0 errors** (pre-existing warnings only) |
| Build | `pnpm run build` | **green** (one transient worker exit 1; two subsequent identical runs exit 0) |
| CI on PR #513 | `verify` + Vercel | **pass** (`verify` 2m48s) |
| Invariants | `grep` over `src/app/api` | `getServerSession` → zero; `String(error)` → zero; `supabaseAdmin` → zero (invariant 2 holds; 1.2 closed) |

### Phase 2: Reliability (status re-verified against `main` 2026-09-22)

| Status | # | Item | Evidence |
|---|---|---|---|
| [x] | 2.1 slice 1 | Shared retry helper + first call site | New `src/lib/upstream/withRetry.ts` (zero-dep, exponential backoff + full jitter, composes with `withTimeout` from 2.2 slice 1); `AppError.retryable` drives skip/no-retry decisions; raw Error wrapped to `AppError` (UPSTREAM) on exhaustion. 15 tests in `__tests__/withRetry.test.ts`. Wired `food-recommendations/route.ts` (replaced the 30-line inline retry loop while preserving 2 attempts, 30s timeout, and 1s fixed delay). Remaining live Gemini sites completed by 2.1 slice 2 / 2.2 slice 2b. |
| [x] | 2.1 slice 2 | Gemini pipeline retry migrated onto shared helper | `ErrorHandler.withRetry` (`itinerary-generator/lib/errorHandler.ts`) — the hand-rolled backoff loop replaced with delegation to the shared helper. Classification, stats, and the `ItineraryError` throw contract stay in `ErrorHandler`; exhaustion re-throws the classified object so route handling sees TIMEOUT/VALIDATION correctly. Verified: `smoke-errorhandler-retry.mjs` 22/22, itinerary suites 12/12, tsc clean, full suite 550/0/6, lint clean. |
| [x] | 2.2 slice 1 | Shared timeout helper + 3 call sites | PR #515 (merged `389c2f5`). `src/lib/upstream/withTimeout.ts` (`UpstreamTimeoutError`, `withTimeout`, `fetchWithTimeout`); wired `fetchWeatherData`, `tomtomTraffic.getTrafficIncidentsSimple`, and `agent.ts` subqueries. 8 tests; no remaining live Gemini sites after 2.2 slice 2b. |
| [x] | 2.2 slice 2b | Remaining Gemini generateContent sites + timeout composition | PR #520 (`304affc`). `responseHandler`, `structuredOutputEngine`, and `guaranteedJsonEngine` now use `withRetry` + `timeoutMs`; fixed a response-handler timer leak, an abort-listener leak, and a post-success stale abort. `ensureFullItinerary` verified dead and intentionally untouched. Smoke suites 14/14 + fallback/retry/abort checks, tsc clean, full suite 550/0/6, lint clean, CI green. |
| [x] | 2.3 slices 1–1b–2–R3–R4–R5–R6–R7 | Idempotency keys (saved-itineraries POST+PATCH, saved-meals POST+DELETE, profile PATCH, generator POST, food-recommendations POST) | **7 of N write endpoints.** R6 (PR #564, merged `4b13d85`) covers the non-multi-agent generator branch; R7 (PR #567, merged `50220a2`) closes the separate charge-first food route. |
| [x] | 2.3-R3–R4 | Idempotency extended to itineraries + profile PATCH; profile console → logger | PR #544 (`6da841f`): saved-itineraries [id] PATCH honors the atomic claim/complete pattern (no key bypass; replay verbatim; 409+Retry-After; 422 mismatch; failure cached; 404 miss cached like POST). PR #545 (`8f07709`): same pattern on profile PATCH keyed on `(email, '/api/profile', key, hash(sanitized update))`; both `console.error` calls replaced with `logger` + `getRequestId`. Validation, sanitization, `withAuth`/`withAuthEmail`, wire shapes unchanged. Tests: 6 new cases each; itineraries 15/15, profile 13/13, tsc 0 errors, CI `verify` green on both. |
| [x] | 2.3-R5 | saved-meals DELETE idempotency | PR #549 (`5b313b4`): `saved-meals/[id]/route.ts` DELETE honors the atomic claim/complete pattern keyed on `(user_id, '/api/saved-meals/[id]', key, hash({id}))`. The bug this closes: a client retry of a DELETE whose first attempt already succeeded got `404 'Meal not found'` instead of the cached success — a confusing error and a second failed lookup. Replay verbatim; 409+Retry-After on in-flight; 422 on payload mismatch; 404 miss cached so a replay cannot re-run the lookup; failure cached. No-key bypass preserved; GET wire shape and 404-indistinguishability unchanged. Tests: 6 new idempotency cases; focused suite 12/12 (6 existing + 6 new); tsc 0 errors. |
| [x] | 2.3-R6 | Generator POST idempotency | **Done** (PR #564, merged `4b13d85`; CI `verify` SUCCESS 2m46s). Last charge-first route without a key contract: `POST /api/gemini/itinerary-generator` now honors `Idempotency-Key`/`X-Idempotency-Key` via the shared claim/complete service (`getIdempotencyKey` → `claimIdempotency` → replay 200 verbatim / 409+Retry-After in-flight / 422 payload-mismatch). Claim runs after Zod validation (400s never bill, never claim) and before `consumeCredits`; unkeyed requests flow unchanged. Success, zero-activity, and failure bodies are completed for exact replays. 4 regression tests (`itinerary-generator/__tests__/routeIdempotency.test.ts`: replay-no-recharge, 409, 422, no-key untouched; 3/4 RED pre-fix). tsc 0 errors, eslint clean, full suite 639/6/0. Out of scope: multi-agent path (separate coordinator charge), client-side key generation. |
| [x] | 2.3-R7 | Food recommendations POST idempotency | **Done** (PR #567, merged `50220a2`; CI `verify` SUCCESS 2m48s). `food-recommendations` now claims `Idempotency-Key` before `consumeCredits`; replays the exact response, returns 409+`Retry-After` for in-flight duplicates, rejects payload mismatches with 422, and completes owned claims for 200/402/500 outcomes. Completion persistence failure fails closed instead of returning a false success. The existing web caller sends one UUID per generation intent; unkeyed behavior is unchanged. Added 9 route idempotency regressions + 1 hook test; focused route 12/12, full suite 649 passed / 6 skipped / 0 failed, tsc clean, lint 0 errors (pre-existing warnings only), build green, CI verify pass. Independent Osmani review: initial Required findings fixed; post-fix verdict APPROVE. Multi-agent generator and refresh callers remain separate follow-up scope. |
| [x] | 2.6 | Refresh internal-call auth (credential forwarding) | **Done** (PR #561, `e74e940` + `7b9e677`, merged `7baca48`; CI `verify` SUCCESS 2m43s). `POST /api/saved-itineraries/[id]/refresh` regenerates via the authenticated generator endpoint: `forwardCallerCredential()` carries only the caller's own credential (`x-bench-token` HMAC on the bench path, else the session cookie) — Node fetch attaches nothing server-to-server, so this was 401→500 on every regeneration. Same slice sanitized the 2 raw-error 500 bodies (inner regeneration + outer catch). 5 new regression tests (`refresh/__tests__/route.test.ts`: 401 boundary, cookie forwarding, bench-token precedence, explicit failure body, sentinel-leak; 4/5 fail pre-fix). tsc 0 errors, eslint clean, CR/LF preserved, full suite green, independent Osmani review APPROVE. Not 2.3 idempotency: no `Idempotency-Key` contract added — that gap is tracked in correction 39 item 3. |
| [ ] | 2.4 | Shared rate limiting | `InMemoryRateLimiter` still `Map`-backed (correct to defer per §3.3). |
| [x] | 2.5 | Error budget + rollback policy | **Done** (PRs #531 + #532). `docs/rollback.md`: two levers in order (flag env flip < 1 min; Vercel promote < 5 min), `USE_MULTI_AGENT` prod state + never-set-`true` warning, trigger thresholds matching the rollout table. `docs/slo.md`: 99.5% over rolling 30 days on `/api/*` non-5xx, error-budget policy (>20% ship / 0–20% slow / 0% freeze). Runbooks (`docs/runbooks/`) remain Phase 5.3. |
| [x] | 0.1a-3 | Weather route safe-error closeout | **Done** (PRs #528, #529, #530). Last route leaking raw upstream text: 502 path echoed OpenWeather bytes as `upstreamMessage`, outer catch interpolated thrown text into 500 body. Now fixed class per status server-side detail in structured log with `requestId`, outer catch → `handleApiError`. 2 sentinel regression tests (proved RED pre-fix); fallback fixtures carry sanitized class. Envelope unchanged. Full suite 555/6/0. |
| [x] | 0.1 closeout | referrals/debug raw-error-leak closeout | **Done** (PR #546, `9f937b7`, merged `014dddb`). GET profile 404 and POST fetch/update failures returned raw Supabase/PostgREST error objects (`details` field) — the last known raw-leak sites. All three paths now log via `logger` + `getRequestId` and return generic messages; the 2 remaining `console.log` calls in POST stay (dev-only tier-fix UX output, not error handling). 3 new boundary cases in `safeError.boundary.test.ts` (6/6 total): GET profile failure, POST fetch failure, POST update failure — each asserts the sentinel never reaches the client body. tsc 0 errors, eslint 0 warnings, CI `verify` pass. |

### Phase 3: Security

| Status | # | Item | Evidence |
|---|---|---|---|
| [x] | 3.1 | Security headers | `securityHeaders.ts` defines the headers and `compose.ts` applies them on every middleware response via idempotent `headers.set()`. PR #521 removed 24 redundant route-level calls + 3 imports from the auth routes; zero route-level calls remain, auth suites 52/52, full suite 550/0/6, lint clean, CI green. |
| [x] | 3.2 | SSRF protection | **Closed as decided-no-wire-target (2026-09-26).** Guard + 12 rejection tests landed (PR #606 `7e8e3e3`: `src/lib/security/ssrf.ts` `isSafeUrl`, `__tests__/ssrf.test.ts` incl. `169.254.169.254` rejection). Adversarial review over all 16 server-side `fetch(` sites: every URL authority is hardcoded or deploy-time env — zero attacker-controlled fetch targets, so wiring the guard is rejected (theater + DNS latency, zero gain). Revisit trigger: any future route/helper fetching a request-derived URL MUST gate with `isSafeUrl` first. |
| [ ] | 3.3 | Dependency audit provenance | Critical production audit gate shipped in 0.4a; `pnpm audit` provenance/signature extension remains absent. |
| [x] | 3.4 RLS audit (read-only, this pass) | Table + RPC surface inventory, no policy change | **Done — audit only, no SQL applied.** Tables: `itineraries` (RLS + strict `auth.uid()=user_id`), `saved_meals` (remediated strict, `20260919000000`), `user_profiles`/`referrals`/`credit_transactions`/`daily_credit_allocations` (RLS + strict, `20250129`), `idempotency_keys` (RLS deny-all, service-role only, `20260923000000` + `20260923010000`). RPCs: `refund_credits`/`consume_credits`/`get_available_credits` anon-revoked (`20260918000000`); `match_activity_embeddings` anon-revoked, authenticated kept. **Gaps (no RLS in repo migrations):** `places` (`20260901`, server-only via `supabaseAdmin` upsert in `activitySearch.ts:309`), `itinerary_embeddings` (`20240730`, server-only reads `itineraryUtils.ts:529,556` + RPC `intelligentSearch.ts:416`/`vectorSearch.ts:86`), `public.users` (no RLS policy file; service-role only + reset-token index). `places` backfill is public POI data — low sensitivity, but enable RLS deny-all to match `idempotency_keys` posture. Probes `scripts/prove-revoke-anon.mjs` + `scripts/prove-saved-meals-rls.mjs` require live `SUPABASE_URL/ANON/SERVICE` keys — **not run** (no staging creds in tree); run commands recorded in scripts. Full anon-client table audit + staging proof remain the Phase 3.4 closeout — this row records the inventory. |
| [x] | 3.4 RLS remediation | RLS deny-all on the 3 uncovered tables | **Done — applied live 2026-09-24.** PR #548 (`36a92f6`): `supabase/migrations/20260924000000_rls_deny_all_places_embeddings_users.sql` — idempotent DO block (`to_regclass` guard, `ENABLE ROW LEVEL SECURITY` no-op when already on) on `places`, `itinerary_embeddings`, `public.users`. No policies written: both cache tables have no per-user rows; no caller resolves `auth.uid()` today (NextAuth custom users table, zero `supabase.auth` createUser calls). All current access is service-role (bypasses RLS) — zero runtime behavior change; closes the anon/authenticated Data API hole. Live proof (project `vryamakpawtzmvgnifie`, DO block applied via SQL Editor by the user): anon SELECT on all 3 → HTTP 200 with EMPTY rowset (RLS-filtered; `places` returned rows pre-migration); service-role select → 2xx. `scripts/prove-rls-deny-all.mjs` (4 checks, zero-dep, env-only secrets) asserts both denial forms (401/403 or 200 []) — SMOKE OK. Supabase under RLS deny-all with Data API table access returns 200 `[]`, not 401/403 — the probe documents this. |
| [x] | 3.5 | Cron refresh endpoint hardening | **Done — PR #589.** Activated `route.ts`; fail-closed Bearer auth, strict body validation/size limit, namespaced DB-backed idempotency, 60-minute pending TTL, aggregate-only responses, generic errors, and bounded logs. 11 focused tests; full suite 690 passed / 6 skipped / 0 failed; build route table includes the endpoint; Osmani and security audit **APPROVE**. |

### Phase 4: Testing

| Status | # | Item | Evidence |
|---|---|---|---|
| [ ] | 4.1 | E2E tests | Partial — Playwright smoke landed (PR #605: `playwright.config.ts`, `tests/e2e/smoke.spec.ts` 4 tests — landing, signin render, dashboard unauth redirect, health endpoint — plus CI `e2e-smoke` job); full signup → login → generate → save → dashboard journey not implemented. |
| [ ] | 4.2 | Contract tests | API request/response contract suite not implemented. |
| [ ] | 4.3 | Mobile tests | `tarana-mobile` has no Jest test job in CI. |
| [x] | 4.4 | Fix the failing test | PR #518 (`6fef869`) isolates `SMTP_FROM_EMAIL` in `mockEnv` without changing the source default. emailConfig 9/9; full suite **550 passed, 6 skipped, 0 failed** — first 100% green run. |
| [x] | 5.1-R1 narrow | track-referral via withRetry + structured logger | **Done — 1 route, not repo-wide 5.1.** PR #542 (`2eee7c0`, merged `75aa447`): hand-rolled 3-attempt loop (re-ran business failures, inline sleep, 9 `console.*`) → `withRetry` (3 attempts, 1s fixed, `jitter: 'none'`); business `{success:false}` outcomes (invalid/self/duplicate) return without retry; transient throws retry; exhaustion → `handleApiError` safe 500. `console.*` → `logger.info/warn` + `getRequestId`; known-error branches byte-identical; catch typed `unknown`; wire shape unchanged for `referralTracking.ts`. New `__tests__/route.test.ts` (6: 401, blank-400, normalization, no-retry-on-business, retry-then-succeed, sentinel-leak 500). Verified: focused 6/6, `console.` in route → zero, tsc 0 errors, CI `verify` 2m16s + Vercel pass. Repo-wide `console.*` elimination (Phase 5.1 full) remains open. |
| [x] | 5.1-R2 narrow | multi-agent pipeline console -> structured logger | **Done — 3 files, not repo-wide 5.1.** PR #550 (`2ec71b0`): the multi-agent path is the production path (`USE_MULTI_AGENT=true` since 11/18/25, ~10 months) and it emitted 4 `console.*` calls with no `requestId`/`entryPoint`, so a failed generation was uncorrelatable. Replaced with the zero-dep `logger` (entryPoint set per file; no `requestId` since these are library functions, not request handlers): `conciergeAgent.ts:116` `console.warn` → `logger.warn` (credit check), `contextScoutAgent.ts:90` `console.warn` → `logger.warn` (traffic fetch), `pipelineCoordinator.ts:65` `console.error` → `logger.error` (bookkeeping), `pipelineCoordinator.ts:80` `console.log` → `logger.info` (refund). Also fixed a latent bug: the old `getCreditBalance` returned inside the try, so its `console.warn` was dead code. Verified: agents suites 20/20, full suite 627 passed / 6 skipped / 0 failed (+1 net over the 555 recorded for 0.1a-3), tsc 0 errors. The 2 remaining `console.log` calls in the refresh POST stay: banner UX output, not error handling. |

### Verification results for the 2.2 slice-1 merge (2026-09-21, on `main` @ `389c2f5`)

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit --skipLibCheck` | **0 errors** |
| Focused tests | `jest --testPathPattern="upstream"` | **8/8 passed** (typed 503/retryable on hang, passthrough when fast, abort mapping, budget timing) |
| Related suite | `jest --testPathPattern="weatherFallback"` | **green** (fallback path preserved) |
| Full suite | `jest --passWithNoTests --maxWorkers=2` | **535 passed, 6 skipped, 0 failed** (+8 net) |
| Lint | `pnpm exec next lint --max-warnings=1000` | **0 errors** (pre-existing warnings only) |
| Build | `pnpm run build` | **exit 0** |
| CI on PR #515 | `verify` + Vercel | **pass** (`verify` 2m45s) |

### Verification results for the 2.1 slice-1 (2026-09-21, on `main`)

| Gate | Command | Result |
||---|---|---|
| Typecheck | `npx tsc --noEmit --skipLibCheck` | **0 errors** |
| Focused tests | `jest --testPathPattern="upstream/withRetry"` | **15/15 passed** (success, retry-then-success, backoff timing, jitter bounds, non-retryable 401/404, retryable 503/429, exhaustion + AppError wrapping, timeout integration, custom shouldRetry) |
| Timeout tests | `jest --testPathPattern="upstream/withTimeout"` | **8/8 passed** (unchanged, no regressions) |
| Full suite | `npx jest --passWithNoTests --maxWorkers=2` | **549 passed, 6 skipped, 1 failed** (+16 net; failure is pre-existing `emailConfig.test.ts:78` ambient env issue) |
| Lint | `npx eslint src/lib/upstream/withRetry.ts src/lib/upstream/__tests__/withRetry.test.ts src/app/api/gemini/food-recommendations/route.ts` | **0 errors** |
| Runtime smoke | 4-case smoke test (first try, retry-then-succeed, non-retryable, exhaustion) | **SMOKE OK** |

### Verification results for the 2.3-R2 + 5.1-R1 merges (2026-09-24, on `main` @ `75aa447`)

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit --skipLibCheck` | **0 errors** |
| Focused (meals) | `jest src/app/api/saved-meals/__tests__/route.test.ts` | **12/12 passed** (6 existing + 6 new: replay, owner-complete, no-key, conflict 409+Retry-After, payload-mismatch 422, failure-cached) |
| Focused (referral) | `jest src/app/api/auth/track-referral/__tests__/route.test.ts` | **6/6 passed** (401, blank-400, normalization, no-retry-on-business, retry-then-succeed, sentinel-leak 500) |
| Focused (idempotency) | `jest idempotencyService + saved-itineraries` | **40/40 passed** |
| Full suite | `pnpm test -- --passWithNoTests --maxWorkers=2` | **605 passed, 6 skipped, 0 failed** (77 suites; +50 net over the 555 recorded for 0.1a-3) |
| Lint | `pnpm exec next lint --max-warnings=1000` | **0 errors** (pre-existing warnings only) |
| Build | `pnpm run build` | **green** |
| CI on PR #541 | `verify` + Vercel | **pass** (`verify` 2m18s) → merged `532e8f6` |
| CI on PR #542 | `verify` + Vercel | **pass** (`verify` 2m16s) → merged `75aa447` |
| Invariants | `grep` over `src/app/api/**/route.ts` | `getServerSession` → zero; `supabaseAdmin` → zero; `String(error)` response leak → zero (`track-referral:63` is a catch-narrow `String(error)`, never serialized); `applySecurityHeaders` → zero |

### Verification results for the 2.3-R3 + 2.3-R4 + 0.1-closeout merges (2026-09-24, on `main` @ `014dddb`)

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit --skipLibCheck` | **0 errors** (run after each slice) |
| Focused (R3) | `jest --testPathPattern="saved-itineraries/\[id\]"` | **15/15 passed** (9 existing + 6 new idempotency cases) |
| Focused (R4) | `jest --testPathPattern="profile/__tests__"` | **17/17 passed** (13/13 in the route suite: 7 existing + 6 new idempotency cases) |
| Focused (closeout) | `jest --testPathPattern="safeError.boundary"` | **6/6 passed** (3 existing + 3 new referrals/debug sentinel cases) |
| Lint | `npx eslint <changed files>` | **0 errors, 0 warnings** per slice |
| CI on PR #544 | `verify` + Vercel | **pass** (`verify` 2m37s) → merged `1abf2aa` |
| CI on PR #545 | `verify` + Vercel | **pass** (`verify` 1m54s) → merged `174c9b9` |
| CI on PR #546 | `verify` + Vercel | **pass** (`verify` 2m14s) → merged `014dddb` |

### Verification results for the 5.1-R2 merge (2026-09-24, on `main` @ `2ed9935`)

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit --skipLibCheck` | **0 errors** |
| Focused (agents) | `jest --testPathPattern="agents/"` | **20/20 passed** (6 suites) |
| Full suite | `npx jest --passWithNoTests --maxWorkers=2` | **627 passed, 6 skipped, 0 failed** (77 suites; +1 net over the 555 recorded for 0.1a-3) |
| Lint | `pnpm exec next lint --max-warnings=1000` | **0 errors** (pre-existing warnings only) |
| Build | `pnpm run build` | **green** |
| CI on PR #550 | `verify` + Vercel | **pass** |

**33. §5.1 itinerary-generator slices 1–6 — accepted with a recorded gap (2026-09-24).**
New data: six PRs (#551 `844be3b`, #552 `1d7b5f3`, #553 `53ab3f0`, #554 `e5146d0`,
#555 `de1c95d`, #556 `5b2b40c`) are all MERGED merge commits on `main`, each with
`verify` conclusion SUCCESS on GitHub Actions; 115 console calls across 9 files
now route through the zero-dep logger, so only `comprehensiveTestSuite.ts`
(test utility) remains in the generator tree. Gap unchanged: the entryPoint
label rides the logger's 3rd positional arg (`requestId`) per the 5.1-R2
convention, so the declared `LogEntry.entryPoint` field is never populated
(`grep -rn entryPoint src/ --include=*.ts` → logger.ts declaration only).
Recorded, not fixed: normalising the 8 consumers is a follow-up, not part of
this slice; `route.ts` correctly passes `getRequestId(req)`. §5.1 full close-out
is still open: ~68 non-test files outside this tree still emit `console.*`.

### Verification results for the 5.1 slice merges (2026-09-24, on `main` @ `5b2b40c`)

| Gate | Command | Result |
|---|---|---|
| Merge commits | `git log main --format='%H parents'` on the six hashes | All **two-parent** merge commits, chained parent→child (`c1e4d06` → … → `5b2b40c`) |
| PR state | `gh pr list --state merged` + `gh pr view --json state,mergeCommit` | #551–#556 all **MERGED**, each `mergeCommit.oid` equals its claimed merge hash |
| CI on each PR | `gh pr checks` / `statusCheckRollup` | **`verify` pass** on all six: 2m35s / 2m39s / 2m12s / 2m17s / 2m08s / 2m31s |
| Typecheck | `npx tsc --noEmit --skipLibCheck` per slice | **0 errors** each (one intermediate `req`-out-of-scope error inside `unstable_cache` caught and fixed pre-commit) |
| CRLF safety | `tr -dc '\r'` counts | `route.ts` 501/501, `activitySearch.ts` 833/833 — first `route.ts` pass silently normalised endings (1000-line diff), caught by diff-stat and reverted before commit |
| Invariants | `grep` over `src/app/api/gemini/itinerary-generator` | `console.*` → **0** except the untouched test-utility `comprehensiveTestSuite.ts` |

**34. §5.1 gap 33 is closed (2026-09-24).** PR #559 (`4d84149`, merged `5641ae7`,
`verify` SUCCESS 1m53s) moved the 101 library `entryPoint` labels out of the
logger's 3rd positional arg into meta. Before: every line from these files
carried `requestId: 'agent'` (etc.) and `LogEntry.entryPoint` was declared but
never written. After: `logger.x(msg, { entryPoint: '<name>', ...meta })`; the
label rides the JSON line next to `requestId` because `emit()` spreads meta.
Verified on merged `main`: tsc 0 errors, 101 meta writers, zero remaining
positional string 3rd args, `route.ts` byte-identical, CRLF/LF preserved
(`activitySearch.ts` 833/833 CR). Message text and all other meta fields
unchanged. Spec text in the 5.1 row updated accordingly.

**35. Two Phase-0.2 evidence claims in this document are NOT reproducible.**
Recorded, not fixed — neither blocks 5.4.
(a) §0.2 cites `bun run specs/smoke-logger.mjs` → SMOKE OK, but the file was
never committed (`git log --all -- specs/smoke-logger.mjs` is empty; `specs/`
tracks only the errorhandler-retry / responsehandler-timeout /
structured-engine smokes). The claim cannot be re-run or audited.
(b) Live during the 5.4 probe, `requestIdMiddleware`'s `logger.info('request', …)`
line did not appear in `next dev` stdout — expected, since middleware runs on
the Edge runtime and the logger writes through `process.stdout.write`, which
does not surface in the dev server log. Consequence: the 0.2 acceptance
criterion "confirm JSON log output with `requestId` field" is evidenced only
for route/server-runtime callers; the middleware per-request line is currently
unverifiable. The health probe's response also carried no `x-request-id` header
(the route builds its own `NextResponse`), so header echo is route-dependent,
not a middleware guarantee.

### Verification results for the 5.4 live probe (2026-09-24, on `main` @ `5641ae7`)

| Gate | Command | Result |
|---|---|---|
| Runtime | `next dev -p 3111` + `fetch http://127.0.0.1:3111/api/health` ×3 | Cold **200** in 5.6s (first-hit compile 3.7s); warm **200** in 1014ms; warm **200** in 419ms |
| Body | same | `{"status":"ok","checks":{"supabase":"ok","geminiKey":"ok","tomtom":"ok"}}` on all three calls |
| Design | `src/app/api/health/route.ts` | Connection-level only; 3s per-dependency timeout; no Gemini generation (key-presence only); degraded state returns 200 |
| Caveat | response headers | `x-request-id` absent (route-owned `NextResponse`); see correction 35(b) |

**36. Refresh regeneration was dead in production — fixed by PR #561 (2026-09-24).**
`POST /api/saved-itineraries/[id]/refresh` regenerates by POSTing to the
authenticated `/api/gemini/itinerary-generator` server-to-server. `fetch`
attaches no cookies, so the generator answered **401 on every regeneration**
(force-refresh and auto-regenerate alike) and the route returned 500 with the
raw upstream text. The 401 gate dates to Nov 2025, not to the 1.1 auth
centralization — the break predates it by ~10 months.
Proof, on a fresh `next dev` (`:3222`): the refresh route's exact headers with
no credential → `401 {"error":"Authentication required"}`; identical request
plus a credential → `200` with a real itinerary; refresh POST with a
credential passes the auth boundary and reaches the data layer (404 for a
bogus id). The only delta between fail and success is a credential.
Fix (`7baca48`, merged): `forwardCallerCredential()` carries only the
caller's own credential — `x-bench-token` HMAC on the bench path, else the
session cookie — on the internal call. 5 new regression tests
(`refresh/__tests__/route.test.ts`, 4/5 fail pre-fix). tsc 0 errors, full
suite 637 passed / 6 skipped / 0 failed, eslint clean, CI `verify` pass
(2m43s). Independent Osmani review: APPROVE, 2 Required nits fixed pre-merge.

**37. The 0.1a-2 leak sweep had a glob hole — nested routes were never checked.**
The cited command `grep -rn ... src/app/api/**/route.ts` matches only
single-level dirs in bash (no globstar), so `[id]/` subroutes were invisible
to the "response-body leaks: 0" claim. Full-tree re-sweep (`rglob`) found 2
real raw-error bodies, both in the refresh route fixed by #561: inner
regeneration catch (`error: ...${errorMessage}`, `details.originalError`) and
outer catch (`error: error.message`). Register's `userError.message` 409/400
responses are app-authored strings from `createUserInSupabase`, not raw
upstream detail — borderline, kept. Weather's `fetchError.message` hit is
log-side only (the 502 body is sanitized). Remaining sweep rule: run the
leak grep over `rglob`, not the shell glob.

**38. H1-Eats charge-first — DONE (PR #563, merged `9b8a2f0`; CI `verify` SUCCESS 2m41s).**
Was: pre-flight `getCurrentBalance` check (races the charge) + charge-after-success + free fallback on Gemini failure (unbilled output served).
Now: validate-then-charge atomically (400s never bill); `consumeCredits` 402s on `InsufficientCreditsError`, fail-closed otherwise; `refundCredits` (never throws) on the single non-success path, which returns a safe 500 instead of free output. Refund key per-attempt (`refund:eats:<attemptId>`), mirroring Gala's `refund:fail:<attemptId>`.
3 regression tests (`food-recommendations/__tests__/route.test.ts`: 402 isolation, charge-once + safe failure, refund-on-fail + sentinel); 3/3 RED pre-fix. tsc 0 errors, eslint clean, full suite 635/6/0.
Out of scope (spec slices 0/0b/1+): zod `cityId`, server-side city filter, prompt interpolation, `imageService` wiring, `saved_meals.location`.
**39. Ranked next tasks (verified 2026-09-24, main @ `4b13d85`).**
1. **Dead-file carve-out ruling** — `route_legacy.ts`, `middleware/logger.ts`, `lib/test-*` (zero inbound refs, re-verified); delete vs convert still needs your call.
Explicitly not next: 5.2 tracing (no sink per §3.3), 5.3 alerts (no channel), 2.4 Redis (deferred per §3.3), 1.3/1.4 (cross-client), 4.x (heavy independent track), Phase 6/7 (product decisions pending).

**40. 5.1 food-recommendations logging slice — PR #565.**
Converted 29 direct `console.*` calls in `src/app/api/gemini/food-recommendations/route.ts` and 4 calls in `src/lib/foodRecommendationErrorHandler.ts` to the zero-dep structured logger. `getRequestId(req)` is threaded through request-owned helpers; `entryPoint: 'food-recommendations'` is explicit metadata; raw prompt and full Gemini response content are no longer logged. The no-candidate throw, credit refund path, response envelopes, and status codes are unchanged. Independent Osmani review returned APPROVE; its Required shared-handler console finding and Optional info-level visibility finding were fixed in follow-up commit `2546a63`. Verification: focused route tests 3/3; full suite 639 passed / 6 skipped / 0 failed; `tsc --noEmit` clean; `next lint --max-warnings=1000` 0 errors with pre-existing warnings; `next build` green; CRLF 916/916; reviewed files contain zero `console.*`.

**41. Food recommendations idempotency — DONE (PR #567, merged `50220a2`; CI `verify` SUCCESS 2m48s).**
The charge-first `/api/gemini/food-recommendations` path now claims the caller's key before consuming a credit, hashes the complete request payload, replays the exact stored response, rejects in-flight duplicates with `409` + `Retry-After`, rejects key reuse with a different payload using `422`, and completes owned claims for success, insufficient-credit, and safe failure responses. Completion-store failure is logged and rethrown so the client cannot receive a false success. The web `useTaranaEatsAI` caller sends one `crypto.randomUUID()` key per generation intent. Unkeyed requests preserve the previous flow. Verification: 9 new route idempotency tests, 1 client-hook test, full suite **649 passed / 6 skipped / 0 failed**, tsc clean, lint 0 errors with pre-existing warnings, production build green, CI `verify` pass. Independent Osmani review initially requested changes for swallowed completion errors; both the completion-failure and explicit charge-state findings were fixed, and the post-fix verdict is **APPROVE**.

**Current next-task ranking after the §3.2 SSRF closeout (verified on `origin/main` @ `b2efeea`, PR #607 merged):**
1. **Expand E2E smoke into the full Phase 4.1 journey** — smoke (4 tests + CI job, #605) is the stable baseline; the audited signup → login → generate → save → dashboard path is still missing.
2. **Mobile shippability decision** — still product-scope blocked (`eas.json`, tests, CI job, local-AI stub, offline behavior); decision before code.

Closed since the prior ranking: **§3.2 SSRF decided-no-wire-target** (fate review + closeout; guard retained for future request-derived-URL surfaces), **unify `CreditService.ensureUserProfile`** (#604 via `e9094b2` — delegates to `userService.createUserProfile`/`userProfileExists`, `src/lib/referral-system/CreditService.ts:20,33-46`) and **delete `ensureFullItinerary` dead code** (#604 via `5e938fe` — `git grep ensureFullItinerary origin/main -- src` → zero).

Explicitly deferred: 2.4 Redis rate limiting (ADR/traffic decision), 5.2 tracing (no sink), 5.3 alerting (no channel), 1.3/1.4 architecture/API migration, and Phase 6/7 product work.

**42. Multi-agent refund outcome propagation — DONE (PR #569, merged `38c9b29`; CI `verify` SUCCESS).**
`CreditService.refundCredits()` returns a boolean and does not throw for RPC/no-op failures. `PipelineCoordinator` now inspects that result, retries the same `refund:${session.id}` idempotency key once, marks `__galaRefunded` only after a confirmed `true`, and preserves the original generation error when both attempts fail or throw. The multi-agent route now reports the actual coordinator/fallback refund result instead of hardcoding `refunded: true`; its fallback remains scoped to the post-success throw path where `session` is defined. Added 6 coordinator tests and 2 multi-agent route tests. Verification: full suite **654 passed / 6 skipped / 0 failed** (82 suites), tsc clean, lint 0 errors with pre-existing warnings, build green, CI `verify` pass, independent Osmani review APPROVE.

The multi-agent generator idempotency gap is closed by PR #571, refresh-to-generator forwarding by PR #572, parser logging by PR #573, approved production dead-file cleanup by PR #574, auth logging by PR #575, credit-diagnostics logging by PR #576, spots logging by PR #577, locations logging by PR #578, stats logging by PR #579, traffic-analysis logging by PR #581, route-calculation logging by PR #583, referrals-debug logging by PR #585, reindex logging by PR #587, cron refresh hardening by PR #589, refresh-scheduler logging by PR #592, and monitor placeholder removal by PR #594. The remaining standalone diagnostics are intentionally retained.

**43. Multi-agent generator idempotency — IMPLEMENTED (PR #571, commit `a55c3da`; CI `verify` PASS 2m45s; Vercel PASS).**
The production `USE_MULTI_AGENT=true` path now claims `Idempotency-Key` before `PipelineCoordinator.handleRequest`, so the coordinator cannot charge a duplicate request. Owned claims replay the exact stored response, return 409 with `Retry-After` for in-flight duplicates, and return 422 for payload mismatches before generation. Client 400/401/402 outcomes are not completed, so a corrected retry can reclaim the key after the 5-minute pending TTL; owned 200/500 outcomes complete. Completion persistence failures are logged without converting a successful generated itinerary into a refundable 500. Raw wire-body hashes are shared by the multi-agent and standard generator modes. Verification: multi-agent route tests **10/10**, standard generator idempotency tests **4/4**, full suite **662 passed / 6 skipped / 0 failed**, `tsc --noEmit` clean, lint 0 errors with pre-existing warnings, production build green, and independent Osmani review **APPROVE**.

**44. Refresh internal idempotency forwarding — IMPLEMENTED (PR #572, commit `72fb469`; CI `verify` PASS 2m5s; Vercel PASS).**
The refresh route now reads the caller's `Idempotency-Key`/`X-Idempotency-Key` through the shared parser and forwards the exact valid key to the generator. Missing keys remain unkeyed; the route does not synthesize a key that could conflate legitimate refreshes of the same itinerary. The saved-trip web caller now creates one scoped `refresh:<itineraryId>:<UUID>` key per refresh invocation and sends it on the POST. The refresh route's database save remains intentionally outside this charge-key slice, so a replayed generation can still advance `refreshCount` as a completed refresh. Verification: focused refresh + generator suites **21/21**, full suite **664 passed / 6 skipped / 0 failed**, `tsc --noEmit` clean, lint 0 errors with pre-existing warnings, production build green, browser smoke on the saved-trip page with no console errors, and independent Osmani review **APPROVE**.

**45. 5.1 parser structured logging — IMPLEMENTED (PR #573, commit `8898d29`; CI `verify` PASS 2m41s; Vercel PASS).**
All four live `console.*` calls in `src/lib/robustFoodJsonParser.ts` now use the zero-dependency structured logger with `entryPoint: robust-food-json-parser`. Start/success events are informational; strategy failures and the empty fallback are warnings. The parser logs only response length, strategy, and sanitized error messages; raw AI response content is not logged. Verification: valid and malformed parser smoke cases passed, food-recommendations route tests **12/12**, full suite **664 passed / 6 skipped / 0 failed**, `tsc --noEmit` clean, lint 0 errors with pre-existing warnings, production build green, parser console grep zero, and independent Osmani review **APPROVE**. The repository's legacy `test-food-recommendations-fix.ts` smoke file still has one unrelated pre-existing `testErrorHandling` expectation mismatch: it expects `GENERATION` for an error containing JSON while the handler classifies it as `PARSING`; no error-classification code was changed in this slice.

**46. Production dead-file cleanup — IMPLEMENTED (PR #574, commit `8b31877`; CI `verify` PASS 2m42s; Vercel PASS).**
Per explicit user scope, deleted `src/app/api/gemini/food-recommendations/route_legacy.ts` and `src/middleware/logger.ts`. Both had zero inbound references, no test/build/route wiring, and no user-visible impact; the active food route and middleware composition remain unchanged. The three standalone diagnostic scripts were intentionally retained. Verification: `tsc --noEmit` clean, full suite **664 passed / 6 skipped / 0 failed**, lint 0 errors with pre-existing warnings, production build green, CI `verify` pass, and independent Osmani review **APPROVE**.

**47. 5.1 auth route structured logging — IMPLEMENTED (PR #575, commit `2a8d3f8`; CI `verify` PASS 2m47s; Vercel PASS).**
Converted all 11 live console calls across `consent`, `forgot-password`, `register`, and `reset-password` to the structured logger with route `entryPoint` and request IDs. Referral codes, reset tokens, emails, passwords, and raw error objects are not logged. Auth and password-reset tests now assert logger metadata instead of console spies. Verification: focused auth/integration suites **49 passed / 5 skipped**, full suite **664 passed / 6 skipped / 0 failed**, `tsc --noEmit` clean, lint 0 errors with pre-existing warnings, production build green, auth route console grep zero, and independent Osmani review **APPROVE**.

**48. 5.1 credit diagnostics logging — IMPLEMENTED (PR #576, commit `ea3b37c`; CI `verify` PASS 2m55s; Vercel PASS).**
Converted the credit test-consumption console call to `logger.info` with `/api/credits/test-consumption` entryPoint, the caller's user ID, and request ID. Added a logger regression assertion; no secrets or new response fields are introduced. Verification: focused credit suite **4/4**, full suite **664 passed / 6 skipped / 0 failed**, `tsc --noEmit` clean, lint 0 errors with pre-existing warnings, production build green, credit route console grep zero, and independent Osmani review **APPROVE**.

**49. 5.1 spots structured logging — IMPLEMENTED (PR #577, commit `76f87ed`; CI `verify` PASS 2m50s; Vercel PASS).**
Converted all five spots-route console calls to structured `debug`/`info`/`error` logging with `/api/spots` entryPoint and request IDs. Rotation guards and fallback behavior are unchanged; metadata contains only bounded public city/catalog data and sanitized error fields. Verification: focused spots suite **13/13**, full suite **664 passed / 6 skipped / 0 failed**, `tsc --noEmit` clean, lint 0 errors with pre-existing warnings, production build green, spots route console grep zero, and independent Osmani review **APPROVE**.

**50. 5.1 locations search structured logging — IMPLEMENTED (PR #578, commits `dd68e25` + `064fcfa`; CI `verify` PASS 2m15s; Vercel PASS).**
Converted all three `/api/locations/search` console calls to structured logging with request IDs and `/api/locations/search` entryPoint. Search start/completion logs contain only query length and result count; malformed bounds logs only `hasBounds`, never raw client input. Added three route tests for success, invalid bounds, and short-query rejection. Verification: focused locations suite **3/3**, full suite **667 passed / 6 skipped / 0 failed**, `tsc --noEmit` clean, lint 0 errors with pre-existing warnings, production build green, locations route console grep zero, and independent Osmani review **APPROVE**.

**51. 5.1 stats structured logging — IMPLEMENTED (PR #579, commit `8d02bd0`; CI `verify` PASS 2m47s; Vercel PASS).**
Converted the remaining `GET /api/stats` console error to structured logging with request correlation and `/api/stats` entryPoint. Raw database errors are not logged; the public success response and `{ error: 'Failed to get stats' }` / HTTP 500 failure contract are unchanged. Added deterministic coverage for failure logging and success-path silence. Verification: focused stats suite **2/2**, full suite **667 passed / 6 skipped / 0 failed**, `tsc --noEmit` clean, changed-file ESLint 0 errors, project lint 0 errors with pre-existing warnings, production build green, stats route console grep zero, and independent Osmani review **APPROVE**.

**52. 5.1 traffic-analysis structured logging — IMPLEMENTED (PR #581, commit `b4de66d`; CI `verify` PASS 2m26s; Vercel PASS).**
Converted all three console calls in `GET /api/routes/traffic-analysis/[id]` to structured logging with request correlation and `/api/routes/traffic-analysis/[id]` entryPoint. Logs contain only bounded `routeIdLength`; raw route IDs and raw error objects are not logged. The read-only response contract and `timedHttp` status extraction are unchanged. Added two focused route tests covering successful bounded metadata logging and missing-ID rejection. Verification: focused traffic-analysis suite **2/2**, full suite **669 passed / 6 skipped / 0 failed**, `tsc --noEmit` clean, changed-file ESLint 0 errors, project lint 0 errors with pre-existing warnings, production build green, route console grep zero, and independent Osmani review **APPROVE**.

**53. 5.1 route-calculation structured logging — IMPLEMENTED (PR #583, commit `d91b09c`; CI `verify` PASS 2m59s; Vercel PASS).**
Converted all eight console emitters in `POST /api/routes/calculate` to structured logging with validated request correlation and `/api/routes/calculate` entryPoint. Logs contain only bounded counts, lengths, scores, booleans, and fallback state; origin/destination names, raw route IDs, and raw upstream error objects are not logged. The legacy response `requestId` field, fallback behavior, validation responses, and status codes are unchanged. Added three focused route tests and hardened the shared `handleApiError` mapper to log `safeMessage` rather than raw error messages, with a dedicated regression test. Verification: focused route suite **3/3**, shared error-mapper regression **1/1**, full suite **673 passed / 6 skipped / 0 failed**, `tsc --noEmit` clean, changed-file ESLint 0 errors, project lint 0 errors with pre-existing warnings, production build green, calculate route console grep zero, and independent Osmani review **APPROVE**.

**54. 5.1 referrals-debug structured logging — IMPLEMENTED (PR #585, commit `39004c9`; CI `verify` PASS 2m20s; Vercel PASS).**
Converted the two remaining `POST /api/referrals/debug` console emitters to structured logging with `/api/referrals/debug` entryPoint and request correlation. New logs contain only bounded active-referral, tier, and credit outcome fields; user IDs and raw Supabase error objects are not logged. Authentication, the development-only production gate, Supabase calls, response shape, and status codes are unchanged. Added three focused tests covering authentication gating, successful tier updates, and update failure sanitization. Verification: focused referrals-debug suite **3/3**, full suite **676 passed / 6 skipped / 0 failed**, `tsc --noEmit` clean, changed-file ESLint 0 errors, project lint 0 errors with pre-existing warnings, production build green, route console grep zero, and independent Osmani review **APPROVE**.

**55. 5.1 reindex structured logging — IMPLEMENTED (PR #587, commit `b58b3ac`; CI `verify` PASS 1m59s; Vercel PASS).**
Converted both remaining `POST /api/reindex` console errors to structured logging with `/api/reindex` entryPoint and request correlation. Logs contain only bounded activity indexes and error names; admin secrets, activity titles, and raw rejection reasons are not logged. Constant-time admin auth, fixed activity selection, `Promise.allSettled`, and `{ total, indexed, failed }` responses are unchanged. Added three focused tests covering invalid auth, successful indexing, and partial embedding failure sanitization. Verification: focused reindex suite **3/3**, full suite **679 passed / 6 skipped / 0 failed**, `tsc --noEmit` clean, changed-file ESLint 0 errors, project lint 0 errors with pre-existing warnings, production build green, route console grep zero, and independent Osmani review **APPROVE**.

**56. Cron refresh endpoint hardening — IMPLEMENTED (PR #589, commit `b1dc33f`; CI `verify` PASS 2m19s; Vercel PASS).**
Activated the formerly extensionless handler as `route.ts`, then failed closed when `CRON_SECRET` is absent in every environment. GET and manual POST now require `Authorization: Bearer <CRON_SECRET>` with fixed-length hash comparison; POST accepts only strict `{ notify: boolean }` input and rejects declared bodies over 16 KiB. Manual idempotency keys are namespaced to prevent collisions with scheduled keys, cron claims use a 60-minute pending TTL, and the shared idempotency service accepts an optional route-specific TTL. Success responses expose aggregate counts only; full itinerary result/PII payloads were removed. Errors and logs contain bounded metadata/error names only. Added 11 focused tests covering missing/invalid auth, response scrubbing, body validation/size, notification control, replay, conflict, payload mismatch, and evaluation failure. Verification: focused cron suite **11/11**, full suite **690 passed / 6 skipped / 0 failed**, `tsc --noEmit` clean, project lint 0 errors with pre-existing warnings, production build green with `/api/cron/evaluate-refreshes` present in the route table, independent Osmani review **APPROVE**, and independent security audit **APPROVE**.

**57. 5.1 refresh-scheduler structured logging — IMPLEMENTED (PR #592, commit `d467bb2`; CI `verify` PASS 2m46s; Vercel PASS).**
Replaced every `console.*` emitter in `src/lib/services/refreshScheduler.ts` with structured logs carrying the `refreshScheduler` entryPoint and bounded counts, booleans, enum reasons, severity/confidence, duration, and error names. Itinerary IDs, titles, reason text, and raw error objects are no longer logged. The authenticated cron request ID now propagates through evaluation, filtering, batching, manual evaluation, and notification helpers. Returned `ScheduledEvaluationResult` values, filter conditions, batch concurrency/delay, error counting, and notification selection behavior are unchanged. Added four adversarial scheduler tests using private itinerary/place/reason sentinels; cron route tests assert requestId propagation. Verification: focused scheduler + cron suites **15/15**, full suite **694 passed / 6 skipped / 0 failed**, `tsc --noEmit` clean, project lint 0 errors with pre-existing warnings, production build green, scheduler console grep zero, and independent Osmani review **APPROVE**.

**58. Monitor placeholder removal — IMPLEMENTED (PR #594, commit `3cc95f6`; CI `verify` PASS 2m43s; Vercel PASS).**
Deleted the registered but unused `/api/routes/monitor` placeholder. Evidence: zero in-repo callers or tests; unauthenticated and rate-limit-free creation; unbounded in-memory session Map; hardcoded empty `trafficAlerts`; no alert-threshold behavior; module-level `setInterval`; and a misleading GET/DELETE `[id]` implementation registered at the non-dynamic `/api/routes/monitor` path. Removed the dead `RouteMonitoringResponse` interface, stale API documentation, and bundle-baseline entry. The independent `realTimeTrafficMonitor.ts` service and its shared types remain intact. Verification: full suite **694 passed / 6 skipped / 0 failed**, `tsc --noEmit` clean, project lint 0 errors with pre-existing warnings, production build green, build route table contains no monitor route, exact route/type/baseline reference scans zero, and independent Osmani review **APPROVE**.

**59. Explore stateless traffic refresh — IMPLEMENTED (commit `f649364`; 2026-09-25).**
Replaced the mock `GET /api/routes/traffic-analysis/[id]` response with a stateless `POST` handler. Explore now sends the current route snapshot (`id`, `summary.travelTimeInSeconds`, and bounded `geometry.coordinates`) to the endpoint; the handler validates the request with strict Zod schemas, requires the path/body route ids to match, caps coordinate count and declared body size, calls the existing `routeTrafficAnalyzer`, and returns only `RouteTrafficAnalysis`. The unused in-memory `realTimeTrafficMonitor` service and deleted `/api/routes/monitor` placeholder remain untouched; no new session state or alert subsystem was introduced. The analyzer's existing fallback behavior is unchanged. Converted its 11 direct console emitters to bounded structured logging as part of this slice. Verification: focused route/hook suites **12/12**, full suite **699 passed / 6 skipped / 0 failed**, `tsc --noEmit` clean, project lint **0 errors** with pre-existing warnings, production build green, and independent Osmani review **APPROVE**.

**60. Production refresh/auth log hardening — IMPLEMENTED (commit `0e8aa64`; 2026-09-25).**
Bounded the refresh and authentication log plane with `getSafeErrorMetadata()` (`errorName` plus optional short `errorCode` only). Removed raw stacks, Supabase error objects, upstream response bodies, prompt fragments, raw environment values, and client/server itinerary error logging from the targeted runtime path. Request IDs and stable entry points remain on request-owned logs; the isomorphic `savedItineraries` helper dynamically imports the server logger only inside its server branch. Added sentinel regressions for refresh upstream text/prompts, consent, registration profile errors, Google auth PII, and the metadata helper. Verification: focused logging/auth/refresh suites **82/82**, full suite **705 passed / 6 skipped / 0 failed**, `tsc --noEmit` clean, changed-file ESLint clean, project lint **0 errors** with pre-existing warnings, and independent Osmani review **APPROVE**. Local production build was attempted three times but was blocked by the current working tree's unrelated settings changes plus Next 15.5.25/Node 23 generated `PageNotFoundError`/module-cache failures; the pushed `main` CI build then passed in run `36056729287`.
