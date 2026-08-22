"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.authenticateToken = void 0;
const jsonwebtoken_1 = require("jsonwebtoken");
const appError_1 = require("../utils/appError");
const database_1 = require("../config/database");
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not set');
    process.exit(1);
}
// Simple in-memory role cache (employeeId -> role) to avoid DB hit every request
const roleCache = new Map();
const ROLE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
async function resolveRole(userId, jwtRole) {
    // If JWT has a role, trust it (fast path)
    if (jwtRole)
        return jwtRole;
    // Check cache
    const cached = roleCache.get(userId);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.role;
    }
    // Fallback to DB lookup (for old tokens without role)
    const employee = await database_1.prisma.employee.findUnique({
        where: { id: userId },
        select: { role: true }
    });
    const role = employee?.role || 'EMPLOYEE';
    roleCache.set(userId, { role, expiresAt: Date.now() + ROLE_CACHE_TTL });
    return role;
}
/**
 * Middleware to authenticate JWT token.
 * Supports old tokens (without role) by falling back to DB lookup.
 */
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            return next(new appError_1.AppError('Access token not provided', 401));
        }
        const decoded = (0, jsonwebtoken_1.verify)(token, JWT_SECRET);
        req.userId = decoded.id;
        // Resolve role: from JWT (fast) or DB (fallback for old tokens)
        req.userRole = await resolveRole(decoded.id, decoded.role);
        next();
    }
    catch (error) {
        return next(new appError_1.AppError('Invalid or expired token', 401));
    }
};
exports.authenticateToken = authenticateToken;
/**
 * Middleware to check user role/permissions.
 * Accepts role strings like 'ADMIN', 'HR', 'MANAGER', etc.
 * Compares against the role resolved in authenticateToken.
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.userId) {
            return next(new appError_1.AppError('Unauthorized access', 401));
        }
        const userRole = req.userRole;
        if (!userRole || !roles.includes(userRole)) {
            return next(new appError_1.AppError('Insufficient permissions', 403));
        }
        next();
    };
};
exports.authorize = authorize;
exports.default = { authenticateToken: exports.authenticateToken, authorize: exports.authorize };
