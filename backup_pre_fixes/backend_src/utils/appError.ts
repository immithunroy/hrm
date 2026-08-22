import { Request, Response, NextFunction } from 'express';

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  public statusCode: number;
  public status: string;
  public isOperational: boolean;
  public errors?: any[];

  constructor(message: string, statusCode: number, errors?: any[]) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.errors = errors;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handling middleware
 */
export const errorHandler = (err: Error | AppError, req: Request, res: Response, next: NextFunction) => {
  const appError = err as AppError;
  appError.statusCode = appError.statusCode || 500;
  appError.status = appError.status || 'error';

  // Operational error (validation, business logic, etc.)
  if (appError.isOperational) {
    res.status(appError.statusCode).json({
      success: false,
      message: appError.message,
      ...(appError.errors && { errors: appError.errors })
    });
  } else {
    // Programming error (unknown error)
    console.error('ERROR 💥:', err);
    res.status(500).json({
      success: false,
      message: 'Something went wrong!',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * 404 Not Found middleware
 */
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};