# Service-level objectives

Status: Accepted
Date: 2026-09-23
Owner: engineering

## SLO: 99.5% successful responses over a rolling 30 days

- Numerator: HTTP responses with status < 500 on all `/api/*` routes.
- Denominator: all HTTP responses on all `/api/*` routes.
- Window: rolling 30 days. Error budget: 0.5% of requests (~3.6h/month).
- Source of truth: RED metrics (`http_requests_total` with `status_class`
  label, `http_request_duration_seconds` histogram) scraped from
  `GET /api/metrics` (Prometheus text exposition). Before 0.3 shipped,
  the fallback was Vercel analytics + `/api/health` probe history.
  No manual spreadsheet counts.

## Error-budget policy

| Budget remaining | Action |
|---|---|
| > 20% | Ship normally; monitor closely. |
| 0–20% | Slow rollouts only; no high-risk changes (new flags, migrations, generation-path edits). |
| Exhausted (0%) | Freeze feature work; reliability work only until budget recovers. |

A high burn rate during a canary (budget consumed faster than the
baseline pace) is a **hold** signal — same as an elevated error rate.

## What this doc does NOT cover

- Rollback levers and trigger thresholds — see `docs/rollback.md`.
- Alert thresholds per symptom — see `docs/runbooks/`.
- Metric instrumentation itself — Phase 0.3 (open).
