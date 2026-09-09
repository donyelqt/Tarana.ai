import { encode, decode } from 'next-auth/jwt';
import {
  encodeMobileToken,
  decodeMobileToken,
  isMobileTokenPayload,
  MOBILE_TOKEN_MAX_AGE_SECONDS,
} from '../mobileToken';

jest.mock('next-auth/jwt', () => ({
  encode: jest.fn(),
  decode: jest.fn(),
}));

const mockedEncode = encode as unknown as jest.Mock;
const mockedDecode = decode as unknown as jest.Mock;

describe('mobileToken utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXTAUTH_SECRET = 'test-secret';
  });

  it('encodes a payload with the default salt and short maxAge', async () => {
    mockedEncode.mockResolvedValue('encoded-token');

    const token = await encodeMobileToken({
      sub: 'user-1',
      id: 'user-1',
      email: 'user@example.com',
      tosAccepted: true,
      mobile: true,
    });

    expect(token).toBe('encoded-token');
    expect(mockedEncode).toHaveBeenCalledWith({
      token: {
        sub: 'user-1',
        id: 'user-1',
        email: 'user@example.com',
        tosAccepted: true,
        mobile: true,
      },
      secret: 'test-secret',
      maxAge: MOBILE_TOKEN_MAX_AGE_SECONDS,
    });
  });

  it('throws when NEXTAUTH_SECRET is missing', async () => {
    delete process.env.NEXTAUTH_SECRET;
    await expect(
      encodeMobileToken({
        sub: 'user-1',
        id: 'user-1',
        email: 'user@example.com',
        tosAccepted: true,
        mobile: true,
      })
    ).rejects.toThrow('NEXTAUTH_SECRET is not configured');
  });

  it('returns null for a payload missing required mobile claims', async () => {
    mockedDecode.mockResolvedValue({ sub: 'user-1', id: 'user-1', email: 'user@example.com' });
    const payload = await decodeMobileToken('raw-token');
    expect(payload).toBeNull();
    expect(mockedDecode).toHaveBeenCalledWith({
      token: 'raw-token',
      secret: 'test-secret',
    });
  });

  it('returns the payload for a valid mobile token', async () => {
    mockedDecode.mockResolvedValue({
      sub: 'user-1',
      id: 'user-1',
      email: 'user@example.com',
      tosAccepted: true,
      mobile: true,
    });
    const payload = await decodeMobileToken('raw-token');
    expect(payload).toEqual({
      sub: 'user-1',
      id: 'user-1',
      email: 'user@example.com',
      tosAccepted: true,
      mobile: true,
    });
  });

  it('rejects a payload where tosAccepted is false', async () => {
    mockedDecode.mockResolvedValue({
      sub: 'user-1',
      id: 'user-1',
      email: 'user@example.com',
      tosAccepted: false,
      mobile: true,
    });
    expect(await decodeMobileToken('raw-token')).toBeNull();
  });

  it('rejects a payload where mobile is not true', async () => {
    mockedDecode.mockResolvedValue({
      sub: 'user-1',
      id: 'user-1',
      email: 'user@example.com',
      tosAccepted: true,
      mobile: false,
    });
    expect(await decodeMobileToken('raw-token')).toBeNull();
  });

  it('rejects non-object payloads', () => {
    expect(isMobileTokenPayload(null)).toBe(false);
    expect(isMobileTokenPayload('string')).toBe(false);
    expect(isMobileTokenPayload(undefined)).toBe(false);
  });
});