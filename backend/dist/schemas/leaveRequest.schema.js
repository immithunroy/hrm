"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLeaveRequestSchema = exports.leaveRequestSchema = void 0;
const zod_1 = require("zod");
exports.leaveRequestSchema = zod_1.z.object({
    employeeId: zod_1.z.string().min(1, 'Employee ID is required'),
    leaveType: zod_1.z.enum(['VACATION', 'SICK', 'PERSONAL', 'MATERNITY', 'PATERNITY', 'BEREAVEMENT', 'JURY_DUTY', 'MILITARY', 'UNPAID']),
    startDate: zod_1.z.string().date(),
    endDate: zod_1.z.string().date(),
    reason: zod_1.z.string().min(1, 'Reason is required')
});
exports.updateLeaveRequestSchema = exports.leaveRequestSchema.partial().extend({
    id: zod_1.z.string().min(1, 'Leave request ID is required'),
    status: zod_1.z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional()
});
exports.default = { leaveRequestSchema: exports.leaveRequestSchema, updateLeaveRequestSchema: exports.updateLeaveRequestSchema };
