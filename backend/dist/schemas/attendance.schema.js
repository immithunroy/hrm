"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAttendanceSchema = exports.attendanceSchema = void 0;
const zod_1 = require("zod");
exports.attendanceSchema = zod_1.z.object({
    employeeId: zod_1.z.string().min(1, 'Employee ID is required'),
    checkIn: zod_1.z.string().datetime().optional(),
    checkOut: zod_1.z.string().datetime().optional(),
    date: zod_1.z.string().date(),
    status: zod_1.z.enum(['PRESENT', 'ABSENT', 'LATE', 'EARLY', 'LEAVE', 'HOLIDAY', 'HALF', 'WEEKEND']).optional(),
    workHours: zod_1.z.number().min(0).optional(),
    overtimeHours: zod_1.z.number().min(0).optional(),
    earlyOvertimeHours: zod_1.z.number().min(0).optional(),
    lateMinutes: zod_1.z.number().int().min(0).optional(),
    earlyDepartureMinutes: zod_1.z.number().int().min(0).optional(),
    breakMinutes: zod_1.z.number().int().min(0).optional(),
    errandCount: zod_1.z.number().int().min(0).optional(),
    deviceId: zod_1.z.string().optional(),
    deviceLogId: zod_1.z.string().optional()
});
exports.updateAttendanceSchema = exports.attendanceSchema.partial();
exports.default = { attendanceSchema: exports.attendanceSchema, updateAttendanceSchema: exports.updateAttendanceSchema };
