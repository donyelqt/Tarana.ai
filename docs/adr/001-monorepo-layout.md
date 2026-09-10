# ADR 001 — Monorepo layout: web app at root, mobile nested (no `apps/` + `packages/`)

- **Status:** Accepted
- **Date:** 2026-09-10
- **Deciders:** Doniele Arys Antonio

## Context

The web app (Next.js) has been developed since 2025 as a single-app repository: source at root (`src/`, `public/`, configs, CI, Vercel project all assume repo root). The Expo mobile app (`tarana-mobile/`) arrived in 2026, after the web app, its pipelines, and its conventions were established. A greenfield layout was never on the table — any structure had to absorb a second app into a living, deployed first app without breaking it.

## Decision

Keep the web app at the repository root. Nest the mobile app at `tarana-mobile/` as a second pnpm workspace member (`pnpm-workspace.yaml`: `.` + `tarana-mobile`, single lockfile). No `apps/*` + `packages/*` normalization.

Cross-boundary sharing is explicit and minimal: the `tarana-web/*` tsconfig alias plus `tarana-mobile/metro.config.js` remap (single current consumer: the Supabase client factory). No shared `packages/` entry until a genuine third consumer exists.

## Alternatives considered

1. **`apps/web` + `apps/mobile` (+ `packages/`) restructure.** Rejected: moves every import path, both tsconfigs, Metro + Next configs, and CI/Vercel project settings for zero functional change. All cost, no unblocked work. Revisit trigger below.
2. **Separate repo for mobile.** Rejected: duplicates auth/DB/CI knowledge, splits the single lockfile benefit, and strands the shared Supabase + identity architecture across two histories.

## Consequences

- **Accepted costs:** asymmetric layout (newcomers must learn root *is* an app); duplicated `node_modules` (~286MB measured); hand-rolled bridges (alias + Metro remap + root tsconfig exclude) instead of tooling-native sharing; version skew must be watched (React 19.2.5 vs 19.3.0 observed at adoption).
- **Gains kept:** zero migration risk to the production web app; each app typechecks/builds/tests independently; workspaces give one install graph and one version truth going forward.

## Revisit triggers (any one reopens this ADR)

1. A third app or first shared `packages/` entry (UI tokens, shared domain logic).
2. A version-skew incident traceable to the split trees.
3. A cross-import failure class the remap can't express cleanly.

## Related record

- pnpm workspaces migration: PR #393.
- `tsconfig.json` root exclude + `tarana-mobile` self-exclude repair: PR #391, follow-up in mobile sync PR #392.
- Metro remap + dead-secret removal: mobile sync PR #392.
- Mobile app plan (phases, Metro-compat probe): `specs/tarana-mobile-app-plan.md`.
