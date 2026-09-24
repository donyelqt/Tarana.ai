import { getSafeErrorMetadata } from '../safeErrorMetadata';

describe('getSafeErrorMetadata', () => {
  it('returns only bounded error name and short code', () => {
    const error = Object.assign(new Error('secret upstream detail'), { code: 'UPSTREAM_TIMEOUT' });

    expect(getSafeErrorMetadata(error)).toEqual({
      errorName: 'Error',
      errorCode: 'UPSTREAM_TIMEOUT',
    });
    expect(JSON.stringify(getSafeErrorMetadata(error))).not.toContain('secret upstream detail');
  });

  it('does not expose messages, stacks, or unbounded codes', () => {
    const error = Object.assign(new Error('secret detail'), { code: 'x'.repeat(33) });

    expect(getSafeErrorMetadata(error)).toEqual({ errorName: 'Error' });
    expect(getSafeErrorMetadata('secret detail')).toEqual({ errorName: 'string' });
  });
});
