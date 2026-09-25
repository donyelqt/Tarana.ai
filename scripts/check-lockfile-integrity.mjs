#!/usr/bin/env node
/**
 * Lockfile hygiene gate (NOT a provenance gate).
 *
 * This lockfile contains zero attestations or signatures — pnpm 9.5 has no
 * `audit signatures` subcommand, and lockfile v9.0 carries no attestation
 * fields. The sha512 `integrity` hashes below are registry content hashes
 * (tarball matches registry at fetch time), NOT cryptographic signatures
 * (publisher identity). Absence of attestations is expected and is NOT
 * proof of supply-chain safety.
 *
 * What this gate honestly asserts (structural invariants of pnpm-lock.yaml):
 * - exactly one lockfile (no competing npm/yarn/shrinkwrap lockfiles)
 * - default registry only (no custom `registry:` overrides, no `tarball:` URLs)
 * - every resolution entry carries an integrity hash
 * - package.json `packageManager` pin matches the expected pnpm major
 *
 * Complementary to (not duplicating): `pnpm audit` (vulnerability scanning)
 * and `--frozen-lockfile` (lockfile/package.json sync). Those run at install;
 * this asserts the committed file's own invariants and fails loudly otherwise.
 *
 * Run: `node scripts/check-lockfile-integrity.mjs` (no install needed).
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const LOCKFILE = join(ROOT, 'pnpm-lock.yaml');
const PACKAGE_JSON = join(ROOT, 'package.json');
// Competing lockfiles at the same installation boundary.
const COMPETING = ['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock'];
const EXPECTED_MANAGER_PREFIX = 'pnpm@9.';

const failures = [];

function fail(message) {
  failures.push(message);
  console.error(`lockfile-hygiene: FAIL — ${message}`);
}

let resolutionCount = 0;
let integrityCount = 0;
let pin = '';

if (!existsSync(LOCKFILE)) {
  fail('pnpm-lock.yaml is missing');
} else {
  const text = readFileSync(LOCKFILE, 'utf8');

  for (const other of COMPETING) {
    if (existsSync(join(ROOT, other))) {
      fail(`competing lockfile present: ${other} (one authoritative lockfile only)`);
    }
  }

  // Every resolution entry must carry an integrity hash.
  const resolutions = text.match(/^ *resolution: \{[^}]*\}/gm) ?? [];
  if (resolutions.length === 0) {
    fail('no resolution entries found — unexpected lockfile shape');
  }
  resolutionCount = resolutions.length;
  integrityCount = resolutions.filter((entry) => /integrity:\s*sha512-/.test(entry)).length;
  if (integrityCount < resolutionCount) {
    fail(`${resolutionCount - integrityCount}/${resolutionCount} resolution entries lack a sha512 integrity hash`);
  }

  // Default registry only: no custom registry overrides, no tarball URLs.
  if (/^\s*registry:/m.test(text)) {
    fail('custom `registry:` override present (default registry only)');
  }
  if (/(^|\s)tarball:\s*\S/m.test(text)) {
    fail('`tarball:` URL present (default registry tarballs only)');
  }
}

try {
  pin = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')).packageManager ?? '';
  if (!pin.startsWith(EXPECTED_MANAGER_PREFIX)) {
    fail(`package.json packageManager pin is ${JSON.stringify(pin)} (expected ${EXPECTED_MANAGER_PREFIX}x)`);
  }
} catch (error) {
  fail(`could not read package.json packageManager pin: ${error.message}`);
}

if (failures.length > 0) {
  process.exit(1);
}
console.log(
  `lockfile-hygiene: OK — ${resolutionCount} resolution entries, ` +
    `${integrityCount} with sha512 integrity, ` +
    'no competing lockfiles, no registry overrides, no tarball URLs, ' +
    `packageManager pin ${pin} OK`
);
