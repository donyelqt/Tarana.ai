
import { NextRequest } from 'next/server';
import { runMobileTokenExchange } from '@/lib/auth/mobileTokenExchange';
import { timedHttp } from '@/lib/observability/httpMetrics';

export async function POST(request: NextRequest) {
  return timedHttp('/api/auth/mobile-token', 'POST', async () => {
    const result = await runMobileTokenExchange({ req: request });
    if ('response' in result) return result.response;
    return Response.json(result.value);
  }, (res) => res.status);
}