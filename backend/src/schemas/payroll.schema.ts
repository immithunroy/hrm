/**
 * Payroll validation schemas
 * - payrollSchema: payroll record with salary, deductions, tax, and payment details
 * - updatePayrollSchema: partial update; requires payroll ID
 */

import { z } from 'zod';

export const payrollSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  payPeriodStart: z.string().datetime(),
  payPeriodEnd: z.string().datetime(),
  basicSalary: z.number().min(0, 'Basic salary must be positive'),
  // Financial fields default to 0 if omitted
  overtimePay: z.number().min(0, 'Overtime pay must be positive').optional().default(0),
  bonus: z.number().min(0, 'Bonus must be positive').optional().default(0),
  deductions: z.number().min(0, 'Deductions must be positive').optional().default(0),
  tax: z.number().min(0, 'Tax must be positive').optional().default(0),
  netPay: z.number().min(0, 'Net pay must be positive').optional().default(0),
  paymentDate: z.string().datetime().optional(),
  status: z.enum(['PENDING', 'PROCESSED', 'PAID', 'FAILED', 'CANCELLED']).default('PENDING'),
  paymentMethod: z.enum(['BANK_TRANSFER', 'CHECK', 'CASH', 'MOBILE_MONEY']).optional(),
  transactionId: z.string().optional(),
  notes: z.string().optional()
});

// Extend partial schema with required ID for updates
export const updatePayrollSchema = payrollSchema.partial().extend({
  id: z.string().min(1, 'Payroll ID is required')
});

export default { payrollSchema, updatePayrollSchema };