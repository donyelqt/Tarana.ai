#!/usr/bin/env node
/**
 * Migration-file hygiene gate.
 *
 * Supabase applies migrations in the order `supabase_migrations.schema_migrations`
 * records, and `supabase db push` treats any file whose version it has never seen
 * as pending work. A file that does not follow the `<14-digit version>_<slug>.sql`
 * convention is therefore not just untidy:
 *
 *   - it sorts by its literal filename, not by when the change actually happened,
 *     so ordering silently depends on ASCII luck; and
 *   - if the table it creates is already live, re-running it against production is
 *     a no-op at best, and a duplicate-object error at worst.
 *
 * This gate is pure file inspection: no database, no Docker, no network. It runs
 * in well under a second, so it can fail a push long before the replay job needs
 * to spend a container on the problem.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'supabase/migrations';
const NAME = /^\d{14}_[a-z0-9][a-z0-9_-]*\.sql$/;

/**
 * File-level allowances. Every entry here is a known, evidenced exception, not a
 * convenience: the check still runs on it, and the gate still fails on any new
 * violation of the same rule.
 *
 * `xxxxxx_create_saved_meals.sql` cannot be renamed. Its version string is a key
 * in supabase_migrations.schema_migrations, and 20260919000000_saved_meals_rls_
 * remediation.sql records that this file's policies were NEVER applied while a
 * hand-applied FIX_SAVED_MEALS_RLS_FINAL.sql was (deleted in PR #482 with no
 * remediation). Renaming would mint a new pending migration that replays
 * `create table` plus a drop/create of all four policies against a live,
 * populated table. That is a database change, and it needs a DB session and a
 * rollback plan — not a rename in a lint pass.
 */
const ALLOWLIST = new Map([
  [
    'xxxxxx_create_saved_meals.sql',
    'placeholder version, deliberately not renamed — see check-migration-hygiene.mjs',
  ],
]);

const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const failures = [];
const allowed = [];
const seen = new Map();

for (const file of files) {
  const path = join(DIR, file);

  if (!NAME.test(file)) {
    if (ALLOWLIST.has(file)) {
      allowed.push({ file, why: ALLOWLIST.get(file) });
    } else {
      failures.push(
        `${file}\n    does not match <14-digit version>_<slug>.sql — it will sort by its literal name, ` +
          `not by when the change happened, and supabase db push will treat it as never-applied work.`
      );
    }
    continue;
  }

  const version = file.slice(0, 14);
  if (seen.has(version)) {
    failures.push(`${file}\n    duplicates version ${version} already used by ${seen.get(version)}.`);
  } else {
    seen.set(version, file);
  }

  if (!readFileSync(path, 'utf8').trim()) {
    failures.push(`${file}\n    is empty. A migration that does nothing is either a mistake or belongs in a comment.`);
  }
}

if (failures.length) {
  console.error(`Migration hygiene: ${failures.length} problem(s) in ${DIR}\n`);
  for (const f of failures) console.error(`  - ${f}\n`);
  console.error(
    'Renaming an already-applied migration is itself risky: the version is the primary key in\n' +
      'supabase_migrations.schema_migrations, so a rename reads as a brand-new pending migration.\n' +
      'Check whether the object is live before renaming, and prefer adding a follow-up migration.'
  );
  process.exit(1);
}

console.log(`Migration hygiene OK: ${files.length} files, all versioned and uniquely ordered.`);
if (allowed.length) {
  console.log(`\n${allowed.length} known exception(s), grandfathered:`);
  for (const { file, why } of allowed) console.log(`  - ${file}: ${why}`);
}
