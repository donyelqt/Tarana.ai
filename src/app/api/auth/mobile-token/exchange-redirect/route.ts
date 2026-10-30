
import { NextRequest, NextResponse } from 'next/server';
import { runMobileTokenExchange } from '@/lib/auth/mobileTokenExchange';
import { timedHttp } from '@/lib/observability/httpMetrics';

export async function GET(request: NextRequest) {
  return timedHttp('/api/auth/mobile-token/exchange-redirect', 'GET', async () => {
  
  
  const redirectUrl =
    process.env.MOBILE_EXCHANGE_REDIRECT_URL ?? 'tarana-mobile://auth/exchange';

  const result = await runMobileTokenExchange({ req: request, redirectUrl });
  if ('response' in result) return result.response;

  
  
  return NextResponse.json(
    { error: 'Exchange did not produce a redirect' },
    { status: 500 }
  );
  }, (res) => res.status);
}