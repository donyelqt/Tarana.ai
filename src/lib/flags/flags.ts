
export interface FlagDefinition {
  name: string;
  owner: string;
  expiry: string;
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