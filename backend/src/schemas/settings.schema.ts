/**
 * Settings validation schemas
 * - updateSettingsSchema: system-wide settings (overtime rates, working hours, currency, tax)
 *   Uses .passthrough() to allow unknown keys for extensibility
 * - updateRoleSchema: assign a role to an employee
 */

import { z } from 'zod';

export const updateSettingsSchema = z.object({
  overtimeRate: z.number().min(0).max(10).optional(),
  holidayOvertimeRate: z.number().min(0).max(10).optional(),
  workingDaysPerMonth: z.number().int().min(1).max(31).optional(),
  workingHoursPerDay: z.number().min(1).max(24).optional(),
  // ISO currency code (max 10 chars for flexibility with symbols)
  currency: z.string().max(10).optional(),
  // Tax rate as percentage (0-100)
  taxRate: z.number().min(0).max(100).optional(),
  defaultWeeklyHoliday: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']).optional(),
  // Allow unknown keys for extensibility but validate known ones.
}).passthrough();

export const updateRoleSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  // Roles ordered from most to least privileged
  role: z.enum(['ADMIN', 'HR', 'MANAGER', 'FINANCE', 'EMPLOYEE'])
});

export default { updateSettingsSchema, updateRoleSchema };
