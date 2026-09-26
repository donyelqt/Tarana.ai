# ADR 008 — No distributed tracing without a sink

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Doniele Arys Antonio

## Context

Phase 5.2 of the architecture plan calls for OpenTelemetry with
auto-instrumentation for HTTP, Supabase, and external fetches (1% sample,
100% of errors), verified by following one request from API route →
Supabase → Gemini in a tracing UI. That UI does not exist: there is no
trace collector, no backend, no retention, and no pager sink (§3.3, §5.3b).
Adding the SDK without a sink produces spans nobody reads, lockfile churn
for `@opentelemetry/*` packages, and cold-start cost on a Vercel Hobby
serverless deployment (ADR-007) — telemetry theater, not observability.

The system is one Next.js monolith. There are no separate services to
cross, so the question traces answer elsewhere ("where did time go across
services?") does not arise here. The honest local question is "where did
the time go inside request X?" — and the current signals answer it only
partially (see the known gap below).

## Decision

1. **No OpenTelemetry SDK until a sink decision lands** (§3.3 upgrade path).
   The zero-dep convention holds: structured logger + RED metrics +
   request IDs + entry points, all already shipped and already queried by
   `docs/runbooks/`.
2. **The §5.2 Verify clause is deferred, not dropped.** "A single request
   can be followed in the tracing UI" is false today and stays false until
   a sink exists. The trace-equivalent evidence available today is
   `requestId` correlation + RED per-route histogram + `entryPoint` log
   sequence (stage-level duration is a known gap — see below).

## What exists instead (verified 2026-09-26)

Answerable now:

| On-call question | Current signal |
|---|---|
| What fraction of requests fail, per route? | `http_requests_total` by `status_class` from `GET /api/metrics` (Prometheus exposition, `renderPrometheusExposition()`) |
| Is an endpoint slower than usual? | `http_request_duration_seconds` histogram from `GET /api/metrics`; p95 vs baseline per `docs/runbooks/latency-breach.md` |
| What happened in this specific case? | Structured JSON logs with `requestId` on every line (`src/middleware/requestId.ts`) |
| Which code path started this run? | `entryPoint` field next to `requestId` (`LogEntry.entryPoint`, `src/lib/observability/logger.ts:26`) |
| Which dependency is down? | `GET /api/health` per-dependency checks (3s timeout each) |

Known gap (not covered, stated plainly):

- **Stage-level latency attribution.** No log line carries a duration
  field, so "Supabase RPC took 800ms, Gemini took 1.2s inside request X"
  cannot be answered from current signals — only inferred from the
  per-route histogram plus the `entryPoint` log sequence.
- **Histogram ceiling.** `DURATION_BUCKETS` tops out at 5s
  (`src/lib/observability/httpMetrics.ts:35`) while generations run
  7.5–60s, so RED p95 on the generation path is a lower bound, not a
  measurement (same caveat as `docs/runbooks/latency-breach.md`).

## Alternatives considered

1. **Add the OpenTelemetry SDK now, sink later.** Rejected: spans with
   nowhere to go; SDK + auto-instrumentation packages in the lockfile;
   cold-start cost on serverless; the sampling/retention story cannot be
   verified without a backend. Revisit when the sink decision lands.
2. **Hand-rolled span propagation (traceparent headers, in-house UI).**
   Rejected: builds a second observability system to maintain for one
   monolith. The `requestId` + `entryPoint` correlation already covers
   the sequencing half; the duration half is the known gap above, and a
   sink-backed SDK answers it better when the time comes.
3. **Vendor APM agent (Vercel Analytics / third-party).** Rejected: no
   decision on vendor, cost, or data-sharing posture. That decision IS
   the §3.3 sink decision — this ADR defers to it, not around it.

## Consequences

- **Accepted costs:** stage-level duration stays a known gap; any
  latency investigation localizes by histogram + log sequence, not by
  span waterfall.
- **Gains kept:** zero new dependencies, zero lockfile churn, zero
  cold-start cost; runbooks keep working against signals that exist.

## Revisit triggers (any one reopens this ADR)

1. A sink decision lands (§3.3 upgrade path) — reopen 5.2 and implement
   tracing against it. This is the un-deferral trigger.
2. The monolith splits into services communicating over HTTP — the split
   event itself, not the first cross-service call, reopens this ADR
   (cross-service latency is unanswerable without traces).
3. A latency investigation that RED cannot localize to a stage (p95
   moved; no single stage log line or metric isolates the contributor) —
   RED answers *that* a breach happened; what stays unanswered is *where*.

## Related record

- Zero-dep / no-sink rule: plan §3.3 ("No OpenTelemetry until there is
  a sink to send to"), ADR-007 (Vercel serverless hobby constraints).
- Current signals: `src/lib/observability/logger.ts`,
  `src/lib/observability/httpMetrics.ts`, `src/middleware/requestId.ts`,
  `src/app/api/metrics/route.ts`, `src/app/api/health/route.ts`.
- Consumers: `docs/runbooks/` (5xx-spike, latency-breach,
  credit-charge-anomaly), `docs/slo.md`, `docs/rollback.md`.
