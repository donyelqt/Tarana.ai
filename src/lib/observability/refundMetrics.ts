/**
 * In-process money-path metrics (zero-dep).
 *
 * Planned replacement surface for Task 10's pino/requestId work. These
 * counters exist because the refund path is a live prod money path with
 * five swallow-sites (`CreditService.refundCredits` returns false on
 * error, callers `// best-effort; swallow refund errors`) and NO
 * observability: a silent refund failure post-REVOKE is invisible.
 *
 * Serverless caveat: counters are per-instance and reset on cold starts,
 * so absolute values are only meaningful within an invocation or a burst.
 * What they DO enable today: (1) a `Promise.race`-style deadline or
 * periodic flush can aggregate them; (2) single-request summaries in
 * logs; (3) a spike is visible when `.snapshot()` is logged at request
 * end. Upgrade path: swap the store for an HTTP/Edge sink (Upstash
 * RESTCounter, otel) without touching call sites.
 */

type RefundMetrics = {
  /** refunds that applied (RPC returned TRUE). */
  refunded: number;
  /** refunds that no-op'd (unknown profile / replayed key) — usually benign. */
  noop: number;
  /** refund RPC errors and thrown exceptions — the signaller. */
  failed: number;
};

const counters: RefundMetrics = {
  refunded: 0,
  noop: 0,
  failed: 0,
};

export function recordRefund(outcome: keyof RefundMetrics): void {
  if (outcome in counters) {
    counters[outcome] += 1;
  }
}

/** Atomically read-and-reset (per-attempt flush; never blocks). */
export function takeRefundSnapshot(): RefundMetrics {
  const snapshot: RefundMetrics = { ...counters };
  counters.refunded = 0;
  counters.noop = 0;
  counters.failed = 0;
  return snapshot;
}

export function getRefundMetrics(): RefundMetrics {
  return { ...counters };
}