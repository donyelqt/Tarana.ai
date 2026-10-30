import { NextRequest, NextResponse } from 'next/server';
import { MiddlewareHandler, MiddlewareChainConfig } from './types';
import { applySecurityHeaders } from '@/lib/security/securityHeaders';

export function composeMiddleware(config: MiddlewareChainConfig): MiddlewareHandler {
  const { middlewares, errorHandler } = config;
  
  const sortedMiddlewares = [...middlewares].sort(
    (a, b) => (b.priority || 0) - (a.priority || 0)
  );
  
  const activeMiddlewares = sortedMiddlewares.filter(m => m.enabled);

  const readForwardedHeaders = (response: NextResponse): Map<string, string> => {
    const forwarded = new Map<string, string>();
    const keys = response.headers.get('x-middleware-override-headers');
    if (!keys) return forwarded;
    for (const key of keys.split(',')) {
      const trimmed = key.trim();
      if (!trimmed) continue;
      const value = response.headers.get(`x-middleware-request-${trimmed}`);
      if (value !== null) forwarded.set(trimmed, value);
    }
    return forwarded;
  };

  return async (request: NextRequest) => {
    const forwardedHeaders = new Map<string, string>();
    const accumulatedResponseHeaders = new Map<string, string>();
    try {
      let response = applySecurityHeaders(NextResponse.next());
      
      for (const middleware of activeMiddlewares) {
        try {
          const result = await middleware.handler(request);
          
          if (result instanceof NextResponse) {
            const securedResult = applySecurityHeaders(result);
            const isNext = securedResult.headers.get('x-middleware-next') === '1';
            
            if (!isNext) {
              return securedResult;
            }

            for (const [key, value] of readForwardedHeaders(securedResult)) {
              forwardedHeaders.set(key, value);
            }
            securedResult.headers.delete('x-middleware-override-headers');
            for (const key of forwardedHeaders.keys()) {
              securedResult.headers.delete(`x-middleware-request-${key}`);
            }

            for (const [key, value] of securedResult.headers) {
              if (key.toLowerCase().startsWith('x-middleware-')) continue;
              accumulatedResponseHeaders.set(key, value);
            }
            
            response = securedResult;
            continue;
          }
          
          response = applySecurityHeaders(NextResponse.next());
        } catch (error) {
          console.error(`Error in middleware ${middleware.name}:`, error);
          
          if (errorHandler) {
            return errorHandler(error as Error, request);
          }
        }
      }

      if (forwardedHeaders.size > 0) {
        const merged = new Headers(request.headers);
        for (const [key, value] of forwardedHeaders) {
          merged.set(key, value);
        }
        const rebuilt = NextResponse.next({ request: { headers: merged } });
        for (const [key, value] of accumulatedResponseHeaders) {
          rebuilt.headers.set(key, value);
        }
        response = rebuilt;
      } else if (accumulatedResponseHeaders.size > 0) {
        for (const [key, value] of accumulatedResponseHeaders) {
          response.headers.set(key, value);
        }
      }

      response.headers.set('Cache-Control', 'no-store');
      return applySecurityHeaders(response);
    } catch (error) {
      console.error('Unhandled middleware error:', error);

      if (errorHandler) {
        return errorHandler(error as Error, request);
      }

      return new NextResponse('Internal Server Error', { status: 500 });
    }
  };
}