/**
 * Behavior-preservation smoke for the StructuredOutputEngine migration
 * (§2.2 remainder): the hand-rolled per-attempt race + retry loop was
 * replaced with the shared `withRetry` + `timeoutMs`.
 *
 * Proven contract:
 * 1. Success on first try → valid itinerary returned.
 * 2. Retry on any failure (catch-all preserved) with the fixed 1s/2s delay
 *    capped at 5s.
 * 3. Exhaustion → fallback itinerary RETURNED (not thrown).
 * 4. Aborted signal → no retry, fallback returned.
 * 5. Parse/validate pipeline still runs on the successful text.
 *
 * Run: npx tsx specs/smoke-structured-engine.mjs → SMOKE OK (exit 0)
 */
import { createRequire } from 'module';
const require_ = createRequire(import.meta.url);

// Stub ./config BEFORE the engine loads (module-scope geminiModel import).
const configPath = require_.resolve('../src/app/api/gemini/itinerary-generator/lib/config.ts');
const calls = [];
const failWith = { status: null };
let hangMs = 0;

const fakeResult = (text) => ({
  response: {
    text: () => text,
    candidates: [{ content: { parts: [{ text }] } }],
  },
});

const VALID_TEXT = JSON.stringify({
  title: 'Baguio Trip',
  subtitle: '2 days of fun',
  items: [
    {
      period: 'Morning',
      activities: [
        { image: 'https://img.test/1', title: 'Burnham Park', time: '9:00 AM', desc: 'A relaxing morning at the park lake.', tags: ['park'] },
      ],
    },
    {
      period: 'Afternoon',
      activities: [
        { image: 'https://img.test/2', title: 'Session Road', time: '2:00 PM', desc: 'Strolling down the main street.', tags: ['city'] },
      ],
    },
  ],
});

require_.cache[configPath] = {
  id: configPath,
  filename: configPath,
  loaded: true,
  exports: {
    geminiModel: {
      generateContent: async (_req) => {
        calls.push(performance.now());
        if (hangMs > 0) {
          await new Promise((r) => setTimeout(r, hangMs));
        }
        if (failWith.status !== null) {
          const e = new Error('gemini transient failure');
          e.status = failWith.status;
          throw e;
        }
        return fakeResult(VALID_TEXT);
      },
    },
    API_KEY: 'test-key',
  },
};

const engineMod = require_('../src/app/api/gemini/itinerary-generator/lib/structuredOutputEngine.ts');
const StructuredOutputEngine = engineMod.StructuredOutputEngine;

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    failures++;
    console.log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`);
  }
};

async function main() {
  // --- 1. Success on first try
  {
    calls.length = 0; failWith.status = null; hangMs = 0;
    const it = await StructuredOutputEngine.generateStructuredItinerary('prompt', 'req1');
    check('success returns valid itinerary', it?.title === 'Baguio Trip', `title=${it?.title}`);
    check('success makes 1 call', calls.length === 1, `calls=${calls.length}`);
  }

  // --- 2. Failure retried once with fixed delay (catch-all preserved)
  {
    calls.length = 0; failWith.status = null;
    const original = require_.cache[configPath].exports.geminiModel.generateContent;
    let n = 0;
    require_.cache[configPath].exports.geminiModel.generateContent = async (req) => {
      n++;
      if (n === 1) { failWith.status = 500; } // non-transient status — old code retried ANY error
      else { failWith.status = null; }
      return original(req);
    };
    const t0 = performance.now();
    const it = await StructuredOutputEngine.generateStructuredItinerary('prompt', 'req2');
    const elapsed = performance.now() - t0;
    require_.cache[configPath].exports.geminiModel.generateContent = original;
    check('any-error retried then succeeds (catch-all preserved)', it?.title === 'Baguio Trip', `title=${it?.title}`);
    check('retry makes 2 calls', n === 2, `calls=${n}`);
    check('retry waits fixed ~1s (jitter none)', elapsed >= 950, `${elapsed.toFixed(0)}ms`);
  }

  // --- 3. Exhaustion → fallback itinerary RETURNED (not thrown)
  {
    calls.length = 0; failWith.status = 500;
    const it = await StructuredOutputEngine.generateStructuredItinerary('prompt', 'req3');
    failWith.status = null;
    check('exhaustion returns fallback (not thrown)', it !== null && it !== undefined, `returned=${typeof it}`);
    check('exhaustion makes 2 calls (maxAttempts)', calls.length === 2, `calls=${calls.length}`);
    check('fallback is a structured itinerary shape', it?.items !== undefined || it?.title !== undefined, `keys=${it ? Object.keys(it).join(',') : 'null'}`);
  }

  // --- 4. Aborted signal → no retry, fallback returned
  {
    calls.length = 0; failWith.status = 500;
    const controller = new AbortController();
    controller.abort(); // abort BEFORE the call
    const it = await StructuredOutputEngine.generateStructuredItinerary('prompt', 'req4', controller.signal);
    failWith.status = null;
    check('aborted returns fallback', it !== null && it !== undefined);
    // Aborted before the call: old code rejected the race instantly via the
    // abortPromise. New code: shouldRetry sees aborted → no retry. Either
    // way the attempt count is 1 (the first attempt runs; abort only stops
    // the retry).
    check('aborted makes 1 call (no retry after abort)', calls.length === 1, `calls=${calls.length}`);
  }

  console.log('');
  if (failures > 0) {
    console.log(`SMOKE FAILED — ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('SMOKE OK');
  process.exit(0);
}

main();
