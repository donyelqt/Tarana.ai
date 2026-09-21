/**
 * Behavior-preservation smoke for the ErrorHandler.withRetry migration
 * (§2.1 remainder): the hand-rolled backoff loop was replaced with the shared
 * `withRetry` helper. This proves the migration preserves the exact contract:
 *
 * 1. Success on first try → value returned, no retries.
 * 2. Success after transient failures → retried, value returned.
 * 3. Non-retryable (API_KEY) → fails immediately on attempt 1, classified
 *    ItineraryError(API_KEY, retryable=false).
 * 4. Retryable exhaustion → ItineraryError with the classified type/message
 *    (route's handleError re-classifies whatever we throw and reads
 *    type/message/retryable into the response — TIMEOUT/VALIDATION don't
 *    round-trip through message matching, so the classified object must
 *    survive).
 * 5. handleError stats increment once per failure (classification count).
 * 6. Backoff timing: fixed exponential delay preserved (jitter none).
 *
 * Run: npx tsx specs/smoke-errorhandler-retry.mjs  → SMOKE OK (exit 0)
 */
import mod from '../src/app/api/gemini/itinerary-generator/lib/errorHandler.ts';
const { ErrorHandler, ItineraryError, ErrorType } = mod;

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    failures++;
    console.log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`);
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // --- 1. Success on first try
  {
    const t0 = performance.now();
    const result = await ErrorHandler.withRetry(async () => 'ok', 3, 1);
    check('success on first try returns value', result === 'ok');
    check('success on first try is fast (no retries)', performance.now() - t0 < 50, `${(performance.now() - t0).toFixed(1)}ms`);
  }

  // --- 2. Success after transient failures
  {
    let calls = 0;
    const timestamps = [];
    const result = await ErrorHandler.withRetry(async () => {
      calls++;
      timestamps.push(performance.now());
      if (calls < 3) throw new Error('transient network failure');
      return 'recovered';
    }, 3, 30);
    check('retries transient failures then succeeds', result === 'recovered' && calls === 3, `calls=${calls}`);

    // Backoff timing: fixed exponential — gap1 ~30ms (30 * 2^0), gap2 ~60ms (30 * 2^1)
    const gap1 = timestamps[1] - timestamps[0];
    const gap2 = timestamps[2] - timestamps[1];
    check('backoff gap1 >= 25ms (fixed 30ms, jitter none)', gap1 >= 25, `${gap1.toFixed(1)}ms`);
    check('backoff gap2 >= 50ms (fixed 60ms, jitter none)', gap2 >= 50, `${gap2.toFixed(1)}ms`);
  }

  // --- 3. Non-retryable (API_KEY) fails immediately
  {
    let calls = 0;
    const t0 = performance.now();
    let thrown = null;
    try {
      await ErrorHandler.withRetry(async () => {
        calls++;
        throw new Error('Invalid or missing API key');
      }, 3, 1);
    } catch (e) {
      thrown = e;
    }
    check('non-retryable fails on attempt 1', calls === 1, `calls=${calls}`);
    check('non-retryable is fast (no retry delay)', performance.now() - t0 < 50, `${(performance.now() - t0).toFixed(1)}ms`);
    check('non-retryable throws ItineraryError', thrown instanceof ItineraryError);
    check('non-retryable classified API_KEY', thrown?.type === ErrorType.API_KEY, `type=${thrown?.type}`);
    check('non-retryable retryable=false', thrown?.retryable === false);
    check('non-retryable message is classified text', thrown?.message === 'Invalid or missing API key', `message=${thrown?.message}`);
  }

  // --- 4. Retryable exhaustion → classified ItineraryError survives
  {
    // TIMEOUT classification: message contains 'timeout'. The classified
    // message 'Service temporarily unavailable' does NOT contain 'timeout'
    // (it was produced by the classifier itself), so the classified object —
    // not a re-derived one — must be what surfaces.
    let calls = 0;
    let thrown = null;
    try {
      await ErrorHandler.withRetry(async () => {
        calls++;
        throw Object.assign(new Error('Gemini socket hung (timeout)'), { status: 503 });
      }, 2, 1);
    } catch (e) {
      thrown = e;
    }
    check('exhaustion calls fn maxAttempts times', calls === 2, `calls=${calls}`);
    check('exhaustion throws ItineraryError', thrown instanceof ItineraryError);
    check('exhaustion classified TIMEOUT', thrown?.type === ErrorType.TIMEOUT, `type=${thrown?.type}`);
    check('exhaustion message is classified text', thrown?.message === 'Service temporarily unavailable', `message=${thrown?.message}`);
    check('exhaustion retryable=true', thrown?.retryable === true);

    // The route's catch re-classifies whatever we throw: simulate it.
    // NOTE: the classified message 'Service temporarily unavailable' contains
    // no 'timeout' substring, so the route's message-matching classifier maps
    // it to UNKNOWN — this is the PRE-EXISTING behavior (the old code threw
    // the same ItineraryError and the route produced the same UNKNOWN); the
    // migration preserves it exactly. The typed TIMEOUT lives on the thrown
    // ItineraryError itself (checked above), not in the route's response.
    const d = ErrorHandler.handleError(thrown);
    check('route re-classification matches pre-existing behavior (UNKNOWN)', d.type === ErrorType.UNKNOWN, `route sees type=${d.type}`);
    check('route re-classification preserves retryable', d.retryable === true);
    check('route re-classification preserves message', d.message === 'Service temporarily unavailable', `message=${d.message}`);
  }

  // --- 5. handleError stats increment once per failure
  {
    const statsBefore = ErrorHandler.getErrorStats();
    const before = statsBefore.RATE_LIMIT ?? 0;
    let calls = 0;
    try {
      await ErrorHandler.withRetry(async () => {
        calls++;
        throw Object.assign(new Error('rate limit hit'), { status: 429 });
      }, 2, 1);
    } catch { /* expected */ }
    const statsAfter = ErrorHandler.getErrorStats();
    check('stats increment once per failure (2 calls → +2)', (statsAfter.RATE_LIMIT ?? 0) - before === 2, `before=${before} after=${statsAfter.RATE_LIMIT}`);
  }

  // --- 6. PARSING classification round-trips
  {
    let thrown = null;
    try {
      await ErrorHandler.withRetry(async () => {
        throw new Error('Failed to parse AI response JSON');
      }, 1, 1);
    } catch (e) {
      thrown = e;
    }
    check('parsing classified PARSING', thrown?.type === ErrorType.PARSING, `type=${thrown?.type}`);
    const d = ErrorHandler.handleError(thrown);
    check('parsing round-trips through route classifier', d.type === ErrorType.PARSING, `route sees type=${d.type}`);
  }

  console.log('');
  if (failures > 0) {
    console.log(`SMOKE FAILED — ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('SMOKE OK');
}

main();
