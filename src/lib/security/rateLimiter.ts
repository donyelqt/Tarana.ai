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

/**
 * In-memory rate limiter for API endpoints
 * Production apps should use Redis or similar distributed cache
 */
class InMemoryRateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
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
  }

  private getClientIdentifier(request: NextRequest): string {
    // Use multiple identifiers for better accuracy
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwarded?.split(',')[0] || realIp || 'unknown';
    
    // Include user agent for additional fingerprinting
    const userAgent = request.headers.get('user-agent') || '';
    const userAgentHash = this.simpleHash(userAgent);
    
    return `${ip}:${userAgentHash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  checkRateLimit(request: NextRequest, config: RateLimitConfig): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  } {
    const clientId = this.getClientIdentifier(request);
    const now = Date.now();
    const windowStart = now - config.windowMs;

    let entry = this.store.get(clientId);

    // Check if client is currently blocked
    if (entry?.blocked && entry.blockUntil && entry.blockUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter: Math.ceil((entry.blockUntil - now) / 1000),
      };
    }

    // Initialize or reset entry if window has passed
    if (!entry || entry.resetTime <= now) {
      entry = {
        count: 0,
        resetTime: now + config.windowMs,
        blocked: false,
      };
    }

    // Increment request count
    entry.count++;

    // Check if limit exceeded
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

// Global rate limiter instance
const rateLimiter = new InMemoryRateLimiter();

// Predefined rate limit configurations
export const rateLimitConfigs = {
  // Authentication endpoints - stricter limits
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per window
    blockDurationMs: 30 * 60 * 1000, // Block for 30 minutes
  },
  
  // Password reset - very strict
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // 3 attempts per hour
    blockDurationMs: 2 * 60 * 60 * 1000, // Block for 2 hours
  },
  
  // API endpoints - moderate limits
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
    blockDurationMs: 5 * 60 * 1000, // Block for 5 minutes
  },
  
  // Heavy operations (AI/ML endpoints)
  heavy: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute
    blockDurationMs: 10 * 60 * 1000, // Block for 10 minutes
  },
} as const;

/**
 * Rate limiting middleware function
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return (request: NextRequest) => {
    return rateLimiter.checkRateLimit(request, config);
  };
}

export { rateLimiter };
