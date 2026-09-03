/**
 * Attendance validation schemas
 * - attendanceSchema: attendance record with check-in/out, hours, overtime, and device tracking
 * - updateAttendanceSchema: partial update of attendance fields
 */

import { z } from 'zod';

export const attendanceSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  // ISO 8601 datetime strings for precise timestamps
  checkIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().optional(),
  date: z.string().date(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EARLY', 'LEAVE', 'HOLIDAY', 'HALF', 'WEEKEND']).optional(),
  workHours: z.number().min(0).optional(),
  overtimeHours: z.number().min(0).optional(),
  earlyOvertimeHours: z.number().min(0).optional(),
  // Minute-based fields must be non-negative integers
  lateMinutes: z.number().int().min(0).optional(),
  earlyDepartureMinutes: z.number().int().min(0).optional(),
  breakMinutes: z.number().int().min(0).optional(),
  errandCount: z.number().int().min(0).optional(),
  deviceId: z.string().optional(),
  deviceLogId: z.string().optional()
});

export const updateAttendanceSchema = attendanceSchema.partial();

export default { attendanceSchema, updateAttendanceSchema };