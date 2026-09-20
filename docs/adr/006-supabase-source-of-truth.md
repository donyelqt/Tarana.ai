# ADR 006 — Supabase (Postgres + pgvector) as the single source of truth; code-catalog feeds it

- **Status:** Accepted
- **Date:** 2026-09-20
- **Deciders:** Doniele Arys Antonio

## Context

Two data stores coexist: Supabase Postgres (users, itineraries, saved_meals, credit_transactions, places) with a pgvector embedding catalog (`itinerary_embeddings`, 768-dim), and the code catalog (`src/app/itinerary-generator/data/itineraryData.ts` — the curated Baguio supplement, ~37→~50 rows). The indexer (`scripts/indexSampleItinerary.ts`) sources exclusively from the code catalog; the serving path (`activitySearch.ts`) reads the same catalog via `sampleItineraryCombined`.

A prior spec (`tasks/plan.md`, write-only) recorded the mixed-embedding-geometry risk: live rows were 37 × 768-dim in an older model space while the live embedder is `gemini-embedding-001` pinned to 768d — same width, different geometry, so appending new rows without a full re-index silently corrupts cosine ranking.

RLS posture went through remediation (2026-09-19): `saved_meals` had permissive `USING(true)` policies live in prod — any anon client could read/write all users' rows. The client was moved off the anon key onto session-authed server routes; SQL remediation recreated `auth.uid() = user_id` policies.

## Decision

1. **Supabase is the single source of truth for persistent state.** Users, itineraries, saved trips/meals, credit transactions, places, and the embedding catalog all live in Postgres. No second durable store (no Redis, no separate search index — `unstable_cache` is a cache, not a store).
2. **The code catalog is the source for curated data; the DB follows code.** New activities land in `itineraryData.ts` first; the indexer embeds and upserts into the DB. No DB-first or ad-hoc inserts — the upsert key is `act.title` (`scripts/indexSampleItinerary.ts:24`), so a title rename orphans the old row.
3. **Any catalog expansion re-indexes the full corpus in one pass.** Appending new rows alone corrupts cosine ranking (the migration orders by `embedding <#> query_embedding` — mixed geometries rank silently wrong). This is a hard gate, not a nicety.
4. **Authorization lives server-side.** Client modules do not query Supabase with the anon key for user-owned data; server routes read the NextAuth session and query with the service-role admin client. The client never sends a userId it could forge.
5. **RLS is defense-in-depth, not the primary gate.** The REVOKE migrations (`20260918000000_revoke_anon_from_credit_rpcs.sql`, `20260919000000_saved_meals_rls_remediation.sql`) close the anon-EXECUTE and permissive-policy holes; probes (`scripts/prove-revoke-anon.mjs`, `scripts/prove-saved-meals-rls.mjs`) verify.

## Alternatives considered

1. **Separate search index (Elasticsearch, Typesense).** Rejected: pgvector with 768-dim cosine similarity already serves the retrieval path; a second index duplicates the catalog and adds an infra dependency for zero unblocked work. Revisit if pgvector's recall degrades at real scale.
2. **DB-first catalog (activities live only in Postgres).** Rejected: the code catalog is reviewable in PRs, versioned in git, and survives DB drift; DB-first would make every activity edit a migration. Revisit when the catalog exceeds ~100 rows and PR review stops scaling.
3. **Client-side anon-key queries with RLS as the only gate.** Rejected twice (saved_meals remediation, credit-RPC REVOKE): permissive policies were live in prod once; fail-closed must not depend on RLS staying perfect. Session-authed server routes are the primary gate.
4. **Redis as a second durable store.** Rejected: `unstable_cache` (30-min revalidation) already provides free cross-instance caching on Vercel; a Redis store is another thing to operate. §3.3's no-Redis rule applies.

## Consequences

- **Accepted costs:** every catalog expansion costs a full re-index (embedding-API quota bound; off-peak single pass, stop-on-429); title renames orphan rows (manual DELETE required); the asymmetric "code feeds DB" direction must be taught.
- **Gains kept:** one version truth; the catalog is PR-reviewable; mixed-geometry corruption is structurally prevented; authorization is server-side with RLS as depth.

## Revisit triggers (any one reopens this ADR)

1. pgvector recall degrades at real scale (search index reopens).
2. The catalog exceeds ~100 rows (DB-first reopens).
3. A third durable store becomes load-bearing (Redis rule reopens).
4. A catalog expansion is proposed without a full re-index (hard gate violated).

## Related record

- pgvector migration: `20240730000000_add_itinerary_embeddings_pgvector.sql`.
- Corpus expansion spec: `tasks/plan.md` (write-only).
- saved_meals RLS remediation: migration `20260919000000` + `scripts/prove-saved-meals-rls.mjs`.
- Credit RPC REVOKE: migration `20260918000000` + `scripts/prove-revoke-anon.mjs`.
- Monorepo layout: ADR 001.
