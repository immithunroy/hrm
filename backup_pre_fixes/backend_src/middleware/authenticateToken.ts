import { Request, Response, NextFunction } from 'express';
import { verify } from 'jsonwebtoken';
import { AppError } from '../utils/appError';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * Middleware to authenticate JWT token
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return next(new AppError('Access token not provided', 401));
    }

    const decoded = verify(token, JWT_SECRET) as { id: string; email: string };
    req.userId = decoded.id;
    next();
  } catch (error) {
    return next(new AppError('Invalid or expired token', 401));
  }
};

/**
 * Middleware to check user role/permissions
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // In a real implementation, you would check user roles from database
    // For now, we'll allow all authenticated users
    if (!req.userId) {
      return next(new AppError('Unauthorized access', 401));
    }
    next();
  };
};

export default { authenticateToken, authorize };