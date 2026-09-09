# Tarana Mobile App — Phase 3: Expo Scaffold

**Status:** Plan (write-only, do not implement until approved)
**Date:** 2026-09-09
**Depends on:** Phase 1 (auth bridge, merged PR #388) — `src/expo/auth/mobileTokenStore.ts` is the mobile auth contract.
**Scope:** Expo managed workflow, React Navigation, NativeWind; reuse `src/lib` business logic; mobile screens mirroring web flows.
**Acceptance:** app runs on iOS and Android simulators.

> Phase 2 (local model validation) is explicitly skipped per instruction.

## Environment (verified 2026-09-09)
- **Android Studio Quail 4 | 2026.1.4** installed via winget
  (`Google.AndroidStudio`, v2026.1.4.7). The winget `--install-location`
  flag is silently ignored by this winget version (v1.29.290), so it landed
  on C: at `C:\Program Files\Android\Android Studio\` — `studio64.exe`
  confirmed working (`Android Studio Quail 4 | 2026.1.4`).
- **Existing SDK intact** at `%LOCALAPPDATA%\Android\sdk` (10.7 GB, incl.
  one 8.7 GB system image). Reuse — do not reinstall. Platforms
  `android-34/35/36`; system-images `android-35/36`; `emulator.exe` present.
  **Simulators are achievable on this host.**
- Node 23.11.0 active. fnm has Node 18.20.8 installed but its shell integration
  is not configured, so version switching is unavailable — Expo 57's minimum
  is Node 22.13.x, so Node 23 is fine.
- No Expo/EAS tooling installed globally. No simulators/phones attached yet.
- D: has 852 GB free; C: is 475 GB.

## Expo scaffold (verified working)
- `tarana-mobile/` created with `create-expo-app@latest --template blank-typescript`.
  Expo 57.0.21, React Native 0.86.3, React 19.3.0.
- **Verified:** `npx expo export --platform web` bundles cleanly — 183 modules,
  368KB JS, favicon + index.html + metadata.json produced.
- Template gaps fixed from official v57.0.0 dependency table
  (https://docs.expo.dev/versions/v57.0.0/):
  - `react-native-web` was `^0.21.2` → pinned to **0.21.0** (the documented
    RN Web version for SDK 57; 0.21.2 pulls `react-dom/client` with a
    mismatched peer range).
  - `react` 19.2.3 → **19.3.0** and added **react-dom 19.3.0** (blank template
    omits react-dom entirely; `react-native-web` imports `react-dom/client`).
  - All installs use `--legacy-peer-deps` (npm 10's strict resolver rejects
    the otherwise-compatible 19.x ranges).

## Reuse targets (verified present)
- `src/lib/data/supabaseClient.ts` — Supabase client
- `src/lib/data/supabaseAdmin.ts`, `supabaseMeals.ts`
- `src/lib/ai/embeddings.ts` — Gemini embedder
- `src/lib/auth/auth.ts`, `src/lib/auth/mobileToken.ts` — auth + mobile token
- `src/lib/data/savedItineraries.ts` — saved trips
- `src/lib/search/vectorSearch.ts` — vector search
- `src/lib/services/imageService.ts` — image resolution
- `src/app/itinerary-generator/data/itineraryData.ts` — activity catalog
- `src/lib/traffic/tomtomTraffic.ts` — traffic

**Reuse risk verified:** scanned all `src/lib/*` for Next.js-only imports.
Only `src/lib/auth/withAuth.ts` couples to Next (`next/server`), and it is a
middleware helper — not on the mobile reuse path. The rest of `src/lib` is
framework-agnostic, so the alias-reuse strategy holds.

## Architecture Decisions
1. **Expo managed workflow**, not bare React Native. EAS Build + store tooling is the faster on-ramp and matches the plan's decision record.
2. **Single Expo project** in a new `mobile/` directory at the repo root — not a monorepo retrofit. The repo already has a second app (`src/App.tsx` Vite SPA), so a third app in its own directory is consistent.
3. **Reuse `src/lib` by path alias**, not by copying. `mobile/tsconfig.json` extends the root `tsconfig.base.json` and maps `tarana-web/*` → `../src/lib/*` (or the repo's `@/` alias). Business logic stays single-source; nothing is duplicated into `mobile/`.
4. **Auth via the Phase 1 contract**: `mobileTokenStore.ts` (already written) stores the JWT in `expo-secure-store`; `withMobileAuth()` attaches it as `Authorization: Bearer`. No new auth code.
5. **NativeWind for styling** (per spec), with a shared theme token file generated from the web design tokens so surfaces stay consistent.

## Phase 3 progress (2026-09-09)
- **Slice 1 (foundation):** scaffold committed (`tarana-mobile/`, Expo 57.0.21).
  Web export verified: 200 modules, 400KB.
- **Slice 2 (auth bridge):** mobile client + shared exchange logic committed.
  Web export still bundles (200 modules).
- **Slice 3 (Supabase reuse):** committed. `tarana-web/*` alias verified at
  bundle time (183 → 200 modules after reuse landed).
- **Slice 4 (screens mirroring web flows):** not started — needs the screen
  list confirmed (see Open Questions).

## Verification
- Mobile `tsc --noEmit`: clean.
- Mobile `npx expo export --platform web`: bundles, 200 modules / 400KB.
- Web `tsc --noEmit`: clean for all Phase 3 files.
- Web `next build`: compiles. The build's only failure is
  `src/app/api/gemini/itinerary-generator/lib/structuredOutputEngine.ts:85`
  (`number` not assignable to `Timeout`) — **pre-existing on main**,
  reproduced by stashing all Phase 3 changes and rebuilding from `main`.
  Not introduced here.
- Web Jest: 436 passed / 8 skipped / 0 failed — no regression from the shared
  exchange refactor.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Risk | Impact | Mitigation |
|---|---|---|
| `src/lib` uses Next.js-only APIs (server components, `next/navigation`, App Router imports) that break under Expo bundler | High — blocks reuse | Audit imports per slice; wrap Next-only code in a `isWeb`/`isNative` guard or move the shared logic into framework-agnostic `src/lib/*` modules before importing from mobile. |
| Node 23 vs Expo's Node 18 requirement | Medium — Metro may warn/fail | Use `nvm`/`fnm` to install Node 18 for the `mobile/` project only; keep Node 23 for the web build. |
| No simulators/phones attached; Android Studio SDK has one 8.7 GB system image | Medium — can't verify "runs on simulators" locally | Create one API 34/35 x86_64 AVD and point `AVD_HOME` at D:; if simulators are unusable on this host, acceptance becomes "project builds + `npx expo start` serves the bundler" with simulator verification deferred to a device. |
| Supabase env vars / `next-auth` secret differ between web and mobile | Medium — auth breaks | Mobile reads `EXPO_PUBLIC_SUPABAS_URL/KEY` and `EXPO_PUBLIC_NEXTAUTH_*` from `app.json`/`.env`; the mobile token exchange already decouples identity from env. |
| NativeWind + Expo 52 dependency drift | Low-Medium | Pin versions; verify each screen compiles rather than building all screens then debugging. |

## Open Questions
- Which screens mirror which web flows? (Needs human input — propose: dashboard, itinerary generator, saved trips, profile, saved meals, tarana-eats.)
- Does the mobile app need the Gemini cloud fallback at all, or local-only? (Phase 4 question; for Phase 3, auth + screens only.)
- AVD verification on this host — acceptable to substitute bundler-success for simulator-success?