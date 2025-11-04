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
  
  return async (request: NextRequest) => {
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