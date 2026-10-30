import { NextRequest } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked: boolean;
  blockUntil?: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  blockDurationMs: number;
  skipSuccessfulRequests?: boolean;
}

const RATE_LIMIT_STORE_CAP = 10000;
class InMemoryRateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime < now && (!entry.blockUntil || entry.blockUntil < now)) {
        this.store.delete(key);
      }
    }
    while (this.store.size > RATE_LIMIT_STORE_CAP) {
      const oldest = this.store.keys().next();
      if (oldest.done) break;
      this.store.delete(oldest.value);
    }
  }

  private getClientIdentifier(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const hops = (forwarded ?? '').split(',').map((h) => h.trim()).filter(Boolean);
    const ip = request.headers.get('x-real-ip') || (hops.length > 0 ? hops[hops.length - 1] : null) || 'unknown';

    return ip;
  }

  checkRateLimit(request: NextRequest, config: RateLimitConfig, key = ''): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  } {
    const clientId = key ? `${key}:${this.getClientIdentifier(request)}` : this.getClientIdentifier(request);
    const now = Date.now();
    const windowStart = now - config.windowMs;

    let entry = this.store.get(clientId);

    if (entry?.blocked && entry.blockUntil && entry.blockUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter: Math.ceil((entry.blockUntil - now) / 1000),
      };
    }

    if (!entry || entry.resetTime <= now) {
      entry = {
        count: 0,
        resetTime: now + config.windowMs,
        blocked: false,
      };
    }

    entry.count++;

    if (entry.count > config.maxRequests) {
      entry.blocked = true;
      entry.blockUntil = now + config.blockDurationMs;
      
      this.store.set(clientId, entry);
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter: Math.ceil(config.blockDurationMs / 1000),
      };
    }

    this.store.set(clientId, entry);

    return {
      allowed: true,
      remaining: Math.max(0, config.maxRequests - entry.count),
      resetTime: entry.resetTime,
    };
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

const rateLimiter = new InMemoryRateLimiter();

export const rateLimitConfigs = {
  auth: {
    windowMs: 15 * 60 * 1000, 
    maxRequests: 5, 
    blockDurationMs: 30 * 60 * 1000, 
  },
  
  passwordReset: {
    windowMs: 60 * 60 * 1000, 
    maxRequests: 3, 
    blockDurationMs: 2 * 60 * 60 * 1000, 
  },
  
  api: {
    windowMs: 60 * 1000, 
    maxRequests: 60, 
    blockDurationMs: 5 * 60 * 1000, 
  },
  
  heavy: {
    windowMs: 60 * 1000, 
    maxRequests: 10, 
    blockDurationMs: 10 * 60 * 1000, 
  },

  referralValidation: {
    windowMs: 5 * 60 * 1000, 
    maxRequests: 20, 
    blockDurationMs: 15 * 60 * 1000, 
  },

  mobileToken: {
    windowMs: 15 * 60 * 1000, 
    maxRequests: 5, 
    blockDurationMs: 60 * 60 * 1000, 
  },
} as const;

export function createRateLimitMiddleware(config: RateLimitConfig) {
  return (request: NextRequest) => {
    return rateLimiter.checkRateLimit(request, config);
  };
}

export { rateLimiter };
