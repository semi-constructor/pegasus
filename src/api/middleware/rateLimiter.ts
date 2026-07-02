import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';

interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
}

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: Request) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  message?: string; // Custom error message
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Create rate limit middleware
   */
  middleware(options: RateLimitOptions) {
    const {
      windowMs,
      maxRequests,
      keyGenerator,
      skipSuccessfulRequests = false,
      skipFailedRequests = false,
      message = 'Too many requests, please try again later',
    } = options;

    return (req: Request, res: Response, next: NextFunction): void => {
      // Generate key for this request
      const key = keyGenerator ? keyGenerator(req) : this.defaultKeyGenerator(req);
      const now = Date.now();

      // Get or create limit entry
      let entry = this.limits.get(key);

      if (!entry || now > entry.resetTime) {
        // Create new entry or reset expired one
        entry = {
          count: 0,
          resetTime: now + windowMs,
          firstRequest: now,
        };
        this.limits.set(key, entry);
      }

      // Check if limit exceeded
      if (entry.count >= maxRequests) {
        const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

        res.setHeader('X-RateLimit-Limit', String(maxRequests));
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());
        res.setHeader('Retry-After', String(retryAfter));

        logger.warn(`Rate limit exceeded for ${key}: ${entry.count}/${maxRequests} requests`);

        res.status(429).json({
          error: 'Too Many Requests',
          message,
          retryAfter,
        });
        return;
      }

      // Increment counter conditionally
      const originalEnd = res.end;
      let counted = false;

      const originalEndTyped = originalEnd as any;
      (res as any).end = function (chunk?: any, encoding?: any, callback?: any): Response {
        if (!counted) {
          counted = true;

          const shouldCount =
            (!skipSuccessfulRequests || res.statusCode >= 400) &&
            (!skipFailedRequests || res.statusCode < 400);

          if (shouldCount && entry) {
            entry.count++;
          }
        }

        // Call original end with appropriate arguments
        if (typeof chunk === 'function') {
          return originalEndTyped.call(res, chunk);
        } else if (typeof encoding === 'function') {
          return originalEndTyped.call(res, chunk, encoding);
        } else if (callback) {
          return originalEndTyped.call(res, chunk, encoding, callback);
        } else {
          return originalEndTyped.call(res, chunk, encoding);
        }
      };

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - entry.count - 1)));
      res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());

      next();
    };
  }

  /**
   * Default key generator (IP + path)
   */
  private defaultKeyGenerator(req: Request): string {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return `${ip}:${req.path}`;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetTime + 60000) {
        // Keep for 1 minute after expiry
        this.limits.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Rate limiter cleanup: removed ${cleaned} expired entries`);
    }
  }

  /**
   * Get current limits status
   */
  getStatus(): { totalKeys: number; activeKeys: number } {
    const now = Date.now();
    const activeKeys = Array.from(this.limits.values()).filter(
      entry => now <= entry.resetTime
    ).length;

    return {
      totalKeys: this.limits.size,
      activeKeys,
    };
  }

  /**
   * Reset limits for a specific key
   */
  reset(key: string): boolean {
    return this.limits.delete(key);
  }

  /**
   * Clear all limits
   */
  clear(): void {
    this.limits.clear();
  }

  /**
   * Destroy the rate limiter
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.limits.clear();
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

// Preset configurations
export const RateLimitPresets = {
  // Standard API rate limit (100 requests per minute)
  standard: {
    windowMs: 60000,
    maxRequests: 100,
  },

  // Strict rate limit (10 requests per minute)
  strict: {
    windowMs: 60000,
    maxRequests: 10,
  },

  // Per-guild rate limit (10 requests per second per guild)
  perGuild: {
    windowMs: 1000,
    maxRequests: 10,
    keyGenerator: (req: Request) => {
      const guildId = req.params.guildId || 'unknown';
      const ip = req.ip || 'unknown';
      return `guild:${guildId}:${ip}`;
    },
  },

  // Stats endpoint rate limit (matches dashboard refresh rate)
  stats: {
    windowMs: 500,
    maxRequests: 50,
    keyGenerator: (req: Request) => {
      const ip = req.ip || 'unknown';
      return `stats:${ip}`;
    },
  },

  // Heavy operation rate limit (1 request per 5 seconds)
  heavy: {
    windowMs: 5000,
    maxRequests: 1,
  },
};

/**
 * Create standard rate limiter
 */
export function createRateLimiter(options: RateLimitOptions) {
  return rateLimiter.middleware(options);
}

/**
 * Create per-guild rate limiter
 */
export function guildRateLimiter(maxRequests: number = 10, windowMs: number = 1000) {
  return rateLimiter.middleware({
    windowMs,
    maxRequests,
    keyGenerator: (req: Request) => {
      const guildId = req.params.guildId || 'unknown';
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      return `guild:${guildId}:${ip}`;
    },
    message: 'Too many requests for this guild, please slow down',
  });
}

/**
 * Create IP-based rate limiter
 */
export function ipRateLimiter(maxRequests: number = 100, windowMs: number = 60000) {
  return rateLimiter.middleware({
    windowMs,
    maxRequests,
    keyGenerator: (req: Request) => {
      return req.ip || req.socket.remoteAddress || 'unknown';
    },
  });
}

/**
 * Create user-based rate limiter (requires auth middleware to set userId)
 */
export function userRateLimiter(maxRequests: number = 50, windowMs: number = 60000) {
  return rateLimiter.middleware({
    windowMs,
    maxRequests,
    keyGenerator: (req: Request) => {
      const userId = (req as any).userId || 'anonymous';
      return `user:${userId}`;
    },
    message: 'User rate limit exceeded, please wait before making more requests',
  });
}

/**
 * Get rate limiter status
 */
export function getRateLimiterStatus() {
  return rateLimiter.getStatus();
}

/**
 * Export the singleton for advanced usage
 */
export { rateLimiter };
