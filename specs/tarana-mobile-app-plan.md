# Tarana Mobile App — Implementation Plan

**Status:** Phase 1 complete (2026-09-09, PR #388) | **Phase 3 substantially complete** — toolchain (#397), navigation + NativeWind (#398), saved-trips + spots screens (#399) all merged; simulator/device run still open (no runtime evidence on record) | **Mode:** Build
**Scope:** Paid mobile app (Expo/React Native) with on-device local LLMs. Web app remains free tier (credits, rate-limited free Gemini). Freemium: web = funnel, mobile = premium.
**Depends on:** `next-auth` (single source of truth, unchanged), Supabase (shared), free Gemini (`GOOGLE_GEMINI_API_KEY`)

---

## 1. Verified facts (evidence-backed)

| Fact | Evidence |
|---|---|
| Free Gemini only, no paid tier | `src/lib/ai/embeddings.ts:13` — `GOOGLE_GEMINI_API_KEY`, `@google/genai` |
| Rate limiting is operational, not hypothetical | 429 handling + exponential backoff across `src/app/api/locations/search/route.ts:75`, `src/app/api/routes/calculate/route.ts:147`, `src/lib/auth/auth.ts:236`, `src/app/api/gemini/itinerary-generator/lib/errorHandler.ts:62`, `responseHandler.ts:29`; TomTom batching comment at `trafficAwareActivitySearch.ts:47` ("was 40 → 429s") |
| `next-auth` at 100+ sites, 40 files, 3 APIs | grep across `src/lib/auth`, `src/lib/data/savedItineraries.ts`, `src/middleware/auth.ts`, `src/agents/conciergeAgent.ts`, ~20 API routes, ~15 client components |
| Not a monorepo | No `pnpm-workspace.yaml`, `lerna.json`, `turborepo.json`, `rush.json`; no `"workspaces"` in `package.json` |
| Two apps: Next.js 15 + orphaned Vite SPA | `src/app/` vs `src/App.tsx` + `index.html`; **no `vite.config.*`** — SPA may not build |
| Mobile scaffold + screens committed, simulator run open | `tarana-mobile/` tracked (Expo 57, AuthGate stack, Home placeholder, saved-trips + spots screens); commits through PRs #397 (toolchain), #398 (nav + NativeWind), #399 (screens). No simulator/device run evidenced yet |
| No PWA | No `manifest.json`, no `sw.js` in `public/` |
| Eats spec 0% implemented (out of scope) | `specs/tarana-eats-city-scale-plan.md:3` |

---

## 2. Architecture

```
WEB (free tier)                          MOBILE (paid tier)
  │                                         │
  ├─ next-auth session                     ├─ Expo / React Native
  ├─ credits billing                       ├─ local models (GGUF / llama.cpp)
  ├─ Gemini cloud AI                       ├─ offline-capable
  └─ Supabase DB                           └─ one-time purchase
        │                                         │
        └─────────────────┬───────────────────────┘
                          ▼
            SHARED: Supabase, user identity,
            saved trips, saved meals, credits history
```

**One user. One database. One auth system.** The mobile app does not have its own auth or its own user records.

### Auth bridge (the load-bearing piece) ✅ Phase 1 implemented

`next-auth` has no React Native equivalent. Rather than a parallel auth system (two sources of truth for user identity — a real failure mode) or a 12-week refactor, add a token bridge:

1. **`POST /api/auth/mobile-token`** — validates a valid web `next-auth` session, returns a short-lived JWT.
2. **Shared middleware** — existing API routes already resolve user identity from the session; extend them to accept the JWT too. One identity path, not two.
3. **Mobile client** — store JWT in `expo-secure-store`. All subsequent API calls use it.

The token is a standard NextAuth JWT on the **default empty salt**, so it round-trips through `getToken`/`getServerSession` unchanged; the middleware injects the *raw encrypted JWT* (not the decoded user id) as a synthetic session cookie. Mobile tokens are API-only, cannot be re-exchanged, and are rate-limited separately from the global API limiter.

Result: web user logs in → requests a mobile token → opens mobile app → same trips, same credits, same history. One account, two surfaces.

### AI split

| Surface | AI | Cost | Rate limits |
|---|---|---|---|
| Web | Gemini cloud (`@google/genai`) | Free tier | Yes — handled by existing retry/backoff |
| Mobile | Local models (GGUF via llama.cpp / Core ML on iOS) | Free (device) | None — runs on device |

Mobile also supports **cloud fallback** when online, and **offline mode** using the local model. The local model is the primary path because the free Gemini tier cannot scale to mobile users.

---

## 3. Freemium logic

The web app's credits and rate limits are **not a bug in this plan — they are the gating mechanism.** Free tier is supposed to be limited; that is what makes the paid mobile app worth buying.

- Web = free funnel, credits-gated, rate-limited cloud AI.
- Mobile = paid premium, local AI, no limits, offline.

---

## 4. Phased plan

### Phase 1 — Auth bridge (1 week) ✅ COMPLETE
- [x] `POST /api/auth/mobile-token` — validate web session, return short-lived JWT
- [x] Shared middleware extending existing routes to accept JWT
- [x] `expo-secure-store` client on mobile
- [x] Verify: web session → token → JWT accepted by an existing route

**Implementation:** `src/app/api/auth/mobile-token/route.ts`, `src/middleware/auth.ts`,
`src/lib/auth/mobileToken.ts`, `src/expo/auth/mobileTokenStore.ts`,
`src/lib/security/rateLimiter.ts`, `scripts/verify-mobile-token-bridge.ts`.
Merged to `main` as PR #388 (6 atomic commits, +1010/−20 lines).

**Verification:** 437 tests pass / 8 skipped / 0 failed · `tsc --noEmit` clean ·
`next build` compiles · ESLint 0 errors · mock-free runtime proof reports
`BRIDGE VERIFIED` (encode → `getToken` → `decode` round-trip through the
synthetic cookie). CI `verify` and Vercel preview both green.

**Deferred (out of scope):** exact TTL, refresh, durable revocation,
device-binding.

### Phase 2 — Local model validation (cheap experiment, before anything else)
- [ ] Run one itinerary through a local model (Gemma 3 / Qwen variant)
- [ ] Compare output to the equivalent Gemini response
- **This is the make-or-break.** If quality is unacceptable, the paid app has no product and the plan fails. If acceptable, proceed.
- Verify: side-by-side itinerary output, human review

### Phase 3 — Expo scaffold (2–3 weeks) — SUBSTANTIALLY COMPLETE, simulator run open
- [x] Expo 57 scaffold committed (`tarana-mobile/`: `app.json`, `App.tsx` auth screen, `src/auth.ts` exchange flow, `src/supabase.ts` anon-key wrapper, `src/config.ts`)
- [x] Metro remap for shared web code (`tarana-mobile/metro.config.js` mirrors the `tarana-web/*` tsconfig alias; see Metro probe below)
- [x] Removed dead signing-secret surface from mobile config (signing keys must never ship in the app binary)
- [x] Toolchain unblock (#397): `babel-preset-expo` installed + `babel.config.js`, `app.json extra` filled (dev values), web-export bundling proven (580 modules)
- [x] React Navigation (native stack: AuthGate → Home) + NativeWind wired to shared brand tokens (#398; Metro `sourceExts` gotcha documented in `metro.config.js`)
- [x] Reuse `src/lib` business logic under probe rules (#399): anon Supabase factory, `cityConfig` (zero Node/Next imports, verified); quarantined modules NOT imported (search/`crypto`, catalog images/`lucide`, agent `buffer`/SDK) — spots data comes over HTTP (`/api/spots?city=`) instead
- [x] Mobile screens mirroring web flows (#399): AuthGate stack, Home placeholder, saved-trips read list, spots list
- [ ] Verify: app runs on iOS and Android simulators (NOT yet evidenced — bundling proven via web export only; emulator run dispatched once and cancelled before execution; no device/simulator log/screenshot on record)

#### Metro-compat probe (2026-09-10, static import-trace — read, not run)
| Module | Verdict | Reason |
|---|---|---|
| `lib/utils/*` (dailyRotation, localMatch), `lib/traffic/peakHours`, `lib/data/cityConfig`, `lib/data/baguioCoordinates`, `lib/traffic/agenticTrafficAnalyzer` chain | ✅ Portable | Zero Node/Next imports (analyzer's old `buffer` + agent imports were removed earlier) |
| `lib/traffic/tomtomTraffic` | ✅ Portable modulo env | Self-contained + `fetch`; needs `process.env.*` → `app.json extra`/EAS plumbing, and the anon (never service-role) client |
| `lib/search/*`, `lib/traffic/trafficAwareActivitySearch` (via `itineraryData`) | ❌ Blocked | `itineraryData.ts:1-15` value-imports ~40 images from `../../../../public` (outside Metro root, Next `StaticImageData` shape), plus `lucide-react` web icons and `next/image` typing; `intelligentSearch.ts:9` imports Node `crypto` |
| `agenticTrafficAgent.ts` (`buffer`, old Gemini SDK) | ❌ Blocked, correctly orphaned | Already zero importers on web; stays out of mobile scope (device uses local models per §2) |
| `expo-secure-store` | ❌ web-blocked → platform adapter | `src/auth.ts:41` called `SecureStore.getItemAsync` at boot (`loadAuthState`); on Expo WEB the native module has no implementation (`ExpoSecureStore.default.getValueWithKeyAsync is not a function`). Fixed via `tarana-mobile/src/tokenStorage.ts` (SecureStore on native, guarded `localStorage` on web); `auth.ts` keeps the same keys (`tarana.mobileToken`, `tarana.mobileTokenClaim`) |

Toolchain since proven (PR #397): `babel-preset-expo` installed + `babel.config.js` present, `app.json extra` holds dev values, web-export bundling green. Remaining before first simulator run: a device/simulator with the app actually launching (emulator run dispatched once, cancelled before execution).

### Phase 4 — Local AI integration (2–3 weeks)
- [ ] `llama.cpp` / GGUF inference on device
- [ ] Cloud fallback when online
- [ ] Offline mode
- Verify: local inference produces an itinerary end-to-end on device

### Phase 5 — Store submission (1–2 weeks)
- [ ] EAS Build
- [ ] App store listings, screenshots, privacy policy
- [ ] Apple Developer ($99) + Google Play ($25) enrollment
- Verify: app passes review on both platforms

---

## 5. Decisions made (your calls, accepted)

| Decision | Rationale |
|---|---|
| Paid app, no credits on mobile | One-time purchase; credits are web-only |
| Local models on mobile | Free Gemini can't scale; no paid API |
| One shared Supabase database | Mobile users access same saved trips/history as web |
| One auth system (next-auth) + JWT bridge | Avoids two sources of truth for user identity |
| Expo, not bare React Native | EAS Build + store submission tooling, faster on-ramp |
| No monorepo retrofit | Single repo; mobile lives as a second app with its own `tarana-mobile/package.json` (~286MB duplicated `node_modules` measured). Shared web code is reached via the `tarana-web/*` tsconfig alias, remapped for Metro in `tarana-mobile/metro.config.js` (watchFolders + build-output blockList). Prefer this over workspaces until a third app forces the question |

---

## 6. Open questions (ordered by kill-power)

1. **Does the local model produce acceptable itineraries?** Unchanged — still the only thing unverifiable from code, still the make-or-break for the paid premise.
2. **Which `src/lib` modules does mobile actually need?** Probe says: pure/traffic/supabase-client modules are portable; search + catalog data are not (Next image imports, Node `crypto`). Decision needed: extract a Metro-safe shared core (recommended — small, explicit) vs per-module shims (fragile, spreads). Do this before any screen imports web logic.
3. **First simulator/device run — the last open Phase-3 item.** Toolchain, bundling, and screens are proven; what has never run is the app on a device: auth exchange end-to-end, token storage round-trip, Supabase reads, and spots fetch over the wire (note: `app.json extra` points at localhost, so device runs need LAN-reachable URLs). One emulator session with redbox/logcat evidence closes Phase 3.