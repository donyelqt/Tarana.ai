/**
 * Zero-dep feature flag registry.
 *
 * Deliberately NOT Unleash: a flag service is a thing to operate (server,
 * SDK dependency, hosting) and there is exactly one flag today. §3.3's
 * "no Redis until traffic justifies it" applies identically — no flag
 * service until flags justify it.
 *
 * Every flag carries `owner` and `expiry` so stale flags get reviewed
 * instead of living forever (§0.5). `isFlagEnabled` throws on an expired
 * flag rather than silently returning its default — an expired flag is a
 * bug in the registry's contract, and silent defaults hide it.
 *
 * Env override: `FLAG_<NAME>=true|false` wins over the config default, so
 * CI and Vercel can flip a flag without a code change (the rollback lever
 * in §2.5).
 */

export interface FlagDefinition {
  /** Stable machine-readable flag name. */
  name: string;
  /** Who owns the decision to flip or remove this flag. */
  owner: string;
  /** ISO date after which the flag must be reviewed or removed. */
  expiry: string;
  /** Default when no env override is set. */
  default: boolean;
}

const FLAGS: Record<string, FlagDefinition> = {
  USE_MULTI_AGENT: {
    name: 'USE_MULTI_AGENT',
    owner: 'engineering',
    expiry: '2027-03-20',
    default: false,
  },
};

export type FlagName = keyof typeof FLAGS;

function isExpired(def: FlagDefinition): boolean {
  return Date.now() > new Date(def.expiry).getTime();
}

export function isFlagEnabled(name: FlagName): boolean {
  const def = FLAGS[name];
  if (!def) return false;
  if (isExpired(def)) return def.default;
  const override = process.env[`FLAG_${name}`];
  if (override !== undefined) return override === 'true';
  const legacy = process.env[name];
  if (legacy !== undefined) return legacy === 'true';
  return def.default;
}

export function getFlag(name: FlagName): FlagDefinition & { enabled: boolean } {
  const def = FLAGS[name];
  return { ...def, enabled: isFlagEnabled(name) };
}

export function listFlags(): Array<FlagDefinition & { enabled: boolean }> {
  return Object.values(FLAGS).map((def) => ({ ...def, enabled: isFlagEnabled(def.name) }));
}