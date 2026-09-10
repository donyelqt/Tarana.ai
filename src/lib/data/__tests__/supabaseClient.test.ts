/**
 * Regression guard for the Metro crash: importing supabaseClient must NEVER
 * throw on missing env. ES imports hoist, so on mobile the shared module
 * evaluates before ensureWebEnv() injects env — the legacy module-evaluation
 * throw was structurally unfixable from the mobile side. Env is now read
 * lazily, and the identical error surfaces at first use instead.
 */
describe('supabaseClient lazy init', () => {
  const URL_KEY = 'NEXT_PUBLIC_SUPABASE_URL';
  const ANON_KEY = 'NEXT_PUBLIC_SUPABASE_ANON_KEY';
  const TEST_URL = 'https://example.supabase.co';
  const TEST_ANON_KEY = 'test-anon-key';

  let savedUrl: string | undefined;
  let savedKey: string | undefined;

  beforeEach(() => {
    savedUrl = process.env[URL_KEY];
    savedKey = process.env[ANON_KEY];
    jest.resetModules();
  });

  afterEach(() => {
    if (savedUrl === undefined) {
      delete process.env[URL_KEY];
    } else {
      process.env[URL_KEY] = savedUrl;
    }
    if (savedKey === undefined) {
      delete process.env[ANON_KEY];
    } else {
      process.env[ANON_KEY] = savedKey;
    }
    jest.resetModules();
  });

  it('importing the module without env does not throw', async () => {
    delete process.env[URL_KEY];
    delete process.env[ANON_KEY];
    await expect(import('../supabaseClient')).resolves.toBeDefined();
  });

  it('getSupabase without URL throws the legacy missing-URL message', async () => {
    delete process.env[URL_KEY];
    delete process.env[ANON_KEY];
    const { getSupabase } = await import('../supabaseClient');
    expect(() => getSupabase()).toThrow('Missing env.NEXT_PUBLIC_SUPABASE_URL');
  });

  it('getSupabase without anon key throws the legacy missing-key message', async () => {
    process.env[URL_KEY] = TEST_URL;
    delete process.env[ANON_KEY];
    const { getSupabase } = await import('../supabaseClient');
    expect(() => getSupabase()).toThrow(
      'Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  });

  it('createSupabaseClientWithToken without env throws the legacy message', async () => {
    delete process.env[URL_KEY];
    delete process.env[ANON_KEY];
    const { createSupabaseClientWithToken } = await import('../supabaseClient');
    expect(() => createSupabaseClientWithToken('token')).toThrow(
      'Missing env.NEXT_PUBLIC_SUPABASE_URL'
    );
  });

  it('with env set, both factories return working clients', async () => {
    process.env[URL_KEY] = TEST_URL;
    process.env[ANON_KEY] = TEST_ANON_KEY;
    const { getSupabase, createSupabaseClientWithToken } = await import(
      '../supabaseClient'
    );
    const base = getSupabase();
    expect(base).toBeDefined();
    expect(typeof base.from).toBe('function');
    expect(base.auth).toBeDefined();
    // Base client is cached across calls.
    expect(getSupabase()).toBe(base);
    const authed = createSupabaseClientWithToken('token');
    expect(authed).toBeDefined();
    expect(typeof authed.from).toBe('function');
    expect(authed.auth).toBeDefined();
  });
});
