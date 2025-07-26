# Middleware Architecture for Tarana.ai

This directory contains a modular and scalable middleware system for the Tarana.ai application. The architecture is designed to be flexible, maintainable, and easy to extend.

## Directory Structure

- `index.ts` - Main composition and export of middleware functions
- `auth.ts` - Authentication middleware for protected routes
- `logger.ts` - Request logging middleware
- `cors.ts` - CORS (Cross-Origin Resource Sharing) middleware
- `types.ts` - TypeScript type definitions for middleware
- `compose.ts` - Utility for composing middleware chains

## How the Architecture Works

1. Each middleware is defined in its own file with its own configuration
2. The `index.ts` file composes middleware into a single handler
3. The root `middleware.ts` file acts as a bridge between Next.js and our system

This structure allows us to:
- Add or remove middleware without changing the core structure
- Configure each middleware independently
- Reuse middleware across different parts of the application
- Easily test individual middleware

## Adding New Middleware

To add a new middleware:

1. Create a new file for your middleware (e.g. `rateLimit.ts`)
2. Export your middleware function and configuration:

```typescript
// rateLimit.ts
import { NextRequest, NextResponse } from 'next/server';

export const rateLimitConfig = {
  enabled: true,
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
};

export function rateLimitMiddleware(request: NextRequest) {
  // Implementation here
  return NextResponse.next();
}
```

3. Update the middleware chain in `index.ts`:

```typescript
// index.ts
import { rateLimitMiddleware, rateLimitConfig } from './rateLimit';

const middlewareHandler = composeMiddleware({
  middlewares: [
    // Add your middleware to the chain
    { 
      handler: rateLimitMiddleware, 
      name: 'rateLimit', 
      enabled: rateLimitConfig.enabled,
      priority: 75 // Set appropriate priority
    },
    // Existing middleware...
  ],
  // ...
});
```

## Advanced Usage

For more complex requirements, you can create new middleware that depends on other middleware, or create middleware that addresses specific routes or HTTP methods. 