import { isFlagEnabled, getFlag, listFlags } from '../flags';

describe('feature flag registry', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('USE_MULTI_AGENT defaults to false when no env override is set', () => {
    delete process.env.USE_MULTI_AGENT;
    delete process.env.FLAG_USE_MULTI_AGENT;
    expect(isFlagEnabled('USE_MULTI_AGENT')).toBe(false);
  });

  it('legacy env override (USE_MULTI_AGENT=true) enables the flag', () => {
    process.env.USE_MULTI_AGENT = 'true';
    delete process.env.FLAG_USE_MULTI_AGENT;
    expect(isFlagEnabled('USE_MULTI_AGENT')).toBe(true);
  });

  it('legacy env override (USE_MULTI_AGENT=false) keeps it off', () => {
    process.env.USE_MULTI_AGENT = 'false';
    delete process.env.FLAG_USE_MULTI_AGENT;
    expect(isFlagEnabled('USE_MULTI_AGENT')).toBe(false);
  });

  it('new FLAG_ env override wins over the legacy env', () => {
    process.env.USE_MULTI_AGENT = 'true';
    process.env.FLAG_USE_MULTI_AGENT = 'false';
    expect(isFlagEnabled('USE_MULTI_AGENT')).toBe(false);
  });

  it('FLAG_ override true enables even when legacy is false', () => {
    process.env.USE_MULTI_AGENT = 'false';
    process.env.FLAG_USE_MULTI_AGENT = 'true';
    expect(isFlagEnabled('USE_MULTI_AGENT')).toBe(true);
  });

  it('getFlag returns owner and expiry metadata', () => {
    const flag = getFlag('USE_MULTI_AGENT');
    expect(flag.owner).toBe('engineering');
    expect(flag.expiry).toBe('2027-03-20');
    expect(typeof flag.enabled).toBe('boolean');
  });

  it('unknown flag name returns false and does not throw', () => {
    expect(isFlagEnabled('DOES_NOT_EXIST' as never)).toBe(false);
  });

  it('listFlags returns every flag with enabled state', () => {
    const all = listFlags();
    expect(all.length).toBeGreaterThanOrEqual(1);
    for (const f of all) {
      expect(f.name).toBeTruthy();
      expect(f.owner).toBeTruthy();
      expect(f.expiry).toBeTruthy();
      expect(typeof f.enabled).toBe('boolean');
    }
  });
});