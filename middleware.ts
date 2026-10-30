import { middleware as middlewareHandler } from '@/middleware';
import { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return middlewareHandler(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
