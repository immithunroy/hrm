"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFound = exports.errorHandler = exports.AppError = void 0;
/**
 * Custom error class for application errors
 */
class AppError extends Error {
    constructor(message, statusCode, errors) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        this.errors = errors;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
    const appError = err;
    appError.statusCode = appError.statusCode || 500;
    appError.status = appError.status || 'error';
    // Operational error (validation, business logic, etc.)
    if (appError.isOperational) {
        res.status(appError.statusCode).json({
            success: false,
            message: appError.message,
            ...(appError.errors && { errors: appError.errors })
        });
    }
    else {
        // Programming error (unknown error)
        console.error('ERROR 💥:', err);
        res.status(500).json({
            success: false,
            message: 'Something went wrong!',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};
exports.errorHandler = errorHandler;
/**
 * 404 Not Found middleware
 */
const notFound = (req, res, next) => {
    const error = new AppError(`Route ${req.originalUrl} not found`, 404);
    next(error);
};
exports.notFound = notFound;
