import { z } from 'zod';

export const leaveRequestSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  leaveType: z.enum(['CASUAL', 'MEDICAL', 'VACATION', 'SICK', 'PERSONAL', 'MATERNITY', 'PATERNITY', 'BEREAVEMENT', 'JURY_DUTY', 'MILITARY', 'UNPAID']),
  startDate: z.string().date(),
  endDate: z.string().date(),
  reason: z.string().min(1, 'Reason is required')
});

export const updateLeaveRequestSchema = leaveRequestSchema.partial().extend({
  id: z.string().min(1, 'Leave request ID is required'),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional()
});

export default { leaveRequestSchema, updateLeaveRequestSchema };