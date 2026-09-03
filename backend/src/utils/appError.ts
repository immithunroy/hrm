/**
 * Application Error Handling
 *
 * Provides:
 *   - AppError: Custom error class that carries an HTTP status code and
 *     distinguishes operational errors (expected, user-facing) from
 *     programming bugs (unexpected).
 *   - errorHandler: Global Express error middleware. Returns structured JSON
 *     for operational errors; logs the full error and returns a generic 500
 *     for unexpected/programming errors. In development, the original error
 *     message is included to aid debugging.
 *   - notFound: Catch-all 404 middleware — mount after all routes.
 *
 * Error flow:
 *   1. Route/middleware throws AppError (or any Error).
 *   2. Express forwards it to errorHandler.
 *   3. errorHandler checks isOperational:
 *      - true  → client receives { success, message, errors? }
 *      - false → server logs the stack trace; client receives generic message.
 */
import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  public statusCode: number;
  public status: string; // 'fail' for 4xx, 'error' for 5xx
  public isOperational: boolean; // true = expected business/validation error
  public errors?: any[]; // optional structured details (e.g. validation fields)

  constructor(message: string, statusCode: number, errors?: any[]) {
    super(message);
    this.statusCode = statusCode;
    // 'fail' signals client errors (4xx); 'error' signals server errors (5xx)
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.errors = errors;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global Express error-handling middleware.
 * Must have 4 parameters so Express识别s it as an error handler.
 */
export const errorHandler = (err: Error | AppError, req: Request, res: Response, next: NextFunction) => {
  const appError = err as AppError;
  appError.statusCode = appError.statusCode || 500;
  appError.status = appError.status || 'error';

  if (appError.isOperational) {
    // Operational error — send structured response to client
    res.status(appError.statusCode).json({
      success: false,
      message: appError.message,
      ...(appError.errors && { errors: appError.errors })
    });
  } else {
    // Programming/unexpected error — log full stack, hide details from client
    console.error('ERROR 💥:', err);
    res.status(500).json({
      success: false,
      message: 'Something went wrong!',
      // Leak error details only in development to aid debugging
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * 404 catch-all — mount after all route definitions.
 * Converts unmatched routes into AppError instances handled by errorHandler.
 */
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};