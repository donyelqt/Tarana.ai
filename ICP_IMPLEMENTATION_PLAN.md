# Internet Computer (ICP) Minimal Integration Plan

This document proposes a **minimal but end-to-end** integration of the Internet Computer (ICP) into the Tarana.ai code-base so that the project qualifies as a *decentralised AI* application.

---
## 1. Goals
1. **Decentralised Compute** – expose at least one AI-related function (e.g. itinerary vector search) from an ICP canister.
2. **Decentralised Storage** – persist a small sample of embeddings or itinerary data on-chain (stable memory).
3. **Web-Native UX** – authenticate users with Internet Identity (II) and call the canister from the existing Next.js front-end.
4. **Low Friction** – keep the footprint small so existing Supabase-powered flows continue to work side-by-side.

---
## 2. High-Level Architecture
```mermaid
graph TD
    subgraph Browser (Next.js / React)
        A[Tarana.ai Front-End]
        B[Supabase Client]
        C[ICP Agent]
    end

    subgraph ICP
        D[tarana_ai_backend
          (Rust Canister)]
        E[Internet Identity]
    end

    A -- \"sign-in\" --> E
    A -- \"query/ update\" --> D
    B -. optional .-> Postgres
```

---
## 3. Prerequisites
| Tool | Version | Purpose |
|------|---------|---------|
| `dfx` | ≥ 0.18.0 | Local replica & deployment |
| `rustup` + `wasm32-unknown-unknown` target | latest | Rust canister build |
| Node.js | ≥ 18 | Front-end & agent |

---
## 4. Step-by-Step Roadmap
| # | Milestone | Details |
|---|-----------|---------|
| 1 | **Dev Env Bootstrapping** | a) Install `dfx`.<br/>b) `dfx new tarana_icp --type rust` inside `icp/` folder.<br/>c) Add workspace-level `dfx.json` (see §5).
| 2 | **Rust Canister: `tarana_ai_backend`** | Start with a simple `greet(name)` then extend to:<br/>• `addEmbedding(text, vector)` – writes to stable memory.<br/>• `search(queryVector, k)` – naive cosine similarity to return IDs.<br/>Persist <100 vectors to stay within 4 MiB limit for MVP.
| 3 | **Local Replica Test** | `dfx start --background` → `dfx deploy` and test with `dfx canister call`.
| 4 | **Internet Identity (II)** | a) Add II canister to `dfx.json`.<br/>b) Front-end: install `@dfinity/auth-client` and implement `useInternetIdentity()` hook to retrieve authenticated agent.
| 5 | **Front-End Wiring** | a) Add `dfx_generated/tarana_ai_backend` TS bindings via `rs-toolkit` or `@dfinity/agent-generated`.<br/>b) Create `lib/icp.ts` that exports functions `addEmbedding` and `search` consuming the agent.<br/>c) Replace/supplement existing Supabase `vectorSearch` with conditional ICP path.
| 6 | **CI & Deployment** | a) Add GitHub Action job that runs `dfx deps` & `dfx canister create --all` on every push.<br/>b) Manual mainnet deployment (`ic` boundary node) until cycles/top-up strategy is decided.
| 7 | **Docs & Badges** | Update `README.md` with ICP badge and quick-start commands.

---
## 5. Suggested `dfx.json`
```json
{
  "dfx": "0.18.0",
  "canisters": {
    "tarana_ai_backend": {
      "type": "rust",
      "main": "icp/tarana_ai_backend/src/lib.rs",
      "candid": "icp/tarana_ai_backend/src/tarana_ai_backend.did"
    },
    "internet_identity": {
      "type": "custom",
      "candid": "https://raw.githubusercontent.com/dfinity/internet-identity/main/src/internet_identity/internet_identity.did",
      "wasm": "https://github.com/dfinity/internet-identity/releases/latest/download/internet_identity_dev.wasm.gz"
    }
  },
  "defaults": { "build": { "packtool": "npm" } },
  "output": "icp/.dfx"
}
```

---
## 6. Code Additions Summary
1. **`icp/` Directory** – contains canister code & `Cargo.toml`.
2. **`lib/icp.ts`** – front-end helper using `@dfinity/agent`.
3. **`hooks/useInternetIdentity.ts`** – React hook for II auth.
4. **`scripts/icp:deploy`** – npm script alias for `dfx deploy`.

---
## 7. Estimated Effort
| Role | Hours |
|------|-------|
| Rust Canister Dev | 6 |
| Front-End Integration | 4 |
| DevOps / CI | 2 |
| Documentation | 1 |
| **Total** | **13 h** |

---
## 8. Risks & Mitigations
1. **Stable Memory Limit** – Keep dataset small or leverage chunking until scalable solution (BigMap) is ready.
2. **Cold Start Latency** – Keep canister ‘warm’ by periodic pings; acceptable for MVP.
3. **Cycle Cost** – Track logs; start with test cycles.

---
## 9. Acceptance Criteria
✓ Canister deployed locally & on ICP.<br/>
✓ User can authenticate via Internet Identity.<br/>
✓ Front-end can add & search embeddings through canister.<br/>
✓ README documents how to run full decentralised flow.

---
## 10. Next Steps (Beyond MVP)
• Port full vector search index.<br/>
• Move itinerary generation (LLM) into Wasm using ICP-compatible model runner.<br/>
• Add NFT badge for travel itineraries minted on ICP.

---
*Prepared by:* Engineering Team · YYYY-MM-DD 