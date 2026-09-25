# Runbook: 5xx spike on `/api/*`

**Means:** A deploy broke a served path, or a dependency (Supabase, Gemini, TomTom) started failing and an endpoint surfaces it as 5xx. Users see errors; the SLO error budget is burning.

**Threshold (human-evaluated, no webhook sink):** error rate > 2x baseline on any `/api/*` route, or the 99.5% rolling-30d SLO pace visibly bending (see `docs/slo.md`). Rollback triggers in `docs/rollback.md` apply as-is.

**First check** — 5xx share per route, straight from the existing exposition:

```text
GET /api/metrics  →  http_requests_total{route="<route>",status_class="5xx"}
                     / http_requests_total{route="<route>"}
```

Compare against the route's own baseline from the last known-good window. Labels are bounded (`method`, `route`, `status_class`) — never filter by user id or error text; that lives in structured logs, correlated by `requestId`.

**Second check:** `GET /api/health` — `status: 'degraded'` plus which of `supabase` / `geminiKey` / `tomtom` reads `fail` names the dependency. Cross-check with the failing route's upstream calls.

**Lever:**

1. If the spike started with the latest deploy → Lever 1 (flag env flip, < 1 min) when the breakage is on the flagged path; else Lever 2 (Vercel promote to last working deployment, < 5 min). Order and click-path: `docs/rollback.md`, deploy steps: `docs/DEPLOYMENT_CHECKLIST.md` Rollback Plan section.
2. Data-integrity smell (duplicate charges, lost writes): stop writes first, then roll back reads — per `docs/rollback.md`.

**Verify the fix:** `/api/health` 200; error rate back within 10% of baseline; budget burn back to baseline pace.

**Escalate to:** engineering on-call. If the failing check is `supabase`, include the Supabase project dashboard state; if Gemini/TomTom, include provider status pages.
