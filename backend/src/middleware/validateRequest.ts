/**
 * Zod Request Body Validation Middleware
 *
 * Validates req.body against a Zod schema before the route handler runs.
 * On failure, returns 400 with a structured `errors` array:
 *   { field: "address.city", message: "Required" }
 *
 * Usage:
 *   router.post('/employees', validateRequest(createEmployeeSchema), handler);
 *
 * Supports nested paths (dot-separated) and array indices in field names.
 * Non-Zod errors are forwarded to the global error handler.
 */
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/appError';

export const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Zod.parse throws ZodError on failure; returns the (possibly transformed) data on success
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Flatten ZodError into a client-friendly array of { field, message }
        const errors = error.errors.map(err => ({
          field: err.path.join('.'), // e.g. ["address", "city"] → "address.city"
          message: err.message
        }));
        return next(new AppError('Validation failed', 400, errors));
      }
      next(error);
    }
  };
};

export default validateRequest;