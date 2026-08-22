"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRateLimit = exports.rateLimit = void 0;
const appError_1 = require("../utils/appError");
const store = new Map();
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
const rateLimit = (windowMs, max) => {
    return (req, _res, next) => {
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
            return next(new appError_1.AppError('Too many requests. Please try again later.', 429));
        }
        next();
    };
};
exports.rateLimit = rateLimit;
/**
 * Stricter rate limiter for auth endpoints (login/register).
 * 10 attempts per 15 minutes per IP.
 */
exports.authRateLimit = (0, exports.rateLimit)(15 * 60 * 1000, 10);
exports.default = { rateLimit: exports.rateLimit, authRateLimit: exports.authRateLimit };
