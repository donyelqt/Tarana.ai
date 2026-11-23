import { describe, expect, it } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts', 'supabase-keep-awake.mjs');

function run(env: Record<string, string | undefined>) {
  return spawnSync(process.execPath, [SCRIPT], {
    encoding: 'utf8',
    cwd: process.cwd(),
    env: {
      ...process.env,
      KEEP_AWAKE_NO_DOTENV: 'yes',
      ...env,
    },
  });
}

describe('supabase-keep-awake - the scheduled probe', () => {
  it('refuses to run without a project URL and a service-role key', () => {
    const result = run({
      NEXT_PUBLIC_SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Missing NEXT_PUBLIC_SUPABASE_URL');
  });

  it('reports an unreachable project as a failed probe', () => {
    const result = run({
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9',
      SUPABASE_SERVICE_ROLE_KEY: 'not-a-real-key',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Supabase keep-awake probe failed');
  });

  it('does not append a duplicate rest path when the URL already carries one', () => {
    const result = run({
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9/rest/v1',
      SUPABASE_SERVICE_ROLE_KEY: 'not-a-real-key',
    });
    expect(result.status).toBe(1);
  });
});