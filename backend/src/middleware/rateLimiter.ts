import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetTime) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Simple in-memory rate limiter.
 * @param windowMs  Time window in milliseconds
 * @param max       Maximum requests per window
 */
export const rateLimit = (windowMs: number, max: number) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const key = `${req.ip || req.socket.remoteAddress || 'unknown'}:${req.baseUrl}${req.path}`;
    const now = Date.now();

    let entry = store.get(key);
    if (!entry || now > entry.resetTime) {
      entry = { count: 1, resetTime: now + windowMs };
      store.set(key, entry);
      return next();
    }

    entry.count++;
    if (entry.count > max) {
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
