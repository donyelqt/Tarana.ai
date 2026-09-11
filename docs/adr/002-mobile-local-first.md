# ADR 002 — Mobile local-first shell + server brain (anti-clone hybrid)

- **Status:** Proposed (pending review)
- **Date:** 2026-09-12
- **Deciders:** Doniele Arys Antonio

## Context

The mobile plan (`specs/tarana-mobile-app-plan.md` §2.0, deprecated) mandated shared Supabase + `next-auth` JWT bridge as the mobile boot gate: no token, no saved trips (`tarana-mobile/src/screens/SavedTrips.tsx:33-38`), no spots (`Spots.tsx:41` requires `withMobileAuth`), no account creation without the web server (`SignUp.tsx:48-51` posts to web `/api/auth/register`). This contradicts the plan's own offline-capable premise for the paid app with on-device LLMs (Phase 4).

Market context: offline-first paid apps in PH (no account, one-time payment, private-by-default) have won store positioning on private, fast, zero-friction appeal. The same pattern shows pure local-first is quickly cloneable: the binary ships all value, with no kill-switch and no server levers.

The builder's binding worry is rebuild cost: architecture should maximize clone effort while keeping that positioning.

## Decision

Mobile goes **local-first shell + server brain**:

1. **Core loop local, no login.** Single local profile (nullable `profile_id` reserved for future multi-profile), SQLite trips CRUD, bundled Baguio curated pool + Tier 0 images. Landing → Home directly.
2. **All smart logic stays server-side behind the existing proxy.** Ranking/rotation, image tier chain (`src/lib/services/imageService.ts:90-102` keys never ship), traffic fusion, itinerary prompts. Mobile caches enrichment, never owns the algorithm. Best quality requires the server.
3. **Phase-1 bridge demoted, not deleted.** `exchangeForMobileToken()` moves to Settings → "Link web account" (one-time import, future share-link). Never a boot gate.
4. **Proxy hardened without user login.** Receipt validation (per-device entitlement), per-device rate limits, App Attest / Play Integrity when available, certificate pinning, server-side feature flags + versioned enrichment contract.
5. **No server keys in the binary.** Remove Supabase anon key from `tarana-mobile/app.json extra`; mandatory `webBaseUrl` for core loop goes away (enrichment-only).

Web app unchanged: `next-auth` + credits + Gemini remain (billing enforcement requires server identity).

## Alternatives considered

1. **Status quo: shared Supabase + login gate.** Rejected: paid-app friction (web sign-in → browser exchange → app), offline incoherence (local LLM but network-gated trips), single-identity blocks shared-device use. Keeps funnel continuity but at conversion cost.
2. **Pure local-first, no server at all.** Rejected: easiest to clone (all value in binary, stale forever), zero abuse control on enrichment, no update lever without app review. Best positioning, worst defensibility.
3. **Server-auth for everything including mobile core.** Rejected: same as (1) with more coupling; mobile dies with backend outage.

## Consequences

- **Accepted costs:** web→mobile funnel continuity lost by default (mitigated by optional link/import); phone loss = trip loss until export/backup ships; anonymous proxy needs device-level abuse controls; two data truths (local primary, server enrichment) to reason about.
- **Gains kept:** offline-first paid positioning (one-time payment, offline, private, fast); real offline core; copyable shell but hidden brain; server-side iteration without app review; weekly curated-data refresh rots clones.
- **Honest ceiling:** weeks harder to clone, not unclonable. Remaining moat is velocity + curated data + brand + reviews.

## Infra cost (startup constraint — spend as little as possible)

Web bill (Vercel functions + bandwidth, Supabase DB + egress, third-party provider APIs per call — maps, places, photos) stays regardless — this ADR avoids *incremental* mobile-driven scaling, it does not cut current spend.

| Cost driver | Shared-auth mobile | This ADR (local-first hybrid) |
|---|---|---|
| Supabase writes/reads/egress per mobile user | Every trip CRUD + every SavedTrips load hits DB; scales with users | ~Zero — trips in SQLite; DB touched only on optional link/import |
| Vercel invocations | Auth exchange + register + spots + CRUD proxies every session | Spots enrichment when online only; core loop = zero invocations |
| API per-call $ (maps search/routing/traffic, place photos) | Fresh third-party call per user/session | Same per fresh call, but bundled Baguio + 24h image cache + per-city snapshot (`synced_at`) kills repeat calls — biggest saver |
| Gemini $ | Free tier today, rate-limited; mobile users would hit the wall | Local LLM removes this scaling wall entirely |
| Marginal cost per 1k mobile users | Real (DB, egress, API calls) | Near-zero (store fees dominate) |

New fixed costs to budget: Apple Developer $99/yr + Google Play $25 once + EAS build minutes + OTA hosting (trivial). Cache TTLs are cost controls, not UX niceties — enforce them or the proxy bill eats the savings.

## Revisit triggers (any one reopens this ADR)

1. Day-1 cross-device sync demand from real users (not hypothetical).
2. Friend-graph / social greenlight (requires stable identity — reintroduces linked accounts).
3. Proxy abuse incident traceable to anonymous access.
4. Local-model quality gate (plan §6 Q1) fails — paid premise itself reopens.

## Related record

- Mobile app plan (phases, Metro-compat probe): `specs/tarana-mobile-app-plan.md` (§7 amendment).
- Phase-1 token bridge: PR #388 (`src/app/api/auth/mobile-token/route.ts`, `src/lib/auth/mobileTokenExchange.ts`).
- Mobile scaffold + screens: PRs #397/#398/#399; simulator run 2026-09-11.
- Monorepo layout: ADR 001 (`docs/adr/001-monorepo-layout.md`).
