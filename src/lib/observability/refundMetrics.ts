
type RefundMetrics = {
  refunded: number;
  noop: number;
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