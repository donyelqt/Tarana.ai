# Tarana Gala + Tarana Eats Security Hardening Plan

Status: IMPLEMENTED on branch fix/gala-eats-hardening. All findings verified against disk; all slices implemented and tested.
Scope: `POST /api/gemini/itinerary-generator` (Gala), `POST /api/gemini/food-recommendations` (Eats),
Eats unauthenticated `GET`, the two client hooks/forms, shared credit + idempotency + rate-limit layers.

## Execution checklist

- [x] Slice 1 (F1 HIGH + F4 MEDIUM): 32KB body cap on Eats POST; auth on Eats GET stats
- [x] Slice 2 (F5 MEDIUM): user-scoped bounded Eats caches
- [x] Slice 3 (F3 HIGH): Eats zod schema + reason-text sanitization
- [x] Slice 4 (F2 HIGH): server-side Eats catalog
- [x] Slice 5 (F6 MEDIUM + F7 LOW + F8 LOW): bench alerting, stable idempotency keys, log redaction
- [x] Full verify: tsc + route suites + audit + plan checkboxes ticked

## 0. Threat model (STRIDE, 5 minutes)

Trust boundaries: HTTP request body, client preferences override, LLM output (Gemini text),
upstream APIs (TomTom, OpenWeather, Gemini), credit ledger, idempotency store, in-memory caches,
bench HMAC header, error responses, logs.
Assets: credits (money), user identity, prompt PII, Gemini API spend, cache integrity, error intel.
Abuse cases: credit drain via retries, prompt injection steering output, cache poisoning across users,
unauthenticated monitoring scrape, bench bypass forgery, body-size DoS, error-oracle probing.

## 1. Verified strengths (do not regress)

1. Both POST routes sit behind `withAuth` (`itinerary-generator/route.ts:305`, `food-recommendations/route.ts:89`).
   Unauthenticated callers get 401 before generation or charge logic runs.
2. Gala validates with a bounded zod schema (`route.ts:32-57`): prompt 1-5000 chars, weather subfields
   capped, interests max 25 x 100 chars, budget/pax capped, cityId allowlisted to 6 values, plus a 32KB
   body cap with loud 413 (`route.ts:347-353`). Shape and size both enforced before charge.
3. Both routes charge before generating via atomic `consumeCredits` RPC, refund on failure/zero-result
   with per-attempt idempotency keys, and answer 402 fail-closed on `InsufficientCreditsError`.
   Verified: Eats 12/12, Gala idempotency + multi-agent refund suites green (26/26 combined).
4. Idempotency claim runs after validation and before charge on both routes, with replay/409/422
   branches and `Retry-After: 1`. Verified in tests (conflict and payload-mismatch cases).
5. Eats grounds every model match against the restaurant registry (`validateAndEnhanceRecommendations`,
   `route.ts:465-538`): hallucinated names dropped, duplicates deduped, min-3 backfill from the
   deterministic engine, hard cap of 5. Model output never reaches the client unfiltered.
6. Eats error responses are user-friendly only (`createErrorResponse`,
   `foodRecommendationErrorHandler.ts:174-184`): no stack, no upstream text in the response body.
7. Middleware rate-limits `/api/gemini/*` under the heavy bucket (10/min, 10-min block,
   `src/middleware/index.ts:24-25`) plus 429 + `Retry-After` headers.
8. `tsc` clean at audit time. Route suites green.

## 2. Findings (severity-ordered, each verified)

### F1 HIGH: Eats POST has no body-size cap; Gala has 32KB (DoS asymmetry)
- [x] Fixed + tested
Gala rejects `content-length > 32KB` with 413. Eats calls `req.json()` unbounded (`route.ts:109`),
then interpolates the whole `foodData` object into the model prompt (`route.ts:274-292`). A hostile
client can push a multi-MB `foodData.restaurants` array through parsing, JSON serialization, and
per-restaurant `menuIndexingService.indexRestaurants` compute before any charge decision matters.
Fix: mirror the Gala 32KB cap (or a measured Eats-appropriate bound; legit client payload is
`combinedFoodData`, so measure p99 first) with the same loud 413. Test: oversized body returns 413
without charging. Effort: S.

### F2 HIGH: Eats accepts unbounded client-controlled `foodData` as ground truth (trust inversion)
- [x] Fixed + tested
`getRelevantRestaurants(foodData.restaurants, ...)`, `buildRestaurantLookup(foodData.restaurants)`,
and `menuIndexingService.indexRestaurants(foodData.restaurants)` all consume the client-sent catalog
(`route.ts:206-250`, `401-407`). A tampered client can inject fake restaurants with attacker prices,
and grounding (`validateAndEnhanceRecommendations`) will happily certify them because it grounds
against the same poisoned list. Gala does not have this hole: its activity pool is server-side
(`findAndScoreActivities`). Fix: server-side the catalog (import the registry in the route, ignore or
cross-check client `foodData` against it) or hash-pin the client catalog against the registry version.
Test: poisoned `foodData` with a fake restaurant returns zero matches for it. Effort: M.

### F3 HIGH: Eats POST has no input schema; prompt parsing is regex over raw text (injection surface)
- [x] Fixed + tested
Gala enforces `itineraryRequestSchema` (lengths, enums, caps). Eats checks `if (!prompt)` only
(`route.ts:113-118`), then `parseUserPreferences` runs bare regexes over the raw prompt
(`route.ts:749-801`): budget via `/₱(\d+)/`, pax via `/(\d+)\+?\s*(?:people?|pax)/i`, location via
`/at\s+(.+?)(?:\s+for|$)/i`. No length cap, no allowlist, no sanitizer import anywhere in either
Gemini route. Prompt text flows into `enhancedPrompt` and straight to `model.generateContent`.
The grounding layer mitigates output hallucination but not instruction smuggling inside `reason`
strings, which render in `FoodMatchCard`/`FoodMatchesPreview` as JSX text (auto-escaped, so XSS is
contained, but social-engineering text is not filtered). `hydrateMatchFromRestaurant`
(`route.ts:577-587`) appends server-composed budget/item sentences onto the raw model `reason`
without sanitizing it first. Fix: zod schema for Eats (prompt 1-5000, `foodData` size-bounded,
preferences typed), length-cap before regex, and a reason-text allowlist (strip URLs, instructions,
and non-menu claims) before returning matches. Test: 6KB prompt rejected; `reason` containing a URL
is stripped. Effort: M.

### F4 MEDIUM: Unauthenticated monitoring endpoints leak operational intel
- [x] Fixed + tested
Eats `GET` (`route.ts:943-972`) answers `health` and full error `stats` with no auth. Gala exposes
`?action=health` and `?action=metrics` inside the authed POST, but the GET surface is the Eats gap:
`getStats()` returns `totalErrors`, per-type counts, and `lastError` (type + requestId + timestamp).
An unauthenticated scanner can fingerprint failure modes and retry timing. Fix: wrap the GET in
`withAuth` or gate `stats` behind it while leaving a bare `health` open. Test: unauthenticated
`?action=stats` returns 401. Effort: S.

### F5 MEDIUM: Module-level in-memory caches are per-instance and user-blind (correctness + DoS)
- [x] Fixed + tested
Eats `responseCache`/`preprocessingCache` (`route.ts:82-84`) are unbounded `Map`s keyed by
`prompt.substring(0,30)+budget+cuisine+pax` with no userId in the key and no size cap: cross-user
cache hits serve one user's phrasing to another, and 30-minute TTL entries accumulate per instance.
Gala's `unstable_cache` path keys `userId:hash` (safe) but the refresh path bypasses it. Fix: include
`userId` in Eats cache keys, cap map size with LRU eviction, and document the refresh-bypass parity.
Test: two users with identical prompts get isolated cache entries. Effort: S.

### F6 MEDIUM: Bench HMAC bypass skips charges on both money paths (blast-radius control)
- [x] Fixed + tested
`withAuth` honors `x-bench-token` HMAC (`withAuth.ts:35-38`), and both routes skip charges for bench
identity (Gala `route.ts:328-341` + coordinator parity; Eats bench user holds no real balance context).
The HMAC is sound (timing-safe compare, 5-min windows, non-prod fail-closed per `benchToken.ts:17-20`),
but a leaked `BENCH_HMAC_SECRET` converts directly to free generations on both billable routes.
Fix: alert on bench-identity charge-skips in production logs, rotate the secret on a schedule, and
assert `NODE_ENV != production` in CI. Test: bench token in prod config returns 401. Effort: S.

### F7 LOW: Eats idempotency key is client-minted per click with no stability guidance
- [x] Fixed + tested
`useTaranaEatsAI.ts:38` mints `randomUUID()` per submit, so retries never dedupe (same defect class
as the Smart Refresh fix in PR #620). Gala clients share the pattern. Fix: derive the key from a
stable form fingerprint (hash of budget+cuisine+pax+restrictions+mealType) so identical resubmits
collapse. Test: double-submit with same form replays instead of double-charging. Effort: S.

### F8 LOW: Verbose preference logs carry raw prompt-derived values
- [x] Fixed + tested
Eats logs parsed `pax/budget/cuisine/restrictions` plus full `promptFeedback` objects
(`route.ts:197-203`, `349-351`); Gala logs prompt substrings in charge descriptions and full error
details server-side. No passwords or keys observed, but prompt text can carry PII (names, hotels,
dates). Fix: keep counters, drop raw values from info-level logs (debug only, redacted). Effort: S.

## 3. Dependency audit (verified 2026-09-26)
`pnpm audit --audit-level=critical --prod`: 34 findings (4 low / 10 moderate / 20 high). Triage per
the skill decision tree: map each high to reachability in the Gala/Eats runtime path before fixing;
do not bulk-fix. Re-run after every dependency change; CI already gates `critical --prod`.

## 4. Sequenced hardening slices (each independently shippable, tests first)
1. F1 + F4: body cap on Eats POST; auth on Eats GET stats. Smallest diff, loudest rejects.
2. F5: user-scoped bounded Eats caches.
3. F3: Eats zod schema + reason-text sanitization.
4. F2: server-side Eats catalog (largest, needs registry import + poison test).
5. F6 + F7 + F8: bench alerting/rotation test, stable idempotency keys, log redaction.

## 5. Verification record (implementation 2026-09-26)
- `npx tsc --noEmit`: clean after every slice (exit 0); eslint clean on route, hook, and touched suites.
- 50/50 pass: Eats route (21, incl. body-cap 413, 413-before-validation, schema 400, stats 401,
-  reason-strip, instruction-strip, fallback 200, poison-refund-500, cache isolation), Gala
-  routeIdempotency (7) + multiAgentRefund, Eats hook stable-key (2), benchToken. Shipped as slices
-  #625-#629: Gala 413/400/401 coverage; Eats catalog fingerprint in the response-cache key;
-  `__resetFoodRecommendationCachesForTests` test isolation; zero-result refund fail-closed;
-  413-before-validation, instruction-strip, and catalog-fallback coverage.
- Slice RED proofs: slice 1 (3 fail without fix), slice 3 (1 fail without), slice 4 (1 fail without, isolated).
- Follow-up fix: billed generations that ground to zero matches now throw into the
- refund-and-safe-500 path instead of returning a cached unbilled empty 200 (poison test asserts
- 500 + one refund + `complete(500)`).
- `pnpm audit --prod`: 34 findings (unchanged scope; dependency upgrades out of scope for these slices).
- Browser: not applicable (no UI change; server-route hardening).

## 6. What was intentionally not touched
- Credit ledger internals, refund math, idempotency store schema: out of scope for the prompt-validation
  and trust-boundary findings above; covered by existing money-correctness plans in specs/.
- Client form UX copy and layout: no visual change proposed.
- Bench bypass removal: load testing needs it; hardening (F6) preserves the capability with controls.
