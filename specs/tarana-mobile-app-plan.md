# Tarana Mobile App — Implementation Plan

**Status:** Draft 2026-09-08 | **Branch:** local only | **Mode:** Build
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
| No mobile framework exists | grep for `react-native`/`expo` = zero matches |
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

### Auth bridge (the load-bearing piece)

`next-auth` has no React Native equivalent. Rather than a parallel auth system (two sources of truth for user identity — a real failure mode) or a 12-week refactor, add a token bridge:

1. **`POST /api/auth/mobile-token`** — validates a valid web `next-auth` session, returns a short-lived JWT.
2. **Shared middleware** — existing API routes already resolve user identity from the session; extend them to accept the JWT too. One identity path, not two.
3. **Mobile client** — store JWT in `expo-secure-store`. All subsequent API calls use it.

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

### Phase 1 — Auth bridge (1 week)
- [ ] `POST /api/auth/mobile-token` — validate web session, return short-lived JWT
- [ ] Shared middleware extending existing routes to accept JWT
- [ ] `expo-secure-store` client on mobile
- Verify: web session → token → JWT accepted by an existing route

### Phase 2 — Local model validation (cheap experiment, before anything else)
- [ ] Run one itinerary through a local model (Gemma 3 / Qwen variant)
- [ ] Compare output to the equivalent Gemini response
- **This is the make-or-break.** If quality is unacceptable, the paid app has no product and the plan fails. If acceptable, proceed.
- Verify: side-by-side itinerary output, human review

### Phase 3 — Expo scaffold (2–3 weeks)
- [ ] Expo managed workflow, React Navigation, NativeWind
- [ ] Reuse `src/lib` business logic (itinerary generation, Supabase client, search, traffic)
- [ ] Mobile screens mirroring web flows
- Verify: app runs on iOS and Android simulators

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
| No monorepo retrofit | Single repo, single package.json; keep mobile as another app like the existing Vite SPA |

---

## 6. Open question

**Does the local model produce acceptable itineraries?** This is the only thing unverifiable from code — it is an experiment. Everything else in the plan holds up to evidence. If the local model quality is bad, the whole paid-app premise collapses.