/**
 * Authentication validation schemas
 * - registerSchema: validates new user registration (name, email, username, password)
 * - loginSchema: validates login credentials
 * - changePasswordSchema: validates password change requests
 */

import { z } from 'zod';

export const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email format'),
  // Alphanumeric with dots, hyphens, underscores only
  username: z.string().min(1, 'Username is required').regex(/^[a-zA-Z0-9._-]+$/, 'Username must contain only letters, numbers, dots, hyphens, or underscores'),
  // Minimum 8 characters for password security
  password: z.string().min(8, 'Password must be at least 8 characters'),
  employeeId: z.string().optional()
});

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters')
});

export default { registerSchema, loginSchema, changePasswordSchema };