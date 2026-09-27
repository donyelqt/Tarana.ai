import { NextRequest, NextResponse } from 'next/server';
import { MiddlewareHandler, MiddlewareChainConfig } from './types';
import { applySecurityHeaders } from '@/lib/security/securityHeaders';

/**
 * Composes multiple middleware functions into a single middleware chain
 * 
 * @param config Configuration for the middleware chain
 * @returns A composed middleware function that runs each middleware in sequence
 */
export function composeMiddleware(config: MiddlewareChainConfig): MiddlewareHandler {
  const { middlewares, errorHandler } = config;
  
  // Sort middlewares by priority (if available)
  const sortedMiddlewares = [...middlewares].sort(
    (a, b) => (b.priority || 0) - (a.priority || 0)
  );
  
  // Filter out disabled middlewares
  const activeMiddlewares = sortedMiddlewares.filter(m => m.enabled);

  /**
   * Collect the request headers a middleware asked Next to forward.
   *
   * `NextResponse.next({ request: { headers } })` is serialised into
   * `x-middleware-override-headers` (a comma-joined key list) plus one
   * `x-middleware-request-<key>` per header. Next applies ONLY the final
   * response's override list and deletes every request header not named in
   * it, so a later middleware returning a bare `next()` silently discards
   * what an earlier one forwarded. Merging here keeps the union.
   */
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
    // Request headers to forward downstream, accumulated across the chain.
    const forwardedHeaders = new Map<string, string>();
    // Response headers set by earlier middleware (e.g. the request id echoed
    // for client correlation), which a later bare next() would otherwise drop.
    const accumulatedResponseHeaders = new Map<string, string>();
    try {
      let response = applySecurityHeaders(NextResponse.next());
      
      // Execute each middleware in sequence
      for (const middleware of activeMiddlewares) {
        try {
          const result = await middleware.handler(request);
          
          if (result instanceof NextResponse) {
            const securedResult = applySecurityHeaders(result);
            const isNext = securedResult.headers.get('x-middleware-next') === '1';
            
            if (!isNext) {
              return securedResult;
            }

            // Fold this step's forwarded headers into the running union and
            // strip the per-step serialisation so only our merged set ships.
            for (const [key, value] of readForwardedHeaders(securedResult)) {
              forwardedHeaders.set(key, value);
            }
            securedResult.headers.delete('x-middleware-override-headers');
            for (const key of forwardedHeaders.keys()) {
              securedResult.headers.delete(`x-middleware-request-${key}`);
            }

            // Carry forward non-middleware response headers set by this step.
            for (const [key, value] of securedResult.headers) {
              if (key.toLowerCase().startsWith('x-middleware-')) continue;
              accumulatedResponseHeaders.set(key, value);
            }
            
            response = securedResult;
            continue;
          }
          
          // Middleware returned undefined/null – default to continuing with a secured response
          response = applySecurityHeaders(NextResponse.next());
        } catch (error) {
          console.error(`Error in middleware ${middleware.name}:`, error);
          
          // Use custom error handler if provided, otherwise continue
          if (errorHandler) {
            return errorHandler(error as Error, request);
          }
        }
      }

      // Rebuild the surviving next() so both the merged request headers and
      // the accumulated response headers reach the route and the client.
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

      // Authenticated API JSON must never sit in a shared cache: a forward
      // proxy could serve user A's body to user B. Health carves out its
      // own short public TTL at the route.
      response.headers.set('Cache-Control', 'no-store');
      return applySecurityHeaders(response);
    } catch (error) {
      console.error('Unhandled middleware error:', error);

      // Use custom error handler if provided, otherwise return server error
      if (errorHandler) {
        return errorHandler(error as Error, request);
      }

      return new NextResponse('Internal Server Error', { status: 500 });
    }
  };
}