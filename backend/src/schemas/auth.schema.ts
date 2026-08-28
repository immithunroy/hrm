import { z } from 'zod';

export const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email format'),
  username: z.string().min(1, 'Username is required').regex(/^[a-zA-Z0-9._-]+$/, 'Username must contain only letters, numbers, dots, hyphens, or underscores'),
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