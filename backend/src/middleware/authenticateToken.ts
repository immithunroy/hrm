import { Request, Response, NextFunction } from 'express';
import { verify } from 'jsonwebtoken';
import { AppError } from '../utils/appError';
import { prisma } from '../config/database';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: string;
    }
  }
}

const roleCache = new Map<string, { role: string; expiresAt: number }>();
const ROLE_CACHE_TTL = 5 * 60 * 1000;

async function resolveRole(userId: string, jwtRole?: string): Promise<string> {
  if (jwtRole) return jwtRole;
  const cached = roleCache.get(userId);
  if (cached && Date.now() < cached.expiresAt) return cached.role;
  const employee = await prisma.employee.findUnique({
    where: { id: userId },
    select: { role: true }
  });
  const role = employee?.role || 'EMPLOYEE';
  roleCache.set(userId, { role, expiresAt: Date.now() + ROLE_CACHE_TTL });
  return role;
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return next(new AppError('Access token not provided', 401));
    const decoded = verify(token, JWT_SECRET) as { id: string; email: string; role?: string };
    req.userId = decoded.id;
    req.userRole = await resolveRole(decoded.id, decoded.role);
    next();
  } catch (error) {
    return next(new AppError('Invalid or expired token', 401));
  }
};

/**
 * Standard role check. Usage: authorize('ADMIN', 'HR')
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) return next(new AppError('Unauthorized access', 401));
    const userRole = req.userRole;
    if (!userRole || !roles.includes(userRole)) {
      return next(new AppError('Insufficient permissions', 403));
    }
    next();
  };
};

/**
 * Role check with self-access. Usage: authorizeOrSelf('ADMIN', 'HR')
 * Allows access if user has one of the roles OR is accessing their own resource (/:id matches userId).
 */
export const authorizeOrSelf = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) return next(new AppError('Unauthorized access', 401));
    const userRole = req.userRole || '';
    const resourceId = req.params.id;
    const isSelf = resourceId === req.userId;
    if (isSelf || roles.includes(userRole)) {
      return next();
    }
    return next(new AppError('Insufficient permissions', 403));
  };
};

export default { authenticateToken, authorize, authorizeOrSelf };
