import { z } from 'zod';

export const shiftSchema = z.object({
  name: z.string().min(1, 'Shift name is required'),
  description: z.string().optional(),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be in HH:mm format'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be in HH:mm format'),
  breakTime: z.number().int().min(0, 'Break time must be non-negative').optional().default(0),
  isActive: z.boolean().optional().default(true)
});

export const updateShiftSchema = shiftSchema.partial();

export const shiftAssignmentSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  shiftId: z.string().min(1, 'Shift ID is required'),
  date: z.string().date(),
  notes: z.string().optional()
});

export const updateShiftAssignmentSchema = shiftAssignmentSchema.partial().extend({
  id: z.string().min(1, 'Assignment ID is required')
});

export default { 
  shiftSchema, 
  updateShiftSchema,
  shiftAssignmentSchema,
  updateShiftAssignmentSchema
};