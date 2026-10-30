import { getToken } from 'next-auth/jwt';
import { encodeMobileToken, decodeMobileToken } from '../src/lib/auth/mobileToken';

process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'bridge-verify-secret';
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

async function main() {
  const token = await encodeMobileToken({
    sub: 'user-1',
    id: 'user-1',
    email: 'user@example.com',
    tosAccepted: true,
    mobile: true,
    pwdChangedAt: null,
  });
  console.log('1. encoded mobile token length:', token.length);

  const payload = await decodeMobileToken(token);
  if (!payload) throw new Error('decodeMobileToken returned null');
  console.log('2. decoded payload id:', payload.id, '| mobile:', payload.mobile);

  const cookieName = process.env.NEXTAUTH_URL?.startsWith('https://')
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token';

  const resolved = await getToken({
    req: {
      cookies: { getAll: () => [{ name: cookieName, value: token }] },
      headers: {},
    } as any,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!resolved) throw new Error('getToken returned null for the synthetic cookie');
  console.log('3. getToken resolved user id:', resolved.id, '| tosAccepted:', resolved.tosAccepted);

  const bad = await getToken({
    req: {
      cookies: { getAll: () => [{ name: cookieName, value: 'user-1' }] },
      headers: {},
    } as any,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (bad !== null) throw new Error('getToken accepted a bare UUID — bridge would be broken');
  console.log('5. bare UUID correctly rejected by getToken:', bad === null);

  console.log('\nBRIDGE VERIFIED: middleware injection → getToken → decode round-trips.');
}

main().catch((err) => {
  console.error('BRIDGE FAILED:', err.message);
  process.exit(1);
});