# Runbook: latency breach on `/api/*`

**Means:** Users wait too long on a served path — a slow dependency, a retry storm, or a regressed generation path. No errors yet, but experience is degraded and a timeout-driven 5xx spike usually follows.

**Threshold (human-evaluated, no webhook sink):** p95 latency > 50% above baseline on any `/api/*` route (per the trigger list in `docs/rollback.md`). There is no absolute SLO latency number — `docs/slo.md` defines the 99.5% success SLO only. A 2s figure appears in the plan's §5.3 text as a spec-derived value, not an SLO/rollback number; do not page on it alone.

**First check** — p95 per route from the existing histogram (`http_request_duration_seconds`, buckets `[0.05..5]` per `src/lib/observability/httpMetrics.ts` `DURATION_BUCKETS`, labels `method`/`route`/`status_class`):

```text
GET /api/metrics  →  histogram_quantile(0.95, http_request_duration_seconds{route="<route>"})
```

Compare against the same route's baseline. If the 5s top bucket is saturating, the tail is clipped — treat p95 as a lower bound and look at the 5xx rate too.

**Second check:** `GET /api/health` timings per dependency (3s per-dependency timeout; cold first-hit compile ~3.7s is normal once, not a breach). Slow `tomtom`/`supabase` checks point at the provider, not the route.

**Lever:**

1. Breach started with the latest deploy → Lever 1 (flag flip) when on the flagged path; else Lever 2 (Vercel promote). Order and click-path: `docs/rollback.md`.
2. Provider-side (health check names it): no rollback — shed load via the existing timeouts/retries, and hold the rollout per the canary-burn rule in `docs/slo.md`.

**Verify the fix:** p95 back within 20% of baseline; `/api/health` 200; 5xx rate flat.

**Escalate to:** engineering on-call, with the route, the baseline-vs-current p95 numbers, and whether `/api/health` names a dependency.
