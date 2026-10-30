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
