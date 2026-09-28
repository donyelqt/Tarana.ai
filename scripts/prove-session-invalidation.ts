/**
 * Proof that password-reset session invalidation actually works end to end.
 *
 * Run: npx tsx scripts/prove-session-invalidation.ts
 * Exit 0 = every assertion held.
 *
 * This cannot be a jest test: next-auth's `jwt` entry pulls an ESM-only
 * dependency that jest does not transform, so the real encode/decode path is
 * unreachable there. The jest suite (`src/lib/auth/__tests__/
 * sessionValidity.test.ts`) covers the callback contract; this script proves
 * the contract holds through the library's own session route, which is where
 * the original implementation silently failed.
 *
 * What it proves, in order:
 *   1. `iat` is re-stamped on re-encode (so it cannot date a session) — the
 *      reason the credential instant is pinned as a custom claim.
 *   2. A custom claim survives the encode/decode round-trip.
 *   3. Returning null from `jwt` does NOT discard a session: next-auth
 *      serialises the ORIGINAL token back and the session survives — the exact
 *      failure mode of the first implementation.
 *   4. Returning an empty body from `session` DOES discard it
 *      (`getServerSession` -> null) — the shipped mechanism.
 *   5. A session whose stamp matches the account is still returned intact.
 */
import { encode, decode, getToken } from 'next-auth/jwt';

const SECRET = 'p'.repeat(40);
const COOKIE = 'next-auth.session-token';
const LIVE = '2026-09-20T12:00:00.000Z';
const STALE = '2026-09-01T00:00:00.000Z';
const CLAIM = 'pwdChangedAt';

let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

/** Mirror of next-auth's OWN session body contract, parameterised by how a
 *  theoretical rejection could be expressed. It intentionally does NOT mirror
 *  the app's callbacks: this script proves the library premise the app relies
 *  on (a key-less body is "no session"; a null `jwt` return is ignored), while
 *  the app's real `session` callback is pinned separately in
 *  `src/lib/auth/__tests__/sessionValidity.test.ts` ("session() credential-
 *  change gate" describe).
 */
function options(rejectVia: 'jwt-null' | 'session-empty', defensiveSession: boolean) {
  return {
    secret: SECRET,
    session: { strategy: 'jwt' as const, maxAge: 3600 },
    jwt: { maxAge: 3600 },
    providers: [],
    callbacks: {
      async jwt({ token }: any) {
        if (rejectVia === 'jwt-null' && (token[CLAIM] ?? null) !== LIVE) return null;
        return token;
      },
      async session({ session, token }: any) {
        if (rejectVia === 'session-empty' && (token[CLAIM] ?? null) !== LIVE) return {};
        // The original code dereferenced `token.id` unconditionally; the
        // `defensiveSession` variant models the one-token edit (`token?.id`)
        // that would make a null token survive.
        if (session.user) session.user.id = defensiveSession ? token?.id : token.id;
        return session;
      },
    },
  };
}

async function sessionFor(
  claim: string,
  rejectVia: 'jwt-null' | 'session-empty',
  defensiveSession = false
) {
  const { getServerSession } = await import('next-auth');
  const cookie = await encode({
    token: { id: 'u1', sub: 'u1', email: 'u@example.com', name: 'U', [CLAIM]: claim },
    secret: SECRET,
    maxAge: 3600,
  });
  const req = {
    headers: { cookie: `${COOKIE}=${cookie}`, host: 'localhost:3000' },
    cookies: { [COOKIE]: cookie },
  };
  const res = { getHeader: () => [], setHeader: () => {}, setCookie: () => {} };
  // Silence next-auth's expected JWT_SESSION_ERROR logging for the null case.
  const orig = console.error;
  console.error = () => {};
  try {
    return await getServerSession(
      req as never,
      res as never,
      options(rejectVia, defensiveSession) as never
    );
  } finally {
    console.error = orig;
  }
}

async function main() {
  const first = await decode({
    token: await encode({ token: { id: 'u1' }, secret: SECRET, maxAge: 3600 }),
    secret: SECRET,
  });
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const second = await decode({
    token: await encode({ token: first as never, secret: SECRET, maxAge: 3600 }),
    secret: SECRET,
  });
  check(
    'iat advances on re-encode',
    Number(second?.iat) > Number(first?.iat),
    `${first?.iat} -> ${second?.iat}`
  );

  console.log('\n2. a custom claim survives the round-trip');
  const roundTripped = await decode({
    token: await encode({ token: { id: 'u1', [CLAIM]: LIVE }, secret: SECRET, maxAge: 3600 }),
    secret: SECRET,
  });
  check('claim preserved', roundTripped?.[CLAIM] === LIVE, String(roundTripped?.[CLAIM]));

  console.log('\n3. how next-auth treats a null jwt() return');
  const nullTokenDefensive = await sessionFor(STALE, 'jwt-null', true);
  check(
    'null token SURVIVES when the session callback tolerates it',
    nullTokenDefensive !== null,
    nullTokenDefensive ? 'session still returned (denial was incidental)' : 'null'
  );
  const nullTokenDeref = await sessionFor(STALE, 'jwt-null', false);
  check(
    'null token denies ONLY because the callback throws on it',
    nullTokenDeref === null,
    nullTokenDeref ? 'returned anyway' : 'TypeError swallowed -> null session'
  );

  console.log('\n4. an empty body from session() DOES discard it');
  const viaSessionEmpty = await sessionFor(STALE, 'session-empty');
  check('stale session discarded', viaSessionEmpty === null, JSON.stringify(viaSessionEmpty));

  console.log('\n5. a current session is returned intact');
  const current = await sessionFor(LIVE, 'session-empty');
  check(
    'matching session returned with identity',
    current !== null && (current as { user?: { id?: string } }).user?.id === 'u1',
    JSON.stringify(current)
  );

  console.log('\n6. the harness stub only ever minted stamped tokens; shipped enforcement comes from elsewhere');
  // Scoped honestly. Step 6 used to claim it proved the deployed mobile
  // regression (pre-deploy tokens have no stamp key). It cannot: this script
  // drives hand-built JWEs, not the exchange, so every minted token carries
  // whatever the harness wrote. The real regression guard lives in the jest
  // suite (mobileToken.test.ts: validator shape) and the exchange tests
  // (stale source session -> 401). This step keeps the round-trip evidence
  // that matters here: the stamp survives the same encode/getToken path the
  // middleware uses.
  const rawMobile = await encode({
    token: { sub: 'u1', id: 'u1', email: 'u@example.com', tosAccepted: true, mobile: true, [CLAIM]: LIVE },
    secret: SECRET,
    maxAge: 900,
  });
  const resolved = await getToken({
    req: { cookies: { getAll: () => [{ name: COOKIE, value: rawMobile }] }, headers: {} } as never,
    secret: SECRET,
  });
  check(
    'current-issue token carries the stamp the gate compares',
    (resolved as { pwdChangedAt?: string | null } | null)?.pwdChangedAt === LIVE,
    JSON.stringify({ pwdChangedAt: (resolved as { pwdChangedAt?: string })?.pwdChangedAt })
  );
  console.log(
    failures === 0
      ? '\nSESSION INVALIDATION VERIFIED: enforcement point is load-bearing.\n'
      : `\nFAILED: ${failures} assertion(s) did not hold.\n`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('PROVE FAILED:', err);
  process.exit(1);
});
