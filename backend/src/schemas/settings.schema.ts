import { z } from 'zod';

export const updateSettingsSchema = z.object({
  overtimeRate: z.number().min(0).max(10).optional(),
  holidayOvertimeRate: z.number().min(0).max(10).optional(),
  workingDaysPerMonth: z.number().int().min(1).max(31).optional(),
  workingHoursPerDay: z.number().min(1).max(24).optional(),
  currency: z.string().max(10).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  defaultWeeklyHoliday: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']).optional(),
  // Allow unknown keys for extensibility but validate known ones.
}).passthrough();

export const updateRoleSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  role: z.enum(['ADMIN', 'HR', 'MANAGER', 'FINANCE', 'EMPLOYEE'])
});

export default { updateSettingsSchema, updateRoleSchema };
