/**
 * In-Memory Rate Limiter
 *
 * Sliding-window counter per IP+route. Not distributed — resets on server
 * restart. Sufficient for single-instance deployments; replace with Redis-
 * backed limiter if you scale to multiple instances.
 *
 * Two exports:
 *   - rateLimit(windowMs, max): Generic factory for any route.
 *   - authRateLimit: Pre-configured for auth endpoints (20 req / 15 min).
 *
 * Key format: "<ip>:<baseUrl><path>" — isolates limits per-route.
 */
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Global in-memory store — keyed by IP+route
const store = new Map<string, RateLimitEntry>();

// Periodic cleanup prevents unbounded memory growth from abandoned entries.
// Expired entries are lazily replaced anyway, but this guarantees eventual cleanup.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetTime) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Create a rate-limiting middleware.
 * @param windowMs  Rolling time window in milliseconds
 * @param max       Maximum number of requests allowed within the window
 */
export const rateLimit = (windowMs: number, max: number) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    // Build a unique key per IP + route so different endpoints have independent limits.
    // Uses req.ip (honors trust proxy setting) or falls back to raw socket address.
    const key = `${req.ip || req.socket.remoteAddress || 'unknown'}:${req.baseUrl}${req.path}`;
    const now = Date.now();

    let entry = store.get(key);
    // First request or window expired → start a fresh window
    if (!entry || now > entry.resetTime) {
      entry = { count: 1, resetTime: now + windowMs };
      store.set(key, entry);
      return next();
    }

    entry.count++;
    if (entry.count > max) {
      // 429 Too Many Requests — standard HTTP status for rate limiting
      return next(new AppError('Too many requests. Please try again later.', 429));
    }

    next();
  };
};

/**
 * Stricter rate limiter for auth endpoints (login/register).
 * 20 attempts per 15 minutes per IP.
 */
export const authRateLimit = rateLimit(15 * 60 * 1000, 20);

export default { rateLimit, authRateLimit };
