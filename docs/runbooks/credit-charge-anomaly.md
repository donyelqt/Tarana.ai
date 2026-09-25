# Runbook: credit/charge anomaly on `/api/credits/*` and charge-first routes

**Means:** Users are charged wrongly or cannot spend — failed `consumeCredits`/`refundCredits` calls, a stuck idempotency claim, or a generation path that bills without serving. Money movement is the asset; treat any anomaly here as user-facing even at low volume.

**Threshold (human-evaluated, no webhook sink):** any user report of a wrong charge or missing refund, or a 5xx uptick on `/api/credits/*`, `POST /api/gemini/itinerary-generator`, or `POST /api/gemini/food-recommendations`. There is no burnt-budget number for money paths — one verified wrong charge is enough to start this runbook.

**First check** — 5xx share on the money routes, from the existing exposition (refund/credit counters are in-process only — `refundMetrics.ts` — and are NOT exposed series, so the HTTP signal is the queryable one today):

```text
GET /api/metrics  →  http_requests_total{route=~"/api/credits/.*",status_class="5xx"}
                     / http_requests_total{route=~"/api/credits/.*"}
```

Repeat for `/api/gemini/itinerary-generator` and `/api/gemini/food-recommendations`. Then pull structured logs by `requestId` for the failing window: look for `consumeCredits` / `refundCredits` outcomes and idempotency `409`/`422` patterns — never full request bodies.

**Second check:** `GET /api/health` — a `fail` on `supabase` implicates the ledger RPCs (`consume_credits` / `refund_credits`); a `fail` on `geminiKey` implicates generation-after-charge.

**Lever:**

1. Breakage on the flagged generation path → Lever 1 (flag flip, < 1 min) stops new charges immediately; the legacy path is the rollback target.
2. Ledger-side (Supabase) or non-flagged code → Lever 2 (Vercel promote, < 5 min). If writes are corrupt: stop writes first, then roll back reads — per `docs/rollback.md`.
3. Individual wrong charges: resolve via the existing refund path per user; this runbook stops the bleeding, it does not reconcile the ledger.

**Verify the fix:** 5xx on money routes back within 10% of baseline; spot-check the reported user's balance/refund state; budget burn flat.

**Escalate to:** engineering on-call immediately for any confirmed wrong charge — include `requestId`s, route, and the idempotency-key outcome. Money anomalies skip the ticket queue.
